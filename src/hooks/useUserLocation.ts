import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { AppState } from 'react-native';
import * as Location from 'expo-location';
import { bearingToDirection, type Direction } from '../components/CharacterSprite';
import { computeBearing, haversineMeters } from '../utils/geo';
import { requestForegroundLocation } from '../services/locationSettings';

// ─── GPS tuning ────────────────────────────────────────────────────────────
const GPS_ENV: 'indoor' | 'outdoor' = 'outdoor';
const GPS_CONFIG = {
  indoor: { GPS_ACCURACY_MAX: 60, MIN_MOVE_METERS: 1.5, STATIONARY_TIMEOUT_MS: 1000 },
  outdoor: { GPS_ACCURACY_MAX: 25, MIN_MOVE_METERS: 1.5, STATIONARY_TIMEOUT_MS: 1000 },
} as const;
const { GPS_ACCURACY_MAX, MIN_MOVE_METERS, STATIONARY_TIMEOUT_MS } = GPS_CONFIG[GPS_ENV];

const POSITION_HISTORY_MAX = 8;
const HEADING_MIN_TOTAL_M = 2.5;
const HEADING_MIN_CONFIDENCE = 0.65;
const HEADING_SEGMENT_MIN_M = 0.8;
const WALK_WINDOW_MS = 2500;
const WALK_WINDOW_MIN_M = 1.8;
const WALK_NET_MIN_M = 1.5;
const DIR_CONFIRM_THRESHOLD = 2;
const DIR_CONFIRM_THRESHOLD_CHIP = 1;
const SMOOTH_ALPHA = 0.35;
const STATIONARY_SPEED_MS = 0.3;
// Speed at which we trust the GPS chip enough to flip walking on without
// waiting for the displacement window — well above the noise floor and well
// below normal walking pace (~1.4 m/s).
const CONFIDENT_WALK_SPEED_MS = 0.7;
// Marker chase loop tuning: per-frame lerp factor (~0.18 → ~270ms time
// constant @ 60Hz), max forward dead-reckoning projection from the last fix,
// and the GPS-gap threshold above which we snap rather than tween (covers
// background→foreground returns and signal-recovery from tunnels/elevators).
const FOLLOW_ALPHA = 0.18;
const DR_CAP_MS = 1500;
const LONG_PAUSE_MS = 5000;
// Skip setDisplayedCoords when the per-frame delta is below ~1 cm — saves
// React reconciliation while the user is stationary or fully caught up.
const SUBPIXEL_M = 0.01;
// Camera animation duration is clamped to this range and otherwise tracks the
// actual GPS sample interval, so the camera glide rate matches whatever pace
// the receiver is delivering fixes.
const CAMERA_ANIM_MIN_MS = 500;
const CAMERA_ANIM_MAX_MS = 1500;
const MAP_ZOOM_DEFAULT = 17.5;
const MAP_PITCH = 65;

interface UseUserLocationOptions {
  cameraRef: RefObject<any>;
  onAppForeground?: () => void;
}

interface UseUserLocationResult {
  userCoords: [number, number] | null;
  displayedCoords: [number, number] | null;
  userCoordsRef: RefObject<[number, number] | null>;
  isWalking: boolean;
  characterDirection: Direction;
  recenter: () => Promise<void>;
  // Caller drives camera rotation; hook re-derives sprite direction immediately so
  // rotation updates the sprite without waiting for the next GPS fix.
  onCameraHeading: (heading: number) => void;
}

