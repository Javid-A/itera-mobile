import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  AppState,
  BackHandler,
  Dimensions,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect, router } from "expo-router";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { Colors, Spacing, Typography } from "../../constants";
import apiClient from "../../src/services/apiClient";
import { classifyDistance } from "../../src/config/tierConfig";
import {
  requestBackgroundLocation,
  requestForegroundLocation,
} from "../../src/services/locationSettings";
import MissionPin from "../../components/MissionPin";
import CreateMissionModal from "../../components/CreateMissionModal";
import CharacterSprite, {
  bearingToDirection,
  type Direction,
} from "../../components/CharacterSprite";
import type { Mission } from "../../src/types/Mission";

let MapboxAvailable = false;
let Mapbox: any;
let MapView: any;
let Camera: any;
let MarkerView: any;
let FillExtrusionLayer: any;
let ShapeSource: any;
let LineLayer: any;

try {
  const maps = require("@rnmapbox/maps");
  Mapbox = maps.default;
  MapView = maps.MapView;
  Camera = maps.Camera;
  MarkerView = maps.MarkerView;
  FillExtrusionLayer = maps.FillExtrusionLayer;
  ShapeSource = maps.ShapeSource;
  LineLayer = maps.LineLayer;
  Mapbox.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? "");
  MapboxAvailable = true;
} catch {
  MapboxAvailable = false;
}

const XP_PER_LEVEL = 1000;
const TIER_COLORS_ORIGINAL: Record<string, string> = {
  A: "#a6e635",
  B: "#22D3EE",
  C: "#A855F7",
};

const TIER_COLORS_TEST: Record<string, string> = {
  A: "#4de697",
  B: "#3577d6",
  C: "#685acb",
};

const TIER_COLORS = TIER_COLORS_TEST;
const CIRCLE_POINTS = 64;
const MAP_PITCH = 65;

// Horizon fog: at pitch 75° Mapbox's horizon sits around ~28% down the screen.
// We mask an ~80px band centered on that line so LOD pop-in is hidden but the
// playfield stays clean. Ratio is per-device fine; pixel band stays crisp.
const SCREEN_HEIGHT = Dimensions.get("window").height;
const HORIZON_Y_RATIO = 0.15;
const FOG_BAND_PX = 0;
const FOG_TOP_PX = Math.max(
  0,
  SCREEN_HEIGHT * HORIZON_Y_RATIO - FOG_BAND_PX / 2,
);
const MAP_ZOOM_DEFAULT = 17.5;
const MAP_ZOOM_MIN = 17.5;
const MAP_ZOOM_MAX = 20.5;
const SHEET_COLLAPSED_HEIGHT = 82;
const SHEET_EXPANDED_HEIGHT = 320;

// ─── GPS tuning ────────────────────────────────────────────────────────────
const GPS_ENV: "indoor" | "outdoor" = "outdoor";

const GPS_CONFIG = {
  indoor: {
    GPS_ACCURACY_MAX: 60,
    MIN_MOVE_METERS: 1.5,
    STATIONARY_TIMEOUT_MS: 1500,
  },
  outdoor: {
    GPS_ACCURACY_MAX: 25,
    MIN_MOVE_METERS: 1.5,
    STATIONARY_TIMEOUT_MS: 1500,
  },
} as const;

const { GPS_ACCURACY_MAX, MIN_MOVE_METERS, STATIONARY_TIMEOUT_MS } =
  GPS_CONFIG[GPS_ENV];

const POSITION_HISTORY_MAX = 8;
const HEADING_MIN_TOTAL_M = 2.5;
const HEADING_MIN_CONFIDENCE = 0.65;
const HEADING_SEGMENT_MIN_M = 0.8;
const WALK_WINDOW_MS = 3500;
const WALK_WINDOW_MIN_M = 1.8;
const WALK_NET_MIN_M = 1.5;
// Consecutive identical direction readings required before committing a new direction.
const DIR_CONFIRM_THRESHOLD = 2;
const CHARACTER_DISPLAY_SIZE = 88;
const CHARACTER_MAX_SCALE = 1.75;

// GPS smoothing: exponential low-pass on accepted fixes; speed gate freezes jitter.
const SMOOTH_ALPHA = 0.35;
const STATIONARY_SPEED_MS = 0.3;
// RAF tween duration for the character marker — matches camera animationDuration.
const MARKER_TWEEN_MS = 900;
// ───────────────────────────────────────────────────────────────────────────

const ICON_MAP: Record<string, keyof typeof Ionicons.glyphMap> = {
  briefcase: "briefcase",
  barbell: "barbell",
  cafe: "cafe",
  star: "star",
  home: "home",
  school: "school",
};

function getIconName(iconType: string): keyof typeof Ionicons.glyphMap {
  return ICON_MAP[iconType] ?? "location";
}

interface Profile {
  username: string;
  currentLevel: number;
  currentXP: number;
  totalMissions: number;
}

function buildGeofenceGeoJSON(missions: Mission[], radiusScale = 1) {
  const features = missions.map((r) => {
    const scaledRadius = r.radiusMeters * radiusScale;
    const latRad = (r.latitude * Math.PI) / 180;
    const deltaLng = scaledRadius / (111320 * Math.cos(latRad));
    const deltaLat = scaledRadius / 110540;
    const coords: [number, number][] = [];
    for (let i = 0; i <= CIRCLE_POINTS; i++) {
      const angle = (i / CIRCLE_POINTS) * 2 * Math.PI;
      coords.push([
        r.longitude + deltaLng * Math.cos(angle),
        r.latitude + deltaLat * Math.sin(angle),
      ]);
    }
    return {
      type: "Feature" as const,
      properties: { id: r.id, radius: r.radiusMeters },
      geometry: { type: "Polygon" as const, coordinates: [coords] },
    };
  });
  return { type: "FeatureCollection" as const, features };
}

