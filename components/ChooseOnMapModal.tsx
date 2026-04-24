import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { Colors, Spacing, Typography } from "../constants";
import { classifyDistance, haversineMeters } from "../src/config/tierConfig";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";

let MapboxAvailable = false;
let MapView: any;
let Camera: any;
let MarkerView: any;
let ShapeSource: any;
let FillLayer: any;
let LineLayer: any;
let Mapbox: any;

try {
  const maps = require("@rnmapbox/maps");
  Mapbox = maps.default;
  MapView = maps.MapView;
  Camera = maps.Camera;
  MarkerView = maps.MarkerView;
  ShapeSource = maps.ShapeSource;
  FillLayer = maps.FillLayer;
  LineLayer = maps.LineLayer;
  Mapbox.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? "");
  MapboxAvailable = true;
} catch {
  MapboxAvailable = false;
}

const TIER_COLORS = { A: "#a6e635", B: "#22D3EE", C: "#A855F7" } as const;

function ringCoords(
  lng: number,
  lat: number,
  r: number,
  steps = 64,
): [number, number][] {
  const c: [number, number][] = [];
  const k = 111320 * Math.cos((lat * Math.PI) / 180);
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * 2 * Math.PI;
    c.push([lng + (r * Math.cos(a)) / k, lat + (r * Math.sin(a)) / 111320]);
  }
  c.push(c[0]);
  return c;
}

function createCircleGeoJSON(lng: number, lat: number, r: number) {
  return {
    type: "Feature" as const,
    geometry: {
      type: "Polygon" as const,
      coordinates: [ringCoords(lng, lat, r)],
    },
    properties: {},
  };
}

function createAnnulusGeoJSON(
  lng: number,
  lat: number,
  innerR: number,
  outerR: number,
) {
  return {
    type: "Feature" as const,
    geometry: {
      type: "Polygon" as const,
      coordinates: [
        ringCoords(lng, lat, outerR),
        ringCoords(lng, lat, innerR).slice().reverse(),
      ],
    },
    properties: {},
  };
}

// B sınırından dışa doğru radyal degrade için birden fazla annulus üret.
// Sınıra yakın en parlak, uzaklaştıkça sönüyor (quadratic falloff).
function createGradientStops(
  lng: number,
  lat: number,
  innerR: number,
  outerR: number,
  peakOpacity: number,
  steps = 14,
) {
  const stops: {
    feature: ReturnType<typeof createAnnulusGeoJSON>;
    opacity: number;
  }[] = [];
  for (let i = 0; i < steps; i++) {
    const t0 = i / steps;
    const t1 = (i + 1) / steps;
    // Eases: inner radii are packed tightly near B, outer stretch further away
    const easeRadius = (t: number) => Math.pow(t, 1.4);
    const r0 = innerR + (outerR - innerR) * easeRadius(t0);
    const r1 = innerR + (outerR - innerR) * easeRadius(t1);
    const opacity = peakOpacity * Math.pow(1 - t0, 2);
    stops.push({
      feature: createAnnulusGeoJSON(lng, lat, r0, r1),
      opacity,
    });
  }
  return stops;
}

export type LocationResult = {
  id: string;
  name: string;
  lat: number;
  lng: number;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  onConfirm: (location: { name: string; lat: number; lng: number }) => void;
  recentResults: LocationResult[];
  initialLocation?: { name: string; lat: number; lng: number } | null;
};

