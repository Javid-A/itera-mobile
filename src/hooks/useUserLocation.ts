import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { AppState } from 'react-native';
import * as Location from 'expo-location';
import { bearingToDirection, type Direction } from '../components/CharacterSprite';
import { computeBearing, haversineMeters } from '../utils/geo';
import { requestForegroundLocation } from '../services/locationSettings';

// ─── GPS tuning ────────────────────────────────────────────────────────────
const GPS_ENV: 'indoor' | 'outdoor' = 'outdoor';
const GPS_CONFIG = {
  indoor: { GPS_ACCURACY_MAX: 60, MIN_MOVE_METERS: 1.5, STATIONARY_TIMEOUT_MS: 1500 },
  outdoor: { GPS_ACCURACY_MAX: 25, MIN_MOVE_METERS: 1.5, STATIONARY_TIMEOUT_MS: 1500 },
} as const;
const { GPS_ACCURACY_MAX, MIN_MOVE_METERS, STATIONARY_TIMEOUT_MS } = GPS_CONFIG[GPS_ENV];

const POSITION_HISTORY_MAX = 8;
const HEADING_MIN_TOTAL_M = 2.5;
const HEADING_MIN_CONFIDENCE = 0.65;
const HEADING_SEGMENT_MIN_M = 0.8;
const WALK_WINDOW_MS = 3500;
const WALK_WINDOW_MIN_M = 1.8;
const WALK_NET_MIN_M = 1.5;
const DIR_CONFIRM_THRESHOLD = 2;
const SMOOTH_ALPHA = 0.35;
const STATIONARY_SPEED_MS = 0.3;
const MARKER_TWEEN_MS = 900;
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

  const watchSubRef = useRef<Location.LocationSubscription | null>(null);
  const watchStartingRef = useRef(false);
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    userCoordsRef.current = userCoords;
  }, [userCoords]);

  // Smoothly tween rendered coords toward latest accepted GPS fix so the marker glides.
  useEffect(() => {
    if (!userCoords) return;
    const current = displayedCoordsRef.current;
    if (!current) {
      displayedCoordsRef.current = userCoords;
      setDisplayedCoords(userCoords);
      return;
    }
    const from = current;
    const to = userCoords;
    const start = Date.now();
    let raf: number | null = null;
    const step = () => {
      const t = Math.min(1, (Date.now() - start) / MARKER_TWEEN_MS);
      const eased = 1 - Math.pow(1 - t, 3);
      const lng = from[0] + (to[0] - from[0]) * eased;
      const lat = from[1] + (to[1] - from[1]) * eased;
      const next: [number, number] = [lng, lat];
      displayedCoordsRef.current = next;
      setDisplayedCoords(next);
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => {
      if (raf != null) cancelAnimationFrame(raf);
    };
  }, [userCoords]);

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
          cameraRef.current?.setCamera({
            centerCoordinate: smoothed,
            animationDuration: MARKER_TWEEN_MS,
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

          walkCandidateRef.current = wantWalk
            ? Math.min(walkCandidateRef.current + 1, 3)
            : Math.max(walkCandidateRef.current - 1, -3);

          if (walkCandidateRef.current >= 2) setIsWalking(true);
          else if (walkCandidateRef.current <= -1) setIsWalking(false);

          // Commit a direction candidate only after DIR_CONFIRM_THRESHOLD consecutive
          // identical readings to suppress jitter from noisy GPS heading samples.
          const tryCommitDirection = (candidate: Direction) => {
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
            if (dirCandidateCountRef.current >= DIR_CONFIRM_THRESHOLD) {
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
            tryCommitDirection(bearingToDirection(rel));
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
                tryCommitDirection(bearingToDirection(rel));
              }
            }
          }

          if (stationaryTimer.current) clearTimeout(stationaryTimer.current);
          stationaryTimer.current = setTimeout(
            () => setIsWalking(false),
            STATIONARY_TIMEOUT_MS,
          );
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