export function useUserLocation({
  cameraRef,
  onAppForeground,
}: UseUserLocationOptions): UseUserLocationResult {
  const cameraHeadingRef = useRef(0);
  const [userCoords, setUserCoords] = useState<[number, number] | null>(null);
  const [displayedCoords, setDisplayedCoords] = useState<[number, number] | null>(null);
  const [isWalking, setIsWalking] = useState(false);
  const [characterDirection, setCharacterDirection] = useState<Direction>('s');

  const userCoordsRef = useRef<[number, number] | null>(null);
  const displayedCoordsRef = useRef<[number, number] | null>(null);
  // Latest authoritative fix used by the marker chase loop. Velocity is
  // deg/sec on [lng, lat], derived from the previous fix; the chase loop
  // projects forward from this so the marker keeps moving during GPS gaps.
  const lastFixRef = useRef<{
    coords: [number, number];
    t: number;
    velocity: [number, number];
  } | null>(null);

  const lastAccepted = useRef<{ lng: number; lat: number; t: number } | null>(null);
  const positionHistory = useRef<{ lng: number; lat: number; t: number }[]>([]);
  // Default world-south so camera rotation updates the sprite even before the user walks.
  const lastAbsBearing = useRef<number | null>(180);
  const stationaryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const characterDirectionRef = useRef<Direction>('s');
  const dirCandidateRef = useRef<Direction | null>(null);
  const dirCandidateCountRef = useRef(0);
  // Walk hysteresis: +1 per walk-evidence sample, -1 per idle-evidence sample.
  const walkCandidateRef = useRef(0);
  // Cold-start gürültüsünü yutmak için: confident-speed shortcut'ı tek fix'te
  // tetiklenmez, üst üste 2 yüksek-speed fix gerekir. İlk fix seed olduğu için
  // shortcut zaten atlanır; bu sayaç ikinci fix'teki tek seferlik glitch'i de
  // (örn. uygulama açılışında reposition sırasında reported 0.8 m/s) filtreler.
  const confidentSpeedStreakRef = useRef(0);

  const watchSubRef = useRef<Location.LocationSubscription | null>(null);
  const watchStartingRef = useRef(false);
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    userCoordsRef.current = userCoords;
  }, [userCoords]);

  // Update the chase target whenever a new fix arrives. Inferred velocity from
  // the previous fix lets the chase loop dead-reckon forward through the GPS
  // gap — so the marker keeps moving at human pace instead of stalling between
  // 1Hz samples. A long pause (background return, signal recovery) snaps
  // rather than tweens, since the geometry between old and new is stale.
  useEffect(() => {
    if (!userCoords) return;
    const now = Date.now();
    const prev = lastFixRef.current;

    if (!prev) {
      lastFixRef.current = { coords: userCoords, t: now, velocity: [0, 0] };
      displayedCoordsRef.current = userCoords;
      setDisplayedCoords(userCoords);
      return;
    }

    const dtSec = (now - prev.t) / 1000;

    if (dtSec * 1000 > LONG_PAUSE_MS) {
      lastFixRef.current = { coords: userCoords, t: now, velocity: [0, 0] };
      displayedCoordsRef.current = userCoords;
      setDisplayedCoords(userCoords);
      return;
    }

    const velocity: [number, number] =
      dtSec > 0.05
        ? [
            (userCoords[0] - prev.coords[0]) / dtSec,
            (userCoords[1] - prev.coords[1]) / dtSec,
          ]
        : prev.velocity;
    lastFixRef.current = { coords: userCoords, t: now, velocity };
  }, [userCoords]);

  // Continuous RAF chase loop: each frame the displayed marker lerps toward
  // `lastFix.coords + velocity * elapsed`, capped at DR_CAP_MS of forward
  // projection so a stale velocity can't drift the marker arbitrarily far.
  // setState is skipped when per-frame movement is sub-cm so React isn't
  // re-rendering at 60Hz while stationary.
  useEffect(() => {
    let raf: number | null = null;
    const tick = () => {
      const fix = lastFixRef.current;
      const displayed = displayedCoordsRef.current;
      if (fix && displayed) {
        const elapsedMs = Math.min(Date.now() - fix.t, DR_CAP_MS);
        const projSec = elapsedMs / 1000;
        const targetLng = fix.coords[0] + fix.velocity[0] * projSec;
        const targetLat = fix.coords[1] + fix.velocity[1] * projSec;
        const nextLng = displayed[0] + (targetLng - displayed[0]) * FOLLOW_ALPHA;
        const nextLat = displayed[1] + (targetLat - displayed[1]) * FOLLOW_ALPHA;
        const movedM = haversineMeters(
          displayed[1], displayed[0], nextLat, nextLng,
        );
        if (movedM > SUBPIXEL_M) {
          const next: [number, number] = [nextLng, nextLat];
          displayedCoordsRef.current = next;
          setDisplayedCoords(next);
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      if (raf != null) cancelAnimationFrame(raf);
    };
  }, []);

  const startWatching = useCallback(async () => {
    if (watchSubRef.current || watchStartingRef.current) return;
    watchStartingRef.current = true;
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const servicesEnabled = await Location.hasServicesEnabledAsync();
      if (!servicesEnabled) return;
      watchSubRef.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, timeInterval: 1000, distanceInterval: 0 },
        ({ coords, timestamp }) => {
          if (coords.accuracy != null && coords.accuracy > GPS_ACCURACY_MAX) return;
          const next: [number, number] = [coords.longitude, coords.latitude];
          const last = lastAccepted.current;

          if (!last) {
            lastAccepted.current = { lng: coords.longitude, lat: coords.latitude, t: timestamp };
            positionHistory.current.push({ lng: coords.longitude, lat: coords.latitude, t: timestamp });
            setUserCoords(next);
            cameraRef.current?.setCamera({ centerCoordinate: next, animationDuration: 0 });
            return;
          }

          const moved = haversineMeters(last.lat, last.lng, coords.latitude, coords.longitude);

          // Stationary gates: ignore small wobbles AND low-speed fixes. Phone speed sensor
          // is authoritative — kill walk state immediately so GPS wobble can't fake walking.
          const reportedSpeed = coords.speed ?? -1;
          const stationaryBySpeed = reportedSpeed >= 0 && reportedSpeed < STATIONARY_SPEED_MS;
          if (stationaryBySpeed) {
            if (stationaryTimer.current) clearTimeout(stationaryTimer.current);
            setIsWalking(false);
            positionHistory.current = [];
            dirCandidateRef.current = null;
            dirCandidateCountRef.current = 0;
            walkCandidateRef.current = 0;
            confidentSpeedStreakRef.current = 0;
            return;
          }

          // Accumulate history BEFORE the distance gate so slow walkers still build data
          // for direction tracking.
          const hist = positionHistory.current;
          hist.push({ lng: coords.longitude, lat: coords.latitude, t: timestamp });
          while (hist.length > POSITION_HISTORY_MAX) hist.shift();

          if (moved < MIN_MOVE_METERS) {
            if (stationaryTimer.current) clearTimeout(stationaryTimer.current);
            stationaryTimer.current = setTimeout(() => {
              setIsWalking(false);
              positionHistory.current = [];
              walkCandidateRef.current = 0;
              confidentSpeedStreakRef.current = 0;
            }, STATIONARY_TIMEOUT_MS);
            return;
          }

          // Time-normalized exponential low-pass: weight alpha by elapsed time so irregular
          // GPS intervals don't produce inconsistent position jumps.
          const dtSec = Math.min((timestamp - last.t) / 1000, 2);
          const alpha = 1 - Math.pow(1 - SMOOTH_ALPHA, dtSec);
          const smoothedLng = last.lng + alpha * (coords.longitude - last.lng);
          const smoothedLat = last.lat + alpha * (coords.latitude - last.lat);
          const smoothed: [number, number] = [smoothedLng, smoothedLat];

          setUserCoords(smoothed);
          // Camera glides at the actual GPS sample interval (clamped) so its
          // pace matches the marker chase — no fixed-duration mismatch when
          // the receiver speeds up or slows down.
          const camAnimMs = Math.min(
            Math.max(timestamp - last.t, CAMERA_ANIM_MIN_MS),
            CAMERA_ANIM_MAX_MS,
          );
          cameraRef.current?.setCamera({
            centerCoordinate: smoothed,
            animationDuration: camAnimMs,
          });
          lastAccepted.current = { lng: smoothedLng, lat: smoothedLat, t: timestamp };

          const cutoff = timestamp - WALK_WINDOW_MS;
          let windowDist = 0;
          let firstIdx = -1;
          for (let i = 0; i < hist.length; i++) {
            if (hist[i].t >= cutoff) {
              firstIdx = i;
              break;
            }
          }
          let netDisplacement = 0;
          if (firstIdx >= 0) {
            for (let i = firstIdx + 1; i < hist.length; i++) {
              windowDist += haversineMeters(
                hist[i - 1].lat, hist[i - 1].lng, hist[i].lat, hist[i].lng,
              );
            }
            if (firstIdx < hist.length - 1) {
              netDisplacement = haversineMeters(
                hist[firstIdx].lat, hist[firstIdx].lng,
                hist[hist.length - 1].lat, hist[hist.length - 1].lng,
              );
            }
          }

          const speedIndicatesWalk = reportedSpeed < 0 || reportedSpeed >= STATIONARY_SPEED_MS;
          // Scale walk thresholds by GPS accuracy so noisy fixes can't fake walking.
          const accuracyFloor = coords.accuracy ?? GPS_ACCURACY_MAX;
          const windowMin = Math.max(WALK_WINDOW_MIN_M, accuracyFloor * 0.5);
          const netMin = Math.max(WALK_NET_MIN_M, accuracyFloor * 0.4);

          const wantWalk =
            windowDist >= windowMin && netDisplacement >= netMin && speedIndicatesWalk;

          // Asymmetric integrator: +1 per walk-evidence sample, -2 per idle —
          // so stop reacts roughly twice as fast as start without sacrificing
          // start-side jitter rejection.
          walkCandidateRef.current = wantWalk
            ? Math.min(walkCandidateRef.current + 1, 3)
            : Math.max(walkCandidateRef.current - 2, -3);

          // Confident GPS-reported speed bypasses the integrator — ancak cold-start'taki
          // tek seferlik yüksek-speed glitch'ini yutmak için üst üste 2 fix şart.
          if (reportedSpeed >= CONFIDENT_WALK_SPEED_MS) {
            confidentSpeedStreakRef.current++;
          } else {
            confidentSpeedStreakRef.current = 0;
          }
          if (confidentSpeedStreakRef.current >= 2) {
            walkCandidateRef.current = Math.max(walkCandidateRef.current, 2);
            setIsWalking(true);
          } else if (walkCandidateRef.current >= 1) {
            setIsWalking(true);
          } else if (walkCandidateRef.current <= -1) {
            setIsWalking(false);
          }

          // Commit a direction candidate only after `minConfirm` consecutive
          // identical readings to suppress jitter from noisy GPS heading samples.
          // Chip heading is already sensor-fused so it commits faster than the
          // synthesized history bearing.
          const tryCommitDirection = (candidate: Direction, minConfirm: number) => {
            if (candidate === characterDirectionRef.current) {
              dirCandidateRef.current = null;
              dirCandidateCountRef.current = 0;
              return;
            }
            if (candidate === dirCandidateRef.current) {
              dirCandidateCountRef.current++;
            } else {
              dirCandidateRef.current = candidate;
              dirCandidateCountRef.current = 1;
            }
            if (dirCandidateCountRef.current >= minConfirm) {
              characterDirectionRef.current = candidate;
              setCharacterDirection(candidate);
              dirCandidateRef.current = null;
              dirCandidateCountRef.current = 0;
            }
          };

          // Primary direction source: GPS-chip heading (GPS+magnetometer fusion). More
          // accurate than position-derived bearing at low walking speeds. Falls back to
          // circular-mean history bearing when chip reports no valid heading.
          const cameraHeading = cameraHeadingRef.current;
          if (coords.heading != null && coords.heading >= 0 && speedIndicatesWalk) {
            lastAbsBearing.current = coords.heading;
            const rel = (coords.heading - cameraHeading + 360) % 360;
            tryCommitDirection(bearingToDirection(rel), DIR_CONFIRM_THRESHOLD_CHIP);
          } else if (hist.length >= 3) {
            let sumSin = 0;
            let sumCos = 0;
            let totalDist = 0;
            let segCount = 0;
            for (let i = 1; i < hist.length; i++) {
              const d = haversineMeters(
                hist[i - 1].lat, hist[i - 1].lng, hist[i].lat, hist[i].lng,
              );
              if (d < HEADING_SEGMENT_MIN_M) continue;
              const b = computeBearing(
                hist[i - 1].lat, hist[i - 1].lng, hist[i].lat, hist[i].lng,
              );
              const rad = (b * Math.PI) / 180;
              sumSin += Math.sin(rad) * d;
              sumCos += Math.cos(rad) * d;
              totalDist += d;
              segCount++;
            }
            if (segCount >= 2 && totalDist >= HEADING_MIN_TOTAL_M) {
              const mag = Math.sqrt(sumSin * sumSin + sumCos * sumCos);
              const confidence = mag / totalDist;
              if (confidence >= HEADING_MIN_CONFIDENCE) {
                const bearingAbs =
                  ((Math.atan2(sumSin, sumCos) * 180) / Math.PI + 360) % 360;
                lastAbsBearing.current = bearingAbs;
                const rel = (bearingAbs - cameraHeading + 360) % 360;
                tryCommitDirection(bearingToDirection(rel), DIR_CONFIRM_THRESHOLD);
              }
            }
          }
        },
      );
    } catch {
      // GPS servisi kapalı veya izin yok — sessizce geç
    } finally {
      watchStartingRef.current = false;
    }
  }, [cameraRef]);

  // Initial last-known fix to seed the camera.
  useEffect(() => {
    (async () => {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted') return;
      try {
        const last = await Location.getLastKnownPositionAsync();
        if (last) {
          cameraRef.current?.setCamera({
            centerCoordinate: [last.coords.longitude, last.coords.latitude],
            zoomLevel: MAP_ZOOM_DEFAULT,
            pitch: MAP_PITCH,
            animationDuration: 500,
          });
        }
      } catch {
        // GPS servisi kapalı
      }
    })();
  }, [cameraRef]);

  useEffect(() => {
    startWatching();
    return () => {
      watchSubRef.current?.remove();
      watchSubRef.current = null;
      if (stationaryTimer.current) clearTimeout(stationaryTimer.current);
    };
  }, [startWatching]);

  // iOS suspend sırasında subscription zombi kalabiliyor — foreground'a dönüşte
  // temizleyip yeniden başlatıyoruz.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (appState.current.match(/inactive|background/) && next === 'active') {
        watchSubRef.current?.remove();
        watchSubRef.current = null;
        lastAccepted.current = null;
        positionHistory.current = [];
        walkCandidateRef.current = 0;
        confidentSpeedStreakRef.current = 0;
        // Drop the chase target so the loop doesn't dead-reckon from a stale
        // velocity while we wait for the first fresh fix.
        lastFixRef.current = null;
        startWatching();
        onAppForeground?.();
      }
      appState.current = next;
    });
    return () => sub.remove();
  }, [startWatching, onAppForeground]);

  const recenter = useCallback(async () => {
    const granted = await requestForegroundLocation();
    if (!granted) return;
    try {
      const last = await Location.getLastKnownPositionAsync();
      const coords =
        last?.coords ?? (await Location.getCurrentPositionAsync({})).coords;
      const next: [number, number] = [coords.longitude, coords.latitude];
      cameraRef.current?.setCamera({
        centerCoordinate: next,
        zoomLevel: MAP_ZOOM_DEFAULT,
        pitch: MAP_PITCH,
        animationDuration: 500,
      });
      // Background'dan dönüşte stale subscription/anchor kalmış olabilir —
      // smoothing eski noktadan tween yapmasın diye anchor'ı sıfırla, karakteri
      // anında fresh konuma snap'le ve watcher'ı temiz olarak yeniden başlat.
      lastAccepted.current = null;
      positionHistory.current = [];
      walkCandidateRef.current = 0;
      confidentSpeedStreakRef.current = 0;
      lastFixRef.current = { coords: next, t: Date.now(), velocity: [0, 0] };
      displayedCoordsRef.current = next;
      setDisplayedCoords(next);
      setUserCoords(next);
      watchSubRef.current?.remove();
      watchSubRef.current = null;
      startWatching();
    } catch {
      // GPS servisi kapalı
    }
  }, [cameraRef, startWatching]);

  const onCameraHeading = useCallback((heading: number) => {
    cameraHeadingRef.current = heading;
    const charBearing = lastAbsBearing.current;
    if (charBearing == null) return;
    const rel = (charBearing - heading + 360) % 360;
    const next = bearingToDirection(rel);
    if (next !== characterDirectionRef.current) {
      characterDirectionRef.current = next;
      setCharacterDirection(next);
    }
  }, []);

  return {
    userCoords,
    displayedCoords,
    userCoordsRef,
    isWalking,
    characterDirection,
    recenter,
    onCameraHeading,
  };
}
