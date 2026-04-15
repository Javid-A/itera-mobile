import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  AppState,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { Colors, Spacing, Typography } from "../../constants";
import apiClient from "../../src/services/apiClient";
import { requestBackgroundLocation } from "../../src/services/locationSettings";
import MissionPin from "../../components/MissionPin";
import CharacterSprite, {
  type Direction,
} from "../../components/CharacterSprite";
import type { Routine } from "../../src/types/Routine";

let MapboxAvailable = false;
let Mapbox: any;
let MapView: any;
let Camera: any;
let MarkerView: any;
let FillExtrusionLayer: any;
let SymbolLayer: any;
let ShapeSource: any;
let FillLayer: any;
let LineLayer: any;

try {
  const maps = require("@rnmapbox/maps");
  Mapbox = maps.default;
  MapView = maps.MapView;
  Camera = maps.Camera;
  MarkerView = maps.MarkerView;
  FillExtrusionLayer = maps.FillExtrusionLayer;
  SymbolLayer = maps.SymbolLayer;
  ShapeSource = maps.ShapeSource;
  FillLayer = maps.FillLayer;
  LineLayer = maps.LineLayer;
  Mapbox.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? "");
  MapboxAvailable = true;
} catch {
  MapboxAvailable = false;
}

const CIRCLE_POINTS = 64;
const MAP_PITCH = 65;
const MAP_ZOOM_DEFAULT = 17.5;
const MAP_ZOOM_MIN = 17.5;
const MAP_ZOOM_MAX = 20.5;
const SHEET_COLLAPSED_HEIGHT = 72;
const SHEET_EXPANDED_HEIGHT = 300;
// ─── GPS tuning ────────────────────────────────────────────────────────────
// Switch to "indoor" when testing inside a building, "outdoor" for production.
const GPS_ENV: "indoor" | "outdoor" = "outdoor";

const GPS_CONFIG = {
  indoor: {
    GPS_ACCURACY_MAX: 60, // accept weaker fixes indoors
    MIN_MOVE_METERS: 1, // trigger on smaller steps
    WALK_START_SPEED: 0.3, // lower bar to detect walking
    WALK_STOP_SPEED: 0.1,
    BEARING_EMA_ALPHA: 0.5, // react faster to direction changes
    STATIONARY_TIMEOUT_MS: 2000,
  },
  outdoor: {
    GPS_ACCURACY_MAX: 25, // reject poor fixes
    MIN_MOVE_METERS: 2, // ignore GPS jitter
    WALK_START_SPEED: 0.7, // normal walking pace ~1.2 m/s
    WALK_STOP_SPEED: 0.3,
    BEARING_EMA_ALPHA: 0.35, // smooth bearing changes
    STATIONARY_TIMEOUT_MS: 4000,
  },
} as const;

const {
  GPS_ACCURACY_MAX,
  MIN_MOVE_METERS,
  WALK_START_SPEED,
  WALK_STOP_SPEED,
  BEARING_EMA_ALPHA,
  STATIONARY_TIMEOUT_MS,
} = GPS_CONFIG[GPS_ENV];
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