export default function ChooseOnMapModal({
  visible,
  onClose,
  onConfirm,
  recentResults,
  initialLocation,
}: Props) {
  const cameraRef = useRef<any>(null);
  const [pinCoord, setPinCoord] = useState<[number, number] | null>(null);
  const [pinName, setPinName] = useState("");
  const [geocoding, setGeocoding] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [userCoord, setUserCoord] = useState<[number, number] | null>(null);
  const [scaleLabel, setScaleLabel] = useState("");
  const BERLIN: [number, number] = [13.405, 52.52];
  const TOKYO: [number, number] = [139.6917, 35.6895];
  const initRef = useRef(false);

  useEffect(() => {
    if (!visible) {
      initRef.current = false;
      setUserCoord(null);
      return;
    }
    if (visible && !initRef.current) {
      initRef.current = true;
      if (initialLocation) {
        setPinCoord([initialLocation.lng, initialLocation.lat]);
        setPinName(initialLocation.name);

        // Match ID from recent results if possible
        const matchedId = recentResults.find(
          (r) => r.lat === initialLocation.lat && r.lng === initialLocation.lng,
        )?.id;
        setSelectedId(matchedId ?? null);

        // Small delay to ensure camera ref is ready
        setTimeout(() => {
          cameraRef.current?.setCamera({
            centerCoordinate: [initialLocation.lng, initialLocation.lat],
            zoomLevel: 14,
            animationDuration: 600,
          });
        }, 100);
      } else {
        setPinCoord(null);
        setPinName("");
        setSelectedId(null);
      }
    }
  }, [visible, initialLocation, recentResults]);

  const tierZones = useMemo(() => {
    if (!userCoord) return null;
    const [lng, lat] = userCoord;
    const cosLat = Math.cos((lat * Math.PI) / 180);
    return {
      A: createCircleGeoJSON(lng, lat, 1000),
      B: createCircleGeoJSON(lng, lat, 5000),
      B_ring: createAnnulusGeoJSON(lng, lat, 1000, 5000),
      C_gradient: createGradientStops(lng, lat, 5000, 22000, 0.6, 14),
      // Etiketler kendi border'ının hemen DIŞINDA duruyor (radius'u görsel olarak işaretliyor)
      A_label: [lng + 1050 / (111320 * cosLat), lat] as [number, number],
      B_label: [lng + 5100 / (111320 * cosLat), lat] as [number, number],
      C_label: [lng + 7500 / (111320 * cosLat), lat - 1800 / 111320] as [
        number,
        number,
      ],
    };
  }, [userCoord]);

  const pinTier = useMemo(
    () =>
      pinCoord && userCoord
        ? classifyDistance(
            haversineMeters(
              userCoord[1],
              userCoord[0],
              pinCoord[1],
              pinCoord[0],
            ),
          )
        : null,
    [pinCoord, userCoord],
  );

  useEffect(() => {
    if (!visible) return;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") return;
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        const coord: [number, number] = [
          loc.coords.longitude,
          loc.coords.latitude,
        ];
        setUserCoord(coord);

        // Only fly to user coord if there is no initial pin location selected
        if (!initialLocation && !pinCoord) {
          cameraRef.current?.setCamera({
            centerCoordinate: coord,
            zoomLevel: 10,
            animationDuration: 400,
          });
        }
      } catch {}
    })();
  }, [visible, initialLocation]);

  const updateScale = useCallback((zoom: number, lat: number) => {
    const mPerPx =
      (156543.03392 * Math.cos((lat * Math.PI) / 180)) / Math.pow(2, zoom);
    const barWidthPx = 80;
    const meters = mPerPx * barWidthPx;
    if (meters >= 1000) {
      const km = meters / 1000;
      const nice =
        km >= 100
          ? Math.round(km / 50) * 50
          : km >= 10
            ? Math.round(km / 10) * 10
            : Math.round(km * 2) / 2;
      setScaleLabel(`${nice} km`);
    } else {
      const nice =
        meters >= 100
          ? Math.round(meters / 50) * 50
          : Math.round(meters / 10) * 10;
      setScaleLabel(`${nice} m`);
    }
  }, []);

  const handleCameraChanged = useCallback(
    (state: any) => {
      const zoom = state?.properties?.zoom ?? 10;
      const center = state?.properties?.center ?? [28.9784, 41.0082];
      updateScale(zoom, center[1]);
    },
    [updateScale],
  );

  const reverseGeocode = async (lat: number, lng: number): Promise<string> => {
    try {
      const token = process.env.EXPO_PUBLIC_MAPBOX_TOKEN;
      const res = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${token}&limit=1`,
      );
      const json = await res.json();
      return (
        json.features?.[0]?.place_name ?? `${lat.toFixed(5)}, ${lng.toFixed(5)}`
      );
    } catch {
      return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    }
  };

  const handleMapPress = useCallback(async (feature: any) => {
    const [lng, lat] = feature.geometry.coordinates;
    setPinCoord([lng, lat]);
    setSelectedId(null);
    setGeocoding(true);
    const name = await reverseGeocode(lat, lng);
    setPinName(name);
    setGeocoding(false);
  }, []);

  const handleSelectSpot = useCallback((item: LocationResult) => {
    setPinCoord([item.lng, item.lat]);
    setPinName(item.name);
    setSelectedId(item.id);
    cameraRef.current?.setCamera({
      centerCoordinate: [item.lng, item.lat],
      zoomLevel: 10,
      animationDuration: 600,
    });
  }, []);

  const handleConfirm = () => {
    if (!pinCoord) return;
    onConfirm({ name: pinName, lat: pinCoord[1], lng: pinCoord[0] });
    handleClose();
  };

  const handleClose = () => {
    if (!initialLocation) {
      setPinCoord(null);
      setPinName("");
      setSelectedId(null);
    }
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      statusBarTranslucent
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable
            style={styles.backButton}
            onPress={handleClose}
            hitSlop={8}
          >
            <Ionicons
              name="chevron-back"
              size={20}
              color={Colors.textPrimary}
            />
          </Pressable>
          <View style={{ marginLeft: Spacing.md }}>
            <Text style={[Typography.displayLG, { color: Colors.textPrimary }]}>
              Choose Location
            </Text>
            <Text
              style={[
                Typography.body,
                { color: Colors.textSecondary, marginTop: 2 },
              ]}
            >
              Tap a spot to set your mission pin
            </Text>
          </View>
        </View>

        <View style={styles.mapContainer}>
          {!userCoord ? (
            <View style={[StyleSheet.absoluteFill, styles.mapFallback]}>
              <ActivityIndicator size="large" color={Colors.accent} />
              <Text
                style={[
                  Typography.body,
                  { color: Colors.textSecondary, marginTop: 12 },
                ]}
              >
                Finding your location...
              </Text>
            </View>
          ) : MapboxAvailable ? (
            <MapView
              style={StyleSheet.absoluteFill}
              styleURL="mapbox://styles/javid-a/cmoaror1v001o01s3c6zcdfuy"
              // styleURL="mapbox://styles/mapbox/dark-v11"
              onPress={handleMapPress}
              attributionEnabled={false}
              logoEnabled={false}
              pitchEnabled={false}
              scaleBarEnabled={false}
              onCameraChanged={handleCameraChanged}
            >
              <Camera
                ref={cameraRef}
                defaultSettings={{
                  centerCoordinate: initialLocation
                    ? [initialLocation.lng, initialLocation.lat]
                    : (userCoord ?? TOKYO),
                  zoomLevel: initialLocation ? 14 : 11,
                  pitch: 0,
                }}
                minZoomLevel={3}
                maxZoomLevel={14}
              />
              {tierZones && (
                <>
                  {/* C radyal degrade — B sınırından dışa doğru soluyor */}
                  {tierZones.C_gradient.map((stop, i) => (
                    <ShapeSource
                      key={`tierCGrad-${i}`}
                      id={`tierCGrad-${i}`}
                      shape={stop.feature}
                    >
                      <FillLayer
                        id={`tierCGradFill-${i}`}
                        style={{
                          fillColor: TIER_COLORS.C,
                          fillOpacity: stop.opacity,
                          fillAntialias: true,
                        }}
                      />
                    </ShapeSource>
                  ))}
                  {/* A daire fill — kullanıcı çevresinde hafif yeşil tint */}
                  <ShapeSource id="tierACircle" shape={tierZones.A}>
                    <FillLayer
                      id="tierAFill"
                      style={{ fillColor: TIER_COLORS.A, fillOpacity: 0.12 }}
                    />
                  </ShapeSource>
                  {/* B sınır glow katmanları */}
                  <ShapeSource id="tierBBorder" shape={tierZones.B}>
                    <LineLayer
                      id="tierBHalo"
                      style={{
                        lineColor: TIER_COLORS.B,
                        lineWidth: 24,
                        lineOpacity: 0.15,
                        lineBlur: 14,
                      }}
                    />
                    <LineLayer
                      id="tierBGlow"
                      style={{
                        lineColor: TIER_COLORS.B,
                        lineWidth: 8,
                        lineOpacity: 0.45,
                        lineBlur: 4,
                      }}
                    />
                    <LineLayer
                      id="tierBMain"
                      style={{
                        lineColor: TIER_COLORS.B,
                        lineWidth: 1.5,
                        lineOpacity: 0.95,
                        lineDasharray: [8, 4],
                      }}
                    />
                  </ShapeSource>
                  {/* A sınır glow katmanları */}
                  <ShapeSource id="tierABorder" shape={tierZones.A}>
                    <LineLayer
                      id="tierAHalo"
                      style={{
                        lineColor: TIER_COLORS.A,
                        lineWidth: 22,
                        lineOpacity: 0.12,
                        lineBlur: 14,
                      }}
                    />
                    <LineLayer
                      id="tierAGlow"
                      style={{
                        lineColor: TIER_COLORS.A,
                        lineWidth: 7,
                        lineOpacity: 0.35,
                        lineBlur: 4,
                      }}
                    />
                    <LineLayer
                      id="tierAMain"
                      style={{
                        lineColor: TIER_COLORS.A,
                        lineWidth: 1.5,
                        lineOpacity: 0.95,
                        lineDasharray: [8, 4],
                      }}
                    />
                  </ShapeSource>
                  {/* Tier badge etiketleri */}
                  <MarkerView
                    coordinate={tierZones.A_label}
                    anchor={{ x: 0, y: 0.5 }}
                  >
                    <View style={styles.badgeWrapper} pointerEvents="none">
                      <View style={styles.tailLeftA} />
                      <BlurView
                        intensity={25}
                        tint="dark"
                        style={styles.tierABody}
                      >
                        <LinearGradient
                          colors={[
                            "rgba(166, 230, 53, 0.2)",
                            "rgba(10, 18, 38, 0.8)",
                          ]}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={styles.tierInner}
                        >
                          <View
                            style={[
                              styles.tierBadgeDot,
                              { backgroundColor: TIER_COLORS.A },
                            ]}
                          />
                          <Text
                            style={[
                              styles.tierBadgeLabel,
                              { color: TIER_COLORS.A },
                            ]}
                          >
                            A
                          </Text>
                          <Text style={styles.tierBadgeXP}>100 XP</Text>
                        </LinearGradient>
                      </BlurView>
                    </View>
                  </MarkerView>
                  <MarkerView
                    coordinate={tierZones.B_label}
                    anchor={{ x: 0, y: 0.5 }}
                  >
                    <View
                      style={[
                        styles.badgeWrapper,
                        {
                          shadowColor: TIER_COLORS.B,
                          shadowOpacity: 0.5,
                          shadowRadius: 10,
                          elevation: 4,
                        },
                      ]}
                      pointerEvents="none"
                    >
                      <View style={styles.tailLeftB} />
                      <BlurView
                        intensity={40}
                        tint="dark"
                        style={styles.tierBBody}
                      >
                        <LinearGradient
                          colors={[
                            "rgba(34, 211, 238, 0.3)",
                            "rgba(10, 18, 38, 0.85)",
                          ]}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={styles.tierInner}
                        >
                          <View
                            style={[
                              styles.tierBadgeDot,
                              {
                                backgroundColor: TIER_COLORS.B,
                                shadowColor: TIER_COLORS.B,
                                shadowOpacity: 1,
                                shadowRadius: 5,
                              },
                            ]}
                          />
                          <Text
                            style={[
                              styles.tierBadgeLabel,
                              {
                                color: TIER_COLORS.B,
                                textShadowColor: "rgba(34, 211, 238, 0.6)",
                                textShadowRadius: 6,
                              },
                            ]}
                          >
                            B
                          </Text>
                          <Text style={styles.tierBadgeXP}>150 XP</Text>
                        </LinearGradient>
                      </BlurView>
                    </View>
                  </MarkerView>
                  <MarkerView
                    coordinate={tierZones.C_label}
                    anchor={{ x: 0, y: 0.5 }}
                  >
                    <View style={styles.badgeWrapper} pointerEvents="none">
                      <View style={styles.tailLeftC} />
                      <View style={styles.cTooltipGlowContainer}>
                        <BlurView
                          intensity={60}
                          tint="dark"
                          style={styles.cTooltipBody}
                        >
                          <LinearGradient
                            colors={[
                              "rgba(168, 85, 247, 0.4)",
                              "rgba(10, 18, 38, 0.9)",
                            ]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.cTooltipInner}
                          >
                            <Text style={styles.cTooltipText}>
                              5 km+ (200 XP)
                            </Text>
                          </LinearGradient>
                        </BlurView>
                      </View>
                    </View>
                  </MarkerView>
                </>
              )}
              <MarkerView coordinate={userCoord} anchor={{ x: 0.5, y: 0.5 }}>
                <View style={styles.userPulse}>
                  <View style={styles.userDotOuter}>
                    <View style={styles.userDotInner} />
                  </View>
                </View>
              </MarkerView>
              {pinCoord && (
                <MarkerView coordinate={pinCoord} anchor={{ x: 0.5, y: 1 }}>
                  <View style={styles.pinWrapper} pointerEvents="none">
                    <View
                      style={[
                        styles.pinHead,
                        {
                          backgroundColor: pinTier
                            ? TIER_COLORS[
                                pinTier.tier as keyof typeof TIER_COLORS
                              ]
                            : "#ffffff",
                        },
                      ]}
                    >
                      <Ionicons
                        name="location"
                        size={16}
                        color={Colors.background}
                      />
                    </View>
                    <View
                      style={[
                        styles.pinTail,
                        {
                          borderTopColor: pinTier
                            ? TIER_COLORS[
                                pinTier.tier as keyof typeof TIER_COLORS
                              ]
                            : "#ffffff",
                        },
                      ]}
                    />
                  </View>
                </MarkerView>
              )}
            </MapView>
          ) : (
            <View style={[StyleSheet.absoluteFill, styles.mapFallback]}>
              <Ionicons
                name="map-outline"
                size={32}
                color={Colors.textSecondary}
              />
              <Text
                style={[
                  Typography.body,
                  { color: Colors.textSecondary, marginTop: 8 },
                ]}
              >
                Map unavailable
              </Text>
            </View>
          )}

          {scaleLabel ? (
            <View style={styles.scaleBar}>
              <View style={styles.scaleBarLine} />
              <Text style={styles.scaleBarText}>{scaleLabel}</Text>
            </View>
          ) : null}

          {(pinName || geocoding) && (
            <View style={styles.chipContainer}>
              <View style={styles.chip}>
                {geocoding ? (
                  <ActivityIndicator size="small" color={Colors.accent} />
                ) : (
                  <>
                    <View
                      style={[
                        styles.chipDot,
                        pinTier && {
                          backgroundColor:
                            TIER_COLORS[
                              pinTier.tier as keyof typeof TIER_COLORS
                            ],
                        },
                      ]}
                    />
                    <Text style={styles.chipText} numberOfLines={1}>
                      {pinName.split(",")[0]}
                    </Text>
                    {pinTier && (
                      <Text
                        style={[
                          styles.chipTierText,
                          {
                            color:
                              TIER_COLORS[
                                pinTier.tier as keyof typeof TIER_COLORS
                              ],
                          },
                        ]}
                      >
                        {pinTier.tier} · {pinTier.potentialXP} XP
                      </Text>
                    )}
                  </>
                )}
              </View>
            </View>
          )}
        </View>

        <View style={styles.bottomSheet}>
          <Pressable
            style={[
              styles.confirmButton,
              !pinCoord && styles.confirmButtonDisabled,
            ]}
            onPress={handleConfirm}
            disabled={!pinCoord}
          >
            <Ionicons
              name="location"
              size={18}
              color={pinCoord ? Colors.background : Colors.textSecondary}
            />
            <Text
              style={[
                styles.confirmText,
                { color: pinCoord ? Colors.background : Colors.textSecondary },
              ]}
            >
              CONFIRM LOCATION
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingTop: 56,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderBright,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.borderBright,
    alignItems: "center",
    justifyContent: "center",
  },
  mapContainer: {
    flex: 1,
    position: "relative",
  },
  mapFallback: {
    backgroundColor: "#0a1226",
    alignItems: "center",
    justifyContent: "center",
  },
  userPulse: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(166, 230, 53, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  userDotOuter: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "rgba(166, 230, 53, 0.35)",
    borderWidth: 2,
    borderColor: Colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  userDotInner: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.accent,
  },
  pinWrapper: {
    alignItems: "center",
  },
  pinHead: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 5,
    elevation: 6,
  },
  pinTail: {
    width: 0,
    height: 0,
    borderLeftWidth: 7,
    borderRightWidth: 7,
    borderTopWidth: 11,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderTopColor: "#ffffff",
    marginTop: -1,
  },
  badgeWrapper: {
    flexDirection: "row",
    alignItems: "center",
  },
  tierABody: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(166, 230, 53, 0.2)",
    overflow: "hidden",
  },
  tierBBody: {
    borderRadius: 12,
    borderWidth: 1.5,
    borderTopColor: "rgba(34, 211, 238, 0.6)",
    borderLeftColor: "rgba(34, 211, 238, 0.4)",
    borderRightColor: "rgba(34, 211, 238, 0.1)",
    borderBottomColor: "rgba(34, 211, 238, 0.1)",
    overflow: "hidden",
  },
  tierInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  tailLeftA: {
    width: 0,
    height: 0,
    borderTopWidth: 4,
    borderBottomWidth: 4,
    borderRightWidth: 6,
    borderTopColor: "transparent",
    borderBottomColor: "transparent",
    borderRightColor: "rgba(166, 230, 53, 0.3)",
  },
  tailLeftB: {
    width: 0,
    height: 0,
    borderTopWidth: 5,
    borderBottomWidth: 5,
    borderRightWidth: 7,
    borderTopColor: "transparent",
    borderBottomColor: "transparent",
    borderRightColor: "rgba(34, 211, 238, 0.6)",
  },
  tailLeftC: {
    width: 0,
    height: 0,
    borderTopWidth: 6,
    borderBottomWidth: 6,
    borderRightWidth: 8,
    borderTopColor: "transparent",
    borderBottomColor: "transparent",
    borderRightColor: "rgba(168, 85, 247, 0.8)",
    shadowColor: "#A855F7",
    shadowOffset: { width: -2, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
  },
  tierBadgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 4,
    elevation: 2,
  },
  tierBadgeLabel: {
    fontFamily: "Rajdhani_700Bold",
    fontSize: 14,
    letterSpacing: 1.2,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 3,
    textShadowColor: "rgba(255, 255, 255, 0.3)",
  },
  tierBadgeXP: {
    fontFamily: "Rajdhani_600SemiBold",
    fontSize: 12,
    color: "#8B95A5",
    letterSpacing: 0.5,
    marginLeft: 2,
  },
  cTooltipGlowContainer: {
    shadowColor: "#A855F7",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 16,
    elevation: 10,
    borderRadius: 16,
  },
  cTooltipBody: {
    borderRadius: 16,
    borderWidth: 1.5,
    borderTopColor: "rgba(168, 85, 247, 0.9)",
    borderLeftColor: "rgba(168, 85, 247, 0.7)",
    borderRightColor: "rgba(168, 85, 247, 0.1)",
    borderBottomColor: "rgba(168, 85, 247, 0.05)",
    overflow: "hidden",
  },
  cTooltipInner: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.2)",
    borderLeftColor: "rgba(255, 255, 255, 0.1)",
    borderRightColor: "rgba(255, 255, 255, 0.02)",
    borderBottomColor: "rgba(255, 255, 255, 0.02)",
    borderRadius: 14.5,
  },
  cTooltipText: {
    fontFamily: "Rajdhani_700Bold",
    fontSize: 15,
    letterSpacing: 0.6,
    color: "#FFFFFF",
    textShadowColor: "rgba(168, 85, 247, 1)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  scaleBar: {
    position: "absolute",
    bottom: 16,
    left: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  scaleBarLine: {
    width: 80,
    height: 3,
    backgroundColor: Colors.accent,
    borderRadius: 2,
  },
  scaleBarText: {
    fontFamily: "Rajdhani_700Bold",
    fontSize: 12,
    color: Colors.textPrimary,
    letterSpacing: 0.5,
  },
  chipContainer: {
    position: "absolute",
    bottom: 16,
    left: 0,
    right: 0,
    alignItems: "center",
    pointerEvents: "none",
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(10, 18, 38, 0.92)",
    borderWidth: 1,
    borderColor: Colors.accent,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 999,
    maxWidth: "80%",
  },
  chipDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.accent,
  },
  chipText: {
    fontFamily: "Rajdhani_700Bold",
    fontSize: 13,
    letterSpacing: 0.5,
    color: Colors.textPrimary,
    flexShrink: 1,
  },
  chipTierText: {
    fontFamily: "Rajdhani_700Bold",
    fontSize: 12,
    letterSpacing: 1,
    marginLeft: 2,
  },
  bottomSheet: {
    backgroundColor: Colors.background,
    borderTopWidth: 1,
    borderTopColor: Colors.borderBright,
    paddingTop: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
  sectionLabel: {
    fontFamily: "Rajdhani_700Bold",
    fontSize: 11,
    letterSpacing: 1.4,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
  },
  emptyRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
  },
  spotRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.borderBright,
    backgroundColor: Colors.surface,
    marginBottom: 8,
  },
  spotRowSelected: {
    borderColor: Colors.accent,
    backgroundColor: Colors.accentSoft,
  },
  spotIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: Colors.surface2,
    alignItems: "center",
    justifyContent: "center",
  },
  spotIconSelected: {
    backgroundColor: Colors.accent,
  },
  confirmButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 54,
    borderRadius: 16,
    backgroundColor: Colors.accent,
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
  confirmButtonDisabled: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.borderBright,
    shadowOpacity: 0,
    elevation: 0,
  },
  confirmText: {
    fontFamily: "Rajdhani_700Bold",
    fontSize: 15,
    letterSpacing: 1.5,
  },
});