function computeBearing(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const y = Math.sin(toRad(lon2 - lon1)) * Math.cos(toRad(lat2));
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.cos(toRad(lon2 - lon1));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

function haversineMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function MapScreen() {
  const [missions, setMissions] = useState<Mission[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [bgDenied, setBgDenied] = useState(false);
  const [dayTick, setDayTick] = useState(0);
  const [isSheetExpanded, setIsSheetExpanded] = useState(false);
  const [userCoords, setUserCoords] = useState<[number, number] | null>(null);
  const [displayedCoords, setDisplayedCoords] = useState<
    [number, number] | null
  >(null);
  const displayedCoordsRef = useRef<[number, number] | null>(null);
  const [isWalking, setIsWalking] = useState(false);
  const [createVisible, setCreateVisible] = useState(false);
  const [characterDirection, setCharacterDirection] = useState<Direction>("s");
  // Drive zoom-based scale via native transform to avoid setState re-renders
  // every camera frame during pinch. Translate compensates so the foot point
  // stays anchored at the layout-bottom of the 88px box (scale grows from
  // center by default, so we shift up by half the growth to pin the bottom).
  const characterScaleAnim = useRef(new Animated.Value(1)).current;
  const characterTranslateAnim = useRef(new Animated.Value(0)).current;

  // ─── Completion animation state ────────────────────────────────────────
  // Completion is the source of truth on each Mission row (status / completedAt) — fetched
  // from /missions/today. We mutate the missions array in place after a successful arrival
  // instead of maintaining a parallel Set.
  const [completingMissionId, setCompletingMissionId] = useState<string | null>(
    null,
  );
  const [completionXP, setCompletionXP] = useState(0);
  const [completionIsGreen, setCompletionIsGreen] = useState(false);
  const [completionScale, setCompletionScale] = useState(1);
  const completionRadiusAnim = useRef(new Animated.Value(1)).current;
  const greenVignetteAnim = useRef(new Animated.Value(0)).current;
  const xpToastTranslate = useRef(new Animated.Value(0)).current;
  const xpToastOpacity = useRef(new Animated.Value(0)).current;
  // ───────────────────────────────────────────────────────────────────────

  const lastAccepted = useRef<{ lng: number; lat: number; t: number } | null>(
    null,
  );
  const positionHistory = useRef<{ lng: number; lat: number; t: number }[]>([]);
  // Default world-south (180°) so camera rotation updates the sprite even
  // before the user has walked. Overwritten by actual walk bearing later.
  const lastAbsBearing = useRef<number | null>(180);
  const stationaryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cameraHeadingRef = useRef(0);
  const characterDirectionRef = useRef<Direction>("s");
  const cameraRef = useRef<any>(null);
  const appState = useRef(AppState.currentState);
  const watchSubRef = useRef<Location.LocationSubscription | null>(null);
  const watchStartingRef = useRef(false);
  const startWatchingRef = useRef<() => Promise<void>>(async () => {});
  const refreshMissionsRef = useRef<() => void>(() => {});
  const dirCandidateRef = useRef<Direction | null>(null);
  const dirCandidateCountRef = useRef(0);
  // Walk hysteresis: +1 per walk-evidence sample, -1 per idle-evidence sample.
  // Need 2 consecutive walk samples to flip on; a single idle sample flips off.
  const walkCandidateRef = useRef(0);

  const bgDeniedRef = useRef(bgDenied);
  const isCompletingRef = useRef(false);
  const prevActiveMissionIdRef = useRef<string | null>(null);
  const userCoordsRef = useRef<[number, number] | null>(null);
  const missionsRef = useRef<Mission[]>([]);

  useEffect(() => {
    bgDeniedRef.current = bgDenied;
  }, [bgDenied]);

  useEffect(() => {
    userCoordsRef.current = userCoords;
  }, [userCoords]);

  // Smoothly tween the rendered character coordinate toward the latest accepted
  // GPS fix so the marker glides instead of jumping each sample.
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

  useEffect(() => {
    missionsRef.current = missions;
  }, [missions]);

  useEffect(() => {
    const id = completionRadiusAnim.addListener(({ value }) => {
      setCompletionScale(value);
    });
    return () => completionRadiusAnim.removeListener(id);
  }, [completionRadiusAnim]);

  const vignetteAnim = useRef(new Animated.Value(0)).current;

  // Flips the local mission row to "completed" so pins/sheet update without waiting for a
  // refetch; the server is already the source of truth for the booked completion.
  const markMissionCompleted = useCallback((id: string) => {
    setMissions((prev) =>
      prev.map((m) =>
        m.id === id
          ? {
              ...m,
              status: "completed",
              completedAt: m.completedAt ?? new Date().toISOString(),
            }
          : m,
      ),
    );
  }, []);

  const activeMission = useMemo(() => {
    if (!userCoords) return null;
    return (
      missions.find(
        (m) =>
          m.status !== "completed" &&
          haversineMeters(
            userCoords[1],
            userCoords[0],
            m.latitude,
            m.longitude,
          ) < m.radiusMeters,
      ) ?? null
    );
  }, [userCoords, missions]);

  useEffect(() => {
    if (!activeMission || activeMission.id === completingMissionId) {
      vignetteAnim.stopAnimation();
      Animated.timing(vignetteAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
      return;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(vignetteAnim, {
          toValue: 0.85,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(vignetteAnim, {
          toValue: 0.4,
          duration: 900,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();

    return () => {
      loop.stop();
      Animated.timing(vignetteAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    };
  }, [activeMission?.id, completingMissionId, vignetteAnim]);

  const handleForegroundArrival = useCallback(
    async (mission: Mission, coords: [number, number]) => {
      if (isCompletingRef.current) return;
      isCompletingRef.current = true;

      setCompletingMissionId(mission.id);
      setCompletionIsGreen(false);
      completionRadiusAnim.setValue(1);

      const [, apiResult] = await Promise.all([
        new Promise<void>((resolve) => {
          Animated.timing(completionRadiusAnim, {
            toValue: 0,
            duration: 600,
            useNativeDriver: false,
          }).start(() => resolve());
        }),
        apiClient
          .post("/missions/arrive", {
            missionId: mission.id,
            latitude: coords[1],
            longitude: coords[0],
          })
          .then(
            (r) =>
              r.data as {
                earnedXP: number;
                cooldownActive?: boolean;
                missionName?: string;
                leveledUp?: boolean;
              },
          )
          .catch(() => null),
      ]);

      // If the background GeofenceTask beat us to the POST (cooldown), or the
      // call failed transiently, we still want the orange ring to stay
      // collapsed and the pin to flip to "completed" — otherwise the ring
      // springs back and the mission only appears done after a reload.
      if (!apiResult || apiResult.cooldownActive) {
        markMissionCompleted(mission.id);
        setCompletingMissionId(null);
        isCompletingRef.current = false;
        apiClient
          .get<Profile>("/profile")
          .then(({ data }) => setProfile(data))
          .catch(() => {});
        return;
      }

      const earnedXP = apiResult.earnedXP ?? 0;
      setCompletionXP(earnedXP);

      setCompletionIsGreen(true);
      completionRadiusAnim.setValue(0);

      Animated.parallel([
        Animated.timing(completionRadiusAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: false,
        }),
        Animated.timing(greenVignetteAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
      ]).start();

      xpToastTranslate.setValue(0);
      xpToastOpacity.setValue(1);
      Animated.parallel([
        Animated.timing(xpToastTranslate, {
          toValue: -80,
          duration: 1800,
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.delay(600),
          Animated.timing(xpToastOpacity, {
            toValue: 0,
            duration: 1000,
            useNativeDriver: true,
          }),
        ]),
      ]).start();

      await new Promise<void>((resolve) => setTimeout(resolve, 2500));

      await new Promise<void>((resolve) => {
        Animated.parallel([
          Animated.timing(greenVignetteAnim, {
            toValue: 0,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(completionRadiusAnim, {
            toValue: 0,
            duration: 500,
            useNativeDriver: false,
          }),
        ]).start(() => resolve());
      });

      markMissionCompleted(mission.id);
      setCompletingMissionId(null);
      isCompletingRef.current = false;

      // Refresh profile after arrival so HUD XP/level updates
      apiClient
        .get<Profile>("/profile")
        .then(({ data }) => setProfile(data))
        .catch(() => {});
    },
    [completionRadiusAnim, greenVignetteAnim, xpToastTranslate, xpToastOpacity],
  );

  useEffect(() => {
    const newId = activeMission?.id ?? null;
    const prevId = prevActiveMissionIdRef.current;

    const target = newId
      ? missionsRef.current.find((m) => m.id === newId)
      : null;
    if (
      newId !== null &&
      newId !== prevId &&
      target &&
      target.status !== "completed" &&
      !isCompletingRef.current
    ) {
      const coords = userCoordsRef.current;
      if (coords) {
        handleForegroundArrival(target, coords);
      }
    }

    prevActiveMissionIdRef.current = newId;
  }, [activeMission?.id, missions, handleForegroundArrival]);

  const mainGeofenceGeoJSON = useMemo(
    () =>
      buildGeofenceGeoJSON(
        missions.filter(
          (m) => m.id !== completingMissionId && m.status !== "completed",
        ),
      ),
    [missions, completingMissionId],
  );

  const completionGeoJSON = useMemo(() => {
    if (!completingMissionId) return null;
    const m = missions.find((mt) => mt.id === completingMissionId);
    if (!m) return null;
    return buildGeofenceGeoJSON([m], completionScale);
  }, [completingMissionId, missions, completionScale]);

  // ─── Sheet ───────────────────────────────────────────────────────────────
  const DRAG_RANGE = SHEET_EXPANDED_HEIGHT - SHEET_COLLAPSED_HEIGHT;
  const sheetY = useRef(new Animated.Value(DRAG_RANGE)).current;
  const sheetYVal = useRef(DRAG_RANGE);
  const gestureStartY = useRef(DRAG_RANGE);

  useEffect(() => {
    const id = sheetY.addListener(({ value }) => {
      sheetYVal.current = value;
    });
    return () => sheetY.removeListener(id);
  }, [sheetY]);

  const snapSheet = useCallback(
    (open: boolean) => {
      setIsSheetExpanded(open);
      Animated.spring(sheetY, {
        toValue: open ? 0 : DRAG_RANGE,
        useNativeDriver: false,
        tension: 65,
        friction: 11,
      }).start();
    },
    [sheetY, DRAG_RANGE],
  );

  useEffect(() => {
    const onBackPress = () => {
      if (isSheetExpanded) {
        snapSheet(false);
        return true; // Prevent default back action
      }
      return false; // Allow default back action
    };

    const backHandler = BackHandler.addEventListener(
      "hardwareBackPress",
      onBackPress,
    );

    return () => backHandler.remove();
  }, [isSheetExpanded, snapSheet]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dy) > 4,
      onPanResponderGrant: () => {
        gestureStartY.current = sheetYVal.current;
      },
      onPanResponderMove: (_, gs) => {
        const next = Math.max(
          0,
          Math.min(DRAG_RANGE, gestureStartY.current + gs.dy),
        );
        sheetY.setValue(next);
      },
      onPanResponderRelease: (_, { dy, vy }) => {
        if (Math.abs(dy) < 6) {
          const currentlyExpanded = sheetYVal.current < DRAG_RANGE / 2;
          snapSheet(!currentlyExpanded);
          return;
        }
        const current = sheetYVal.current;
        const fastUp = vy < -0.5;
        const fastDown = vy > 0.5;
        const pastMid = current < DRAG_RANGE / 2;
        snapSheet(fastUp || (!fastDown && pastMid));
      },
    }),
  ).current;

  const flyToMission = useCallback(
    (mission: Mission) => {
      cameraRef.current?.setCamera({
        centerCoordinate: [mission.longitude, mission.latitude],
        zoomLevel: MAP_ZOOM_DEFAULT,
        pitch: MAP_PITCH,
        animationDuration: 600,
      });
      snapSheet(false);
    },
    [snapSheet],
  );

  const backdropOpacity = sheetY.interpolate({
    inputRange: [0, DRAG_RANGE],
    outputRange: [0.45, 0],
  });

  const checkBg = useCallback(() => {
    Location.getBackgroundPermissionsAsync().then((bg) =>
      setBgDenied(bg.status !== "granted"),
    );
  }, []);

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
      startWatchingRef.current();
    } catch {
      // GPS servisi kapalı
    }
  }, []);

  useEffect(() => {
    (async () => {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== "granted") return;
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
  }, []);

  const startWatching = useCallback(async () => {
    if (watchSubRef.current || watchStartingRef.current) return;
    watchStartingRef.current = true;
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== "granted") return;
      const servicesEnabled = await Location.hasServicesEnabledAsync();
      if (!servicesEnabled) return;
      watchSubRef.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 1000,
          distanceInterval: 0,
        },
        ({ coords, timestamp }) => {
          if (coords.accuracy != null && coords.accuracy > GPS_ACCURACY_MAX) {
            return;
          }
          const next: [number, number] = [coords.longitude, coords.latitude];
          const last = lastAccepted.current;

          if (!last) {
            lastAccepted.current = {
              lng: coords.longitude,
              lat: coords.latitude,
              t: timestamp,
            };
            positionHistory.current.push({
              lng: coords.longitude,
              lat: coords.latitude,
              t: timestamp,
            });
            setUserCoords(next);
            cameraRef.current?.setCamera({
              centerCoordinate: next,
              animationDuration: 0,
            });
            return;
          }

          const moved = haversineMeters(
            last.lat,
            last.lng,
            coords.latitude,
            coords.longitude,
          );

          // Stationary gates: ignore small wobbles AND low-speed fixes.
          const reportedSpeed = coords.speed ?? -1;
          const stationaryBySpeed =
            reportedSpeed >= 0 && reportedSpeed < STATIONARY_SPEED_MS;

          // Phone's speed sensor is authoritative — kill walk state immediately
          // so GPS wobble can't keep the sprite animating in place.
          if (stationaryBySpeed) {
            if (stationaryTimer.current) clearTimeout(stationaryTimer.current);
            setIsWalking(false);
            positionHistory.current = [];
            dirCandidateRef.current = null;
            dirCandidateCountRef.current = 0;
            walkCandidateRef.current = 0;
            return;
          }

          // Accumulate history BEFORE the distance gate so slow walkers
          // still build up data for direction tracking.
          const hist = positionHistory.current;
          hist.push({
            lng: coords.longitude,
            lat: coords.latitude,
            t: timestamp,
          });
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

          // Time-normalized exponential low-pass: weight alpha by elapsed time so
          // irregular GPS intervals don't produce inconsistent position jumps.
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
          lastAccepted.current = {
            lng: smoothedLng,
            lat: smoothedLat,
            t: timestamp,
          };

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
                hist[i - 1].lat,
                hist[i - 1].lng,
                hist[i].lat,
                hist[i].lng,
              );
            }
            if (firstIdx < hist.length - 1) {
              netDisplacement = haversineMeters(
                hist[firstIdx].lat,
                hist[firstIdx].lng,
                hist[hist.length - 1].lat,
                hist[hist.length - 1].lng,
              );
            }
          }

          const speedIndicatesWalk =
            reportedSpeed < 0 || reportedSpeed >= STATIONARY_SPEED_MS;

          // Scale walk thresholds by GPS accuracy so noisy fixes can't fake walking.
          // accuracy=5m → floor (1.8/1.5); accuracy=20m → 10m/8m required.
          const accuracyFloor = coords.accuracy ?? GPS_ACCURACY_MAX;
          const windowMin = Math.max(WALK_WINDOW_MIN_M, accuracyFloor * 0.5);
          const netMin = Math.max(WALK_NET_MIN_M, accuracyFloor * 0.4);

          const wantWalk =
            windowDist >= windowMin &&
            netDisplacement >= netMin &&
            speedIndicatesWalk;

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

          // Primary direction source: GPS-chip heading (GPS + magnetometer fusion).
          // More accurate than bearing derived from position history, especially at
          // low walking speeds. Falls back to circular-mean history bearing when the
          // chip reports no valid heading (heading < 0).
          if (
            coords.heading != null &&
            coords.heading >= 0 &&
            speedIndicatesWalk
          ) {
            lastAbsBearing.current = coords.heading;
            const rel = (coords.heading - cameraHeadingRef.current + 360) % 360;
            tryCommitDirection(bearingToDirection(rel));
          } else if (hist.length >= 3) {
            let sumSin = 0;
            let sumCos = 0;
            let totalDist = 0;
            let segCount = 0;
            for (let i = 1; i < hist.length; i++) {
              const d = haversineMeters(
                hist[i - 1].lat,
                hist[i - 1].lng,
                hist[i].lat,
                hist[i].lng,
              );
              if (d < HEADING_SEGMENT_MIN_M) continue;
              const b = computeBearing(
                hist[i - 1].lat,
                hist[i - 1].lng,
                hist[i].lat,
                hist[i].lng,
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
                const rel = (bearingAbs - cameraHeadingRef.current + 360) % 360;
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
  }, []);

  useEffect(() => {
    startWatchingRef.current = startWatching;
  }, [startWatching]);

  useEffect(() => {
    startWatching();
    return () => {
      watchSubRef.current?.remove();
      watchSubRef.current = null;
      if (stationaryTimer.current) clearTimeout(stationaryTimer.current);
    };
  }, [startWatching]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => {
      if (appState.current.match(/inactive|background/) && next === "active") {
        checkBg();
        // iOS suspend sırasında subscription zombi kalabiliyor — temizle ki
        // startWatching() gerçekten yeni bir watchPositionAsync açsın.
        watchSubRef.current?.remove();
        watchSubRef.current = null;
        lastAccepted.current = null;
        positionHistory.current = [];
        startWatching();
        // Background'dan dönerken gün değişmiş olabilir veya geofence task
        // arka planda mission tamamlamış olabilir — Set'i sunucudan tazele.
        refreshMissionsRef.current();
      }
      appState.current = next;
    });
    return () => sub.remove();
  }, [checkBg, startWatching]);

  const refreshMissions = useCallback(() => {
    apiClient
      .get<Mission[]>("/missions/today")
      .then(({ data }) => {
        const mappedMissions = data.map((m) => {
          const tierInfo = classifyDistance(m.anchorDistanceMeters);
          return {
            ...m,
            tier: tierInfo.tier,
            potentialXP: tierInfo.potentialXP,
          };
        });
        setMissions(mappedMissions);
      })
      .catch(() => {});
  }, []);

  const deleteMission = useCallback(
    (id: string) => {
      setMissions((prev) => prev.filter((m) => m.id !== id));
      apiClient.delete(`/missions/${id}`).catch(() => refreshMissions());
    },
    [refreshMissions],
  );

  useEffect(() => {
    refreshMissionsRef.current = refreshMissions;
  }, [refreshMissions]);

  useFocusEffect(
    useCallback(() => {
      refreshMissions();
      apiClient
        .get<Profile>("/profile")
        .then(({ data }) => setProfile(data))
        .catch(() => {});
      checkBg();
    }, [checkBg, refreshMissions]),
  );

  // App'in açık kaldığı sırada gece yarısı geçerse: yeni günün missionları
  // (artık server tarafından user TZ'sinde belirleniyor) çekilsin, dünün
  // missionları otomatik düşsün. dayTick yalnızca bir sonraki midnight için
  // timer'ı yeniden kurmaya yarar.
  useEffect(() => {
    const now = new Date();
    const nextMidnight = new Date(now);
    nextMidnight.setHours(24, 0, 0, 100);
    const msUntilMidnight = nextMidnight.getTime() - now.getTime();
    const timer = setTimeout(() => {
      refreshMissions();
      setDayTick((v) => v + 1);
    }, msUntilMidnight);
    return () => clearTimeout(timer);
  }, [dayTick, refreshMissions]);

  const handleBannerPress = async () => {
    const granted = await requestBackgroundLocation();
    if (granted) setBgDenied(false);
  };

  const xpForLevel = (profile?.currentLevel ?? 1) * XP_PER_LEVEL;
  const xpProgress = profile ? Math.min(1, profile.currentXP / xpForLevel) : 0;

  if (!MapboxAvailable) {
    return (
      <View style={styles.fallback}>
        <Text style={[Typography.displayMD, { color: Colors.textPrimary }]}>
          Map
        </Text>
        <Text
          style={[
            Typography.caption,
            { color: Colors.textSecondary, marginTop: 8 },
          ]}
        >
          Mapbox requires a development build.
        </Text>
        <Text style={[Typography.caption, { color: Colors.textSecondary }]}>
          Run: npx expo run:ios or npx expo run:android
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.map}>
      <MapView
        style={styles.map}
        styleURL="mapbox://styles/javid-a/cmnywehfe001101qz3nmtgtsa" //day
        // styleURL="mapbox://styles/javid-a/cmoal7c4v006f01sec32x0zn9" // dusk
        // styleURL="mapbox://styles/javid-a/cmocu50oc000e01r653oydk4q" // night - copy
        // styleURL="mapbox://styles/javid-a/cmod7nmgy001301r6dqrp2luq" // night
        compassEnabled={false}
        logoEnabled={false}
        attributionEnabled={false}
        scaleBarEnabled={false}
        pitchEnabled={false}
        rotateEnabled={true}
        onCameraChanged={(state: any) => {
          const heading = state.properties.heading ?? 0;
          cameraHeadingRef.current = heading;
          const charBearing = lastAbsBearing.current;
          if (charBearing != null) {
            const rel = (charBearing - heading + 360) % 360;
            const nextDir = bearingToDirection(rel);
            if (nextDir !== characterDirectionRef.current) {
              characterDirectionRef.current = nextDir;
              setCharacterDirection(nextDir);
            }
          }
          // Scale character with zoom: 1.0x at MAP_ZOOM_MIN → MAX at MAP_ZOOM_MAX.
          // Pushed through Animated.Value → native transform; no React render.
          const zoom = state.properties.zoom ?? MAP_ZOOM_MIN;
          const zoomT = Math.max(
            0,
            Math.min(1, (zoom - MAP_ZOOM_MIN) / (MAP_ZOOM_MAX - MAP_ZOOM_MIN)),
          );
          const nextScale = 1 + zoomT * (CHARACTER_MAX_SCALE - 1);
          characterScaleAnim.setValue(nextScale);
          characterTranslateAnim.setValue(
            (-CHARACTER_DISPLAY_SIZE * (nextScale - 1)) / 2,
          );
        }}
      >
        <Camera
          ref={cameraRef}
          defaultSettings={{
            centerCoordinate: [13.405, 52.52],
            zoomLevel: MAP_ZOOM_DEFAULT,
            pitch: MAP_PITCH,
            heading: 0,
          }}
          minZoomLevel={MAP_ZOOM_MIN}
          maxZoomLevel={MAP_ZOOM_MAX}
        />
        {/* <FillExtrusionLayer
          id="building-extrusions-3d"
          sourceID="composite"
          sourceLayerID="building"
          minZoomLevel={11}
          style={{
            fillExtrusionColor: "#1E2128",
            fillExtrusionHeight: ["coalesce", ["get", "height"], 0],
            fillExtrusionBase: ["coalesce", ["get", "min_height"], 0],
            fillExtrusionOpacity: 0.85,
            fillExtrusionVerticalGradient: true,
          }}
        /> */}

        <ShapeSource id="geofences" shape={mainGeofenceGeoJSON}>
          <LineLayer
            id="geofence-glow"
            style={{
              lineColor: "rgba(249, 115, 22, 0.6)",
              lineWidth: 18,
              lineBlur: 12,
            }}
          />
          <LineLayer
            id="geofence-ring"
            style={{
              lineColor: "rgba(255, 160, 80, 1)",
              lineWidth: 2,
            }}
          />
          <FillExtrusionLayer
            id="geofence-wall-base"
            style={{
              fillExtrusionColor: Colors.orange,
              fillExtrusionHeight: ["min", ["*", ["get", "radius"], 0.05], 6],
              fillExtrusionBase: 0,
              fillExtrusionOpacity: 0.42,
              fillExtrusionVerticalGradient: true,
            }}
          />
          <FillExtrusionLayer
            id="geofence-wall-mid"
            style={{
              fillExtrusionColor: Colors.orange,
              fillExtrusionHeight: ["min", ["*", ["get", "radius"], 0.1], 14],
              fillExtrusionBase: ["min", ["*", ["get", "radius"], 0.05], 6],
              fillExtrusionOpacity: 0.22,
              fillExtrusionVerticalGradient: true,
            }}
          />
          <FillExtrusionLayer
            id="geofence-wall-top"
            style={{
              fillExtrusionColor: Colors.orange,
              fillExtrusionHeight: ["min", ["*", ["get", "radius"], 0.18], 22],
              fillExtrusionBase: ["min", ["*", ["get", "radius"], 0.1], 14],
              fillExtrusionOpacity: 0.08,
              fillExtrusionVerticalGradient: true,
            }}
          />
        </ShapeSource>

        {completingMissionId && completionGeoJSON && (
          <ShapeSource id="completion-ring" shape={completionGeoJSON}>
            <LineLayer
              id="completion-ring-glow"
              style={{
                lineColor: completionIsGreen
                  ? "rgba(34, 197, 94, 0.6)"
                  : "rgba(249, 115, 22, 0.6)",
                lineWidth: 18,
                lineBlur: 12,
              }}
            />
            <LineLayer
              id="completion-ring-line"
              style={{
                lineColor: completionIsGreen
                  ? "rgba(34, 197, 94, 1)"
                  : "rgba(255, 160, 80, 1)",
                lineWidth: 2,
              }}
            />
            <FillExtrusionLayer
              id="completion-wall-base"
              style={{
                fillExtrusionColor: completionIsGreen
                  ? Colors.success
                  : Colors.orange,
                fillExtrusionHeight: ["min", ["*", ["get", "radius"], 0.05], 6],
                fillExtrusionBase: 0,
                fillExtrusionOpacity: completionIsGreen ? 0.55 : 0.42,
                fillExtrusionVerticalGradient: true,
              }}
            />
            <FillExtrusionLayer
              id="completion-wall-mid"
              style={{
                fillExtrusionColor: completionIsGreen
                  ? Colors.success
                  : Colors.orange,
                fillExtrusionHeight: ["min", ["*", ["get", "radius"], 0.1], 14],
                fillExtrusionBase: ["min", ["*", ["get", "radius"], 0.05], 6],
                fillExtrusionOpacity: completionIsGreen ? 0.35 : 0.22,
                fillExtrusionVerticalGradient: true,
              }}
            />
            <FillExtrusionLayer
              id="completion-wall-top"
              style={{
                fillExtrusionColor: completionIsGreen
                  ? Colors.success
                  : Colors.orange,
                fillExtrusionHeight: [
                  "min",
                  ["*", ["get", "radius"], 0.18],
                  22,
                ],
                fillExtrusionBase: ["min", ["*", ["get", "radius"], 0.1], 14],
                fillExtrusionOpacity: completionIsGreen ? 0.18 : 0.08,
                fillExtrusionVerticalGradient: true,
              }}
            />
          </ShapeSource>
        )}

        {(displayedCoords ?? userCoords) && (
          <MarkerView
            coordinate={(displayedCoords ?? userCoords) as [number, number]}
            anchor={{ x: 0.5, y: 0.85 }}
            allowOverlap
          >
            <View collapsable={false} pointerEvents="none">
              <Animated.View
                style={{
                  transform: [
                    { translateY: characterTranslateAnim },
                    { scale: characterScaleAnim },
                  ],
                }}
              >
                <CharacterSprite
                  isWalking={isWalking}
                  direction={characterDirection}
                  displaySize={CHARACTER_DISPLAY_SIZE}
                />
              </Animated.View>
            </View>
          </MarkerView>
        )}
        {missions.map((mission) => (
          <MarkerView
            key={mission.id}
            coordinate={[mission.longitude, mission.latitude]}
            anchor={{ x: 0.5, y: 1 }}
          >
            <MissionPin
              iconType={mission.iconType}
              completed={mission.status === "completed"}
              tier={mission.tier}
            />
          </MarkerView>
        ))}
      </MapView>

      {/* Horizon fog — tight band centered on the horizon line */}
      <LinearGradient
        pointerEvents="none"
        colors={[
          "rgba(8, 10, 20, 0)",
          "rgba(14, 18, 32, 0.85)",
          "rgba(20, 26, 42, 0.9)",
          "rgba(14, 18, 32, 0.55)",
          "rgba(8, 10, 20, 0)",
        ]}
        locations={[0, 0.35, 0.5, 0.7, 1]}
        style={styles.horizonFog}
      />

      {/* Vignettes */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.vignetteBorder,
          { opacity: vignetteAnim, borderColor: Colors.orange },
        ]}
      />
      <Animated.View
        pointerEvents="none"
        style={[
          styles.vignetteGlow,
          { opacity: vignetteAnim, borderColor: "rgba(249, 115, 22, 0.25)" },
        ]}
      />
      <Animated.View
        pointerEvents="none"
        style={[
          styles.vignetteBorder,
          { opacity: greenVignetteAnim, borderColor: Colors.success },
        ]}
      />
      <Animated.View
        pointerEvents="none"
        style={[
          styles.vignetteGlow,
          {
            opacity: greenVignetteAnim,
            borderColor: "rgba(34, 197, 94, 0.25)",
          },
        ]}
      />

      {/* ── Top HUD: Level / XP bar ── */}
      <View style={styles.topHud} pointerEvents="box-none">
        <Pressable onPress={() => router.push("/profile")}>
          <BlurView
            intensity={45}
            tint="dark"
            style={styles.hudCard}
            experimentalBlurMethod="dimezisBlurView"
          >
            <BlurView
              intensity={30}
              tint="light"
              style={styles.levelChip}
              experimentalBlurMethod="dimezisBlurView"
            >
              <Text style={[Typography.statMD, { color: Colors.accent }]}>
                {profile?.currentLevel ?? 1}
              </Text>
            </BlurView>
            <View style={{ flex: 1 }}>
              <View style={styles.hudLabelRow}>
                <Text style={styles.hudLevelLabel}>
                  LEVEL {profile?.currentLevel ?? 1}
                </Text>
                <Text style={[Typography.statSM, { color: Colors.accent }]}>
                  {(profile?.currentXP ?? 0).toLocaleString()} /{" "}
                  {xpForLevel.toLocaleString()} XP
                </Text>
              </View>
              <View style={styles.xpTrack}>
                <View
                  style={[styles.xpFill, { width: `${xpProgress * 100}%` }]}
                />
              </View>
            </View>
            <Ionicons
              name="chevron-forward"
              size={16}
              color={Colors.textSecondary}
            />
          </BlurView>
        </Pressable>

        {(missions.length > 0 &&
          missions.every((m) => m.status !== "completed")) ||
        bgDenied ? (
          <View style={styles.hudPillRow}>
            {missions.length > 0 &&
              missions.every((m) => m.status !== "completed") && (
                <BlurView
                  intensity={45}
                  tint="dark"
                  style={styles.hudPill}
                  experimentalBlurMethod="dimezisBlurView"
                >
                  <Text style={styles.hudPillFlame}>🔥</Text>
                  <Text style={styles.hudPillText}>STREAK AT RISK</Text>
                  <View style={styles.hudPillBadge}>
                    <Text style={styles.hudPillBadgeText}>7D</Text>
                  </View>
                </BlurView>
              )}
            {bgDenied && (
              <Pressable
                style={{ borderRadius: 999, overflow: "hidden" }}
                onPress={handleBannerPress}
              >
                <BlurView
                  intensity={45}
                  tint="dark"
                  style={[styles.hudPill, styles.hudPillWarning]}
                  experimentalBlurMethod="dimezisBlurView"
                >
                  <Ionicons
                    name="warning-outline"
                    size={13}
                    color={Colors.orange}
                  />
                  <Text style={[styles.hudPillText, { color: Colors.orange }]}>
                    AUTO-TRACKING OFF
                  </Text>
                  <Text style={styles.hudPillEnable}>FIX</Text>
                </BlurView>
              </Pressable>
            )}
          </View>
        ) : null}
      </View>

      {/* Active mission badge */}
      {activeMission && !completingMissionId && (
        <Animated.View
          pointerEvents="none"
          style={[styles.missionBadge, { opacity: vignetteAnim }]}
        >
          <Ionicons name="radio-outline" size={12} color={Colors.orange} />
          <Text
            style={[
              Typography.label,
              { color: Colors.orange, marginLeft: Spacing.xs },
            ]}
            numberOfLines={1}
          >
            {activeMission.missionName.toUpperCase()}
          </Text>
        </Animated.View>
      )}

      {/* XP toast */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.xpToastContainer,
          {
            opacity: xpToastOpacity,
            transform: [{ translateY: xpToastTranslate }],
          },
        ]}
      >
        <View style={styles.xpToastBadge}>
          <Ionicons name="star" size={16} color={Colors.success} />
          <Text style={styles.xpToastText}>+{completionXP} XP</Text>
        </View>
      </Animated.View>

      {/* Recenter */}
      <View
        style={styles.recenterButtonWrapper}
        pointerEvents={isSheetExpanded ? "none" : "auto"}
      >
        <Pressable style={styles.recenterButton} onPress={recenter} hitSlop={8}>
          <Ionicons name="locate" size={22} color={Colors.textPrimary} />
        </Pressable>
      </View>

      {/* FAB */}
      <View
        style={styles.fabWrapper}
        pointerEvents={isSheetExpanded ? "none" : "auto"}
      >
        <Pressable
          style={styles.fab}
          onPress={() => setCreateVisible(true)}
          hitSlop={8}
        >
          <Ionicons name="add" size={26} color={Colors.background} />
        </Pressable>
      </View>

      {/* Backdrop */}
      <Animated.View
        pointerEvents={isSheetExpanded ? "auto" : "none"}
        style={[styles.backdrop, { opacity: backdropOpacity }]}
      >
        <Pressable style={{ flex: 1 }} onPress={() => snapSheet(false)} />
      </Animated.View>

      {/* Bottom sheet */}
      <Animated.View
        style={[styles.sheet, { transform: [{ translateY: sheetY }] }]}
      >
        <View style={styles.sheetHeader} {...panResponder.panHandlers}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetTitleRow}>
            <Text style={[Typography.displaySM, { color: Colors.textPrimary }]}>
              Active Missions
            </Text>
            <View style={styles.countPill}>
              <Text style={[Typography.label, { color: Colors.accent }]}>
                {missions.filter((m) => m.status !== "completed").length} ACTIVE
              </Text>
            </View>
          </View>
        </View>
        <ScrollView
          style={styles.sheetList}
          scrollEnabled={isSheetExpanded}
          showsVerticalScrollIndicator={false}
        >
          {missions.filter((m) => m.status !== "completed").length === 0 ? (
            <View style={styles.emptySheet}>
              <Text
                style={[
                  Typography.body,
                  { color: Colors.textSecondary, textAlign: "center" },
                ]}
              >
                No missions yet. Tap the + button to add your first.
              </Text>
            </View>
          ) : (
            missions
              .filter((m) => m.status !== "completed")
              .map((mission, i) => (
                <Pressable
                  key={mission.id}
                  style={[styles.missionRow, i > 0 && styles.missionRowBorder]}
                  onPress={() => flyToMission(mission)}
                >
                  <View
                    style={[
                      styles.missionIconWrap,
                      {
                        backgroundColor: `${TIER_COLORS[mission.tier] ?? Colors.accent}1F`,
                        borderColor: `${TIER_COLORS[mission.tier] ?? Colors.accent}66`,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.missionIconDot,
                        {
                          backgroundColor:
                            TIER_COLORS[mission.tier] ?? Colors.accent,
                          shadowColor:
                            TIER_COLORS[mission.tier] ?? Colors.accent,
                        },
                      ]}
                    />
                  </View>
                  <View style={styles.missionInfo}>
                    <Text
                      style={[
                        Typography.bodyMedium,
                        { color: Colors.textPrimary },
                      ]}
                      numberOfLines={1}
                    >
                      {mission.missionName}
                    </Text>
                    <Text
                      style={[
                        Typography.caption,
                        { color: Colors.textSecondary },
                      ]}
                      numberOfLines={1}
                    >
                      {mission.locationName}
                    </Text>
                  </View>
                  <Text
                    style={[
                      Typography.statSM,
                      { color: TIER_COLORS[mission.tier] ?? Colors.accent },
                    ]}
                  >
                    +{mission.potentialXP} XP
                  </Text>
                  <Pressable
                    style={styles.deleteMissionBtn}
                    onPress={() => deleteMission(mission.id)}
                    hitSlop={8}
                  >
                    <Ionicons
                      name="trash-outline"
                      size={16}
                      color={Colors.textSecondary}
                    />
                  </Pressable>
                </Pressable>
              ))
          )}
        </ScrollView>
      </Animated.View>

      <CreateMissionModal
        visible={createVisible}
        onClose={() => setCreateVisible(false)}
        onCreated={refreshMissions}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  map: {
    flex: 1,
  },
  fallback: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  topHud: {
    position: "absolute",
    top: 58,
    left: Spacing.md,
    right: Spacing.md,
    zIndex: 10,
  },
  hudCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(11, 14, 26, 0.45)",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    gap: 12,
    overflow: "hidden",
  },
  hudLevelLabel: {
    fontFamily: "Rajdhani_700Bold",
    fontSize: 11,
    letterSpacing: 1.6,
    color: Colors.textSecondary,
  },
  hudPillRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
  },
  hudPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(20, 14, 8, 0.4)",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(249, 115, 22, 0.35)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    overflow: "hidden",
  },
  hudPillWarning: {
    backgroundColor: "rgba(11, 14, 26, 0.4)",
    borderColor: "rgba(249, 115, 22, 0.35)",
  },
  hudPillFlame: {
    fontSize: 13,
  },
  hudPillText: {
    fontFamily: "Rajdhani_700Bold",
    fontSize: 11,
    letterSpacing: 1.2,
    color: Colors.orange,
  },
  hudPillBadge: {
    backgroundColor: Colors.orange,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  hudPillBadgeText: {
    fontFamily: "Rajdhani_700Bold",
    fontSize: 10,
    color: "#1a0f06",
    letterSpacing: 0.5,
  },
  hudPillEnable: {
    fontFamily: "Rajdhani_700Bold",
    fontSize: 11,
    letterSpacing: 1,
    color: Colors.accent,
  },
  levelChip: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(141, 232, 58, 0.12)",
    borderWidth: 1.5,
    borderColor: "rgba(141, 232, 58, 0.4)",
    overflow: "hidden",
  },
  hudLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 5,
  },
  xpTrack: {
    height: 5,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 3,
    overflow: "hidden",
  },
  xpFill: {
    height: "100%",
    backgroundColor: Colors.accent,
    borderRadius: 3,
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 6,
  },
  missionBadge: {
    position: "absolute",
    top: 132,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(11, 13, 18, 0.85)",
    borderRadius: 20,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: Colors.orange,
  },
  recenterButtonWrapper: {
    position: "absolute",
    right: 0,
    bottom: 0,
    zIndex: 15,
    elevation: 15,
  },
  recenterButton: {
    position: "absolute",
    right: Spacing.md,
    bottom: SHEET_COLLAPSED_HEIGHT + Spacing.md + 64,
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: "rgba(11, 14, 26, 0.9)",
    borderWidth: 1,
    borderColor: Colors.borderBright,
    alignItems: "center",
    justifyContent: "center",
  },
  fabWrapper: {
    position: "absolute",
    right: 0,
    bottom: 0,
    zIndex: 15,
    elevation: 15,
  },
  fab: {
    position: "absolute",
    right: Spacing.md,
    bottom: SHEET_COLLAPSED_HEIGHT + Spacing.md,
    width: 54,
    height: 54,
    borderRadius: 17,
    backgroundColor: Colors.accent,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
  },
  backdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: SHEET_COLLAPSED_HEIGHT,
    backgroundColor: "#000",
    zIndex: 20,
    elevation: 20,
  },
  sheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: SHEET_EXPANDED_HEIGHT,
    backgroundColor: "rgba(6, 7, 14, 0.96)",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: Colors.borderBright,
    zIndex: 25,
    elevation: 25,
  },
  sheetHeader: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.sm,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: Colors.muted,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: Spacing.sm,
  },
  sheetTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  countPill: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 20,
    backgroundColor: "rgba(141, 232, 58, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(141, 232, 58, 0.4)",
  },
  sheetList: {
    flex: 1,
  },
  emptySheet: {
    padding: Spacing.xl,
    alignItems: "center",
  },
  missionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
  },
  missionRowBorder: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  missionIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
    borderWidth: 1,
  },
  missionIconDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.accent,
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
  },
  missionInfo: {
    flex: 1,
  },
  deleteMissionBtn: {
    marginLeft: Spacing.sm,
    padding: 4,
  },
  horizonFog: {
    position: "absolute",
    top: FOG_TOP_PX,
    left: 0,
    right: 0,
    height: FOG_BAND_PX,
    zIndex: 5,
  },
  vignetteBorder: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderWidth: 3,
  },
  vignetteGlow: {
    position: "absolute",
    top: -6,
    left: -6,
    right: -6,
    bottom: -6,
    borderWidth: 24,
  },
  xpToastContainer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: "48%",
    alignItems: "center",
  },
  xpToastBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: "rgba(11, 13, 18, 0.92)",
    borderRadius: 28,
    borderWidth: 1.5,
    borderColor: Colors.success,
    shadowColor: Colors.success,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 16,
    elevation: 10,
  },
  xpToastText: {
    color: Colors.success,
    fontFamily: "Rajdhani_700Bold",
    fontSize: 28,
    letterSpacing: 2,
  },
});