function buildGeofenceGeoJSON(routines: Routine[]) {
  const features = routines.map((r) => {
    const latRad = (r.latitude * Math.PI) / 180;
    const deltaLng = r.radiusMeters / (111320 * Math.cos(latRad));
    const deltaLat = r.radiusMeters / 110540;
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

function bearingToDirection(bearing: number): Direction {
  const b = ((bearing % 360) + 360) % 360;
  const dirs: Direction[] = ["n", "ne", "e", "se", "s", "sw", "w", "nw"];
  return dirs[Math.round(b / 45) % 8];
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

function emaAngle(prev: number | null, next: number, alpha: number): number {
  if (prev == null) return next;
  const diff = ((((next - prev) % 360) + 540) % 360) - 180;
  return (prev + alpha * diff + 360) % 360;
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
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [bgDenied, setBgDenied] = useState(false);
  const [isSheetExpanded, setIsSheetExpanded] = useState(false);
  const [userCoords, setUserCoords] = useState<[number, number] | null>(null);
  const [isWalking, setIsWalking] = useState(false);
  const [mapZoom, setMapZoom] = useState(MAP_ZOOM_DEFAULT);
  const [cameraHeading, setCameraHeading] = useState(0);
  const [charDirection, setCharDirection] = useState<Direction>("s");
  const lastAccepted = useRef<{ lng: number; lat: number; t: number } | null>(
    null,
  );
  const smoothedHeading = useRef<number | null>(null);
  const stationaryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cameraHeadingRef = useRef(0);
  const cameraRef = useRef<any>(null);
  const appState = useRef(AppState.currentState);

  const vignetteAnim = useRef(new Animated.Value(0)).current;

  const activeRoutine = useMemo(() => {
    if (!userCoords) return null;
    return (
      routines.find(
        (r) =>
          haversineMeters(
            userCoords[1],
            userCoords[0],
            r.latitude,
            r.longitude,
          ) < r.radiusMeters,
      ) ?? null
    );
  }, [userCoords, routines]);

  useEffect(() => {
    if (!activeRoutine) return;

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
  }, [activeRoutine?.id, vignetteAnim]);

  // sheetY: pixel translateY — 0 = fully expanded, DRAG_RANGE = collapsed
  const DRAG_RANGE = SHEET_EXPANDED_HEIGHT - SHEET_COLLAPSED_HEIGHT;
  const sheetY = useRef(new Animated.Value(DRAG_RANGE)).current;
  const sheetYVal = useRef(DRAG_RANGE); // tracks current pixel value for gesture math
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
          // treat as tap: toggle based on current position
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
    (routine: Routine) => {
      cameraRef.current?.setCamera({
        centerCoordinate: [routine.longitude, routine.latitude],
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

  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => {
      if (appState.current.match(/inactive|background/) && next === "active") {
        checkBg();
      }
      appState.current = next;
    });
    return () => sub.remove();
  }, [checkBg]);

  const recenter = useCallback(async () => {
    const { status } = await Location.getForegroundPermissionsAsync();
    if (status !== "granted") {
      const req = await Location.requestForegroundPermissionsAsync();
      if (req.status !== "granted") return;
    }
    const last = await Location.getLastKnownPositionAsync();
    const coords =
      last?.coords ?? (await Location.getCurrentPositionAsync({})).coords;
    cameraRef.current?.setCamera({
      centerCoordinate: [coords.longitude, coords.latitude],
      zoomLevel: MAP_ZOOM_DEFAULT,
      pitch: MAP_PITCH,
      animationDuration: 500,
    });
  }, []);

  useEffect(() => {
    (async () => {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== "granted") return;
      const last = await Location.getLastKnownPositionAsync();
      if (last) {
        cameraRef.current?.setCamera({
          centerCoordinate: [last.coords.longitude, last.coords.latitude],
          zoomLevel: MAP_ZOOM_DEFAULT,
          pitch: MAP_PITCH,
          animationDuration: 500,
        });
      }
    })();
  }, []);

  // Track user position for character sprite
  useEffect(() => {
    let sub: Location.LocationSubscription | null = null;
    (async () => {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== "granted") return;
      sub = await Location.watchPositionAsync(
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
            setUserCoords(next);
            return;
          }

          const moved = haversineMeters(
            last.lat,
            last.lng,
            coords.latitude,
            coords.longitude,
          );
          const dt = (timestamp - last.t) / 1000;

          if (moved < MIN_MOVE_METERS) {
            if (stationaryTimer.current) clearTimeout(stationaryTimer.current);
            stationaryTimer.current = setTimeout(
              () => setIsWalking(false),
              STATIONARY_TIMEOUT_MS,
            );
            return;
          }

          let speed = 0;
          if (coords.speed != null && coords.speed >= 0) speed = coords.speed;
          else if (dt > 0) speed = moved / dt;

          setIsWalking((prev) =>
            prev ? speed > WALK_STOP_SPEED : speed > WALK_START_SPEED,
          );
          setUserCoords(next);
          lastAccepted.current = {
            lng: coords.longitude,
            lat: coords.latitude,
            t: timestamp,
          };

          if (stationaryTimer.current) clearTimeout(stationaryTimer.current);
          stationaryTimer.current = setTimeout(
            () => setIsWalking(false),
            STATIONARY_TIMEOUT_MS,
          );
        },
      );
    })();
    return () => {
      sub?.remove();
      if (stationaryTimer.current) clearTimeout(stationaryTimer.current);
    };
  }, []);

  // Drive character direction from device compass — works indoors and outdoors.
  useEffect(() => {
    let sub: Location.LocationSubscription | null = null;
    (async () => {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== "granted") return;
      sub = await Location.watchHeadingAsync((heading) => {
        const raw =
          heading.trueHeading >= 0 ? heading.trueHeading : heading.magHeading;
        if (raw < 0) return; // unavailable
        smoothedHeading.current = emaAngle(
          smoothedHeading.current,
          raw,
          BEARING_EMA_ALPHA,
        );
        const relative =
          (smoothedHeading.current - cameraHeadingRef.current + 360) % 360;
        setCharDirection(bearingToDirection(relative));
      });
    })();
    return () => {
      sub?.remove();
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      apiClient
        .get("/routines")
        .then(({ data }) => setRoutines(data))
        .catch(() => {});
      checkBg();
    }, [checkBg]),
  );

  const handleBannerPress = async () => {
    const granted = await requestBackgroundLocation();
    if (granted) setBgDenied(false);
  };

  if (!MapboxAvailable) {
    return (
      <View style={styles.fallback}>
        <Text style={[Typography.h3, { color: Colors.textPrimary }]}>Map</Text>
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
        styleURL="mapbox://styles/javid-a/cmnywehfe001101qz3nmtgtsa"
        compassEnabled={false}
        logoEnabled={false}
        attributionEnabled={false}
        scaleBarEnabled={false}
        pitchEnabled={false}
        onCameraChanged={(state: any) => {
          setMapZoom(state.properties.zoom);
          const h = state.properties.heading ?? 0;
          setCameraHeading(h);
          cameraHeadingRef.current = h;
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
        <FillExtrusionLayer
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
        />
        <ShapeSource id="geofences" shape={buildGeofenceGeoJSON(routines)}>
          {/* Ground glow ring */}
          <LineLayer
            id="geofence-glow"
            style={{
              lineColor: "rgba(255, 100, 0, 0.6)",
              lineWidth: 18,
              lineBlur: 12,
            }}
          />
          <LineLayer
            id="geofence-ring"
            style={{
              lineColor: "rgba(255, 140, 60, 1)",
              lineWidth: 2,
            }}
          />
          {/* Hologram wall — stacked extrusions, height proportional to radius, opacity fades to 0 at top */}
          <FillExtrusionLayer
            id="geofence-wall-base"
            style={{
              fillExtrusionColor: Colors.accent,
              fillExtrusionHeight: ["min", ["*", ["get", "radius"], 0.05], 6],
              fillExtrusionBase: 0,
              fillExtrusionOpacity: 0.42,
              fillExtrusionVerticalGradient: true,
            }}
          />
          <FillExtrusionLayer
            id="geofence-wall-mid"
            style={{
              fillExtrusionColor: Colors.accent,
              fillExtrusionHeight: ["min", ["*", ["get", "radius"], 0.1], 14],
              fillExtrusionBase: ["min", ["*", ["get", "radius"], 0.05], 6],
              fillExtrusionOpacity: 0.22,
              fillExtrusionVerticalGradient: true,
            }}
          />
          <FillExtrusionLayer
            id="geofence-wall-top"
            style={{
              fillExtrusionColor: Colors.accent,
              fillExtrusionHeight: ["min", ["*", ["get", "radius"], 0.18], 22],
              fillExtrusionBase: ["min", ["*", ["get", "radius"], 0.1], 14],
              fillExtrusionOpacity: 0.08,
              fillExtrusionVerticalGradient: true,
            }}
          />
        </ShapeSource>
        {userCoords && (
          <MarkerView
            key="character"
            coordinate={userCoords}
            anchor={{ x: 0.5, y: 1 }}
          >
            <CharacterSprite
              isWalking={isWalking}
              direction={charDirection}
              scale={(() => {
                const base = Math.pow(2, mapZoom - 20);
                const mid = (MAP_ZOOM_MIN + MAP_ZOOM_MAX) / 2;
                const boost =
                  mapZoom < mid
                    ? 1 + ((mid - mapZoom) / (mid - MAP_ZOOM_MIN)) * 1.0
                    : 1;
                return base * boost;
              })()}
            />
          </MarkerView>
        )}
        {routines.map((routine) => (
          <MarkerView
            key={routine.id}
            coordinate={[routine.longitude, routine.latitude]}
            anchor={{ x: 0.5, y: 1 }}
          >
            <MissionPin iconType={routine.iconType} />
          </MarkerView>
        ))}
      </MapView>
      {/* Zone vignette — pulses when user is inside a geofence */}
      <Animated.View
        pointerEvents="none"
        style={[styles.vignetteBorder, { opacity: vignetteAnim }]}
      />
      <Animated.View
        pointerEvents="none"
        style={[styles.vignetteGlow, { opacity: vignetteAnim }]}
      />
      {activeRoutine && (
        <Animated.View
          pointerEvents="none"
          style={[styles.missionBadge, { opacity: vignetteAnim }]}
        >
          <Ionicons name="radio-outline" size={12} color={Colors.accent} />
          <Text
            style={[
              Typography.caption,
              {
                color: Colors.accent,
                marginLeft: Spacing.xs,
                fontWeight: "700",
                letterSpacing: 0.8,
              },
            ]}
            numberOfLines={1}
          >
            {activeRoutine.missionName.toUpperCase()}
          </Text>
        </Animated.View>
      )}
      {bgDenied && (
        <Pressable style={styles.banner} onPress={handleBannerPress}>
          <Ionicons name="warning-outline" size={16} color={Colors.accent} />
          <Text
            style={[
              Typography.caption,
              { color: Colors.textSecondary, marginLeft: Spacing.xs, flex: 1 },
            ]}
          >
            Auto-tracking is off
          </Text>
          <Text style={[Typography.caption, { color: Colors.accent }]}>
            Enable
          </Text>
        </Pressable>
      )}
      <Pressable style={styles.recenterButton} onPress={recenter} hitSlop={8}>
        <Ionicons name="locate" size={22} color={Colors.textPrimary} />
      </Pressable>
      <Animated.View
        pointerEvents={isSheetExpanded ? "auto" : "none"}
        style={[styles.backdrop, { opacity: backdropOpacity }]}
      >
        <Pressable style={{ flex: 1 }} onPress={() => snapSheet(false)} />
      </Animated.View>
      <Animated.View
        style={[styles.sheet, { transform: [{ translateY: sheetY }] }]}
      >
        <View style={styles.sheetHeader} {...panResponder.panHandlers}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetTitleRow}>
            <Text style={[Typography.label, { color: Colors.textSecondary }]}>
              {routines.length} {routines.length === 1 ? "Mission" : "Missions"}
            </Text>
            <Ionicons
              name={isSheetExpanded ? "chevron-down" : "chevron-up"}
              size={16}
              color={Colors.textSecondary}
            />
          </View>
        </View>
        <ScrollView
          style={styles.sheetList}
          scrollEnabled={isSheetExpanded}
          showsVerticalScrollIndicator={false}
        >
          {routines.map((routine) => (
            <Pressable
              key={routine.id}
              style={styles.missionRow}
              onPress={() => flyToMission(routine)}
            >
              <View style={styles.missionIconWrap}>
                <Ionicons
                  name={getIconName(routine.iconType)}
                  size={14}
                  color={Colors.textPrimary}
                />
              </View>
              <View style={styles.missionInfo}>
                <Text
                  style={[Typography.body, { color: Colors.textPrimary }]}
                  numberOfLines={1}
                >
                  {routine.missionName}
                </Text>
                <Text
                  style={[Typography.caption, { color: Colors.textSecondary }]}
                  numberOfLines={1}
                >
                  {routine.locationName}
                </Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={14}
                color={Colors.border}
              />
            </Pressable>
          ))}
        </ScrollView>
      </Animated.View>
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
  recenterButton: {
    position: "absolute",
    right: Spacing.md,
    bottom: SHEET_COLLAPSED_HEIGHT + Spacing.md,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  backdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: SHEET_COLLAPSED_HEIGHT,
    backgroundColor: "#000",
  },
  sheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: SHEET_EXPANDED_HEIGHT,
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: Colors.border,
  },
  sheetHeader: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.sm,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    backgroundColor: Colors.border,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: Spacing.sm,
  },
  sheetTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sheetList: {
    flex: 1,
  },
  missionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  missionIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: Colors.background,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  missionInfo: {
    flex: 1,
  },
  vignetteBorder: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderWidth: 3,
    borderColor: Colors.accent,
  },
  vignetteGlow: {
    position: "absolute",
    top: -6,
    left: -6,
    right: -6,
    bottom: -6,
    borderWidth: 24,
    borderColor: "rgba(255, 87, 34, 0.25)",
  },
  missionBadge: {
    position: "absolute",
    top: 52,
    alignSelf: "center",
    left: "50%",
    transform: [{ translateX: -80 }],
    width: 160,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(11, 13, 18, 0.85)",
    borderRadius: 20,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: Colors.accent,
  },
  banner: {
    position: "absolute",
    top: 50,
    left: Spacing.md,
    right: Spacing.md,
    zIndex: 10,
    elevation: 10,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderRadius: 8,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
});
