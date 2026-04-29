import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { Spacing, Typography } from "../constants";
import { useTheme, useTierColors } from "../context/ThemeContext";
import type { ColorScheme } from "../constants/colors";
import { classifyDistance, haversineMeters } from "../config/tierConfig";
import {
  MapboxAvailable,
  MapView,
  Camera,
  MarkerView,
} from "../services/mapbox";
import { buildTierZones } from "../utils/tierZones";
import TierZonesOverlay from "./map/TierZonesOverlay";

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

const TOKYO: [number, number] = [139.6917, 35.6895];

function makeStyles(C: ColorScheme, isDark: boolean) {
  // Mapbox style attribute is set on <MapView>; chip and fallback colors here
  // need to read the same way over both light and dark map tiles.
  const chipBg = isDark ? "rgba(10, 18, 38, 0.92)" : "rgba(255, 255, 255, 0.92)";
  const userPulseBg = isDark
    ? "rgba(166, 230, 53, 0.12)"
    : "rgba(22, 194, 106, 0.18)";
  const userDotOuterBg = isDark
    ? "rgba(166, 230, 53, 0.35)"
    : "rgba(22, 194, 106, 0.45)";

  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: C.background,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: Spacing.lg,
      paddingTop: 56,
      paddingBottom: Spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: C.borderBright,
    },
    backButton: {
      width: 38,
      height: 38,
      borderRadius: 12,
      backgroundColor: C.surface,
      borderWidth: 1,
      borderColor: C.borderBright,
      alignItems: "center",
      justifyContent: "center",
    },
    mapContainer: {
      flex: 1,
      position: "relative",
    },
    mapFallback: {
      backgroundColor: isDark ? "#0a1226" : C.surface2,
      alignItems: "center",
      justifyContent: "center",
    },
    userPulse: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: userPulseBg,
      alignItems: "center",
      justifyContent: "center",
    },
    userDotOuter: {
      width: 16,
      height: 16,
      borderRadius: 8,
      backgroundColor: userDotOuterBg,
      borderWidth: 2,
      borderColor: C.accent,
      alignItems: "center",
      justifyContent: "center",
    },
    userDotInner: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: C.accent,
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
      backgroundColor: C.accent,
      borderRadius: 2,
    },
    scaleBarText: {
      fontFamily: "Rajdhani_700Bold",
      fontSize: 12,
      color: isDark ? C.textPrimary : "#ffffff",
      letterSpacing: 0.5,
      textShadowColor: "rgba(0,0,0,0.6)",
      textShadowRadius: 2,
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
      backgroundColor: chipBg,
      borderWidth: 1,
      borderColor: C.accent,
      paddingHorizontal: 16,
      paddingVertical: 9,
      borderRadius: 999,
      maxWidth: "80%",
    },
    chipDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: C.accent,
    },
    chipText: {
      fontFamily: "Rajdhani_700Bold",
      fontSize: 13,
      letterSpacing: 0.5,
      color: C.textPrimary,
      flexShrink: 1,
    },
    chipTierText: {
      fontFamily: "Rajdhani_700Bold",
      fontSize: 12,
      letterSpacing: 1,
      marginLeft: 2,
    },
    bottomSheet: {
      backgroundColor: C.background,
      borderTopWidth: 1,
      borderTopColor: C.borderBright,
      paddingTop: Spacing.lg,
      paddingHorizontal: Spacing.lg,
      paddingBottom: Spacing.xxl,
    },
    confirmButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      height: 54,
      borderRadius: 16,
      backgroundColor: C.accent,
      shadowColor: C.accent,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.4,
      shadowRadius: 12,
      elevation: 6,
    },
    confirmButtonDisabled: {
      backgroundColor: C.surface,
      borderWidth: 1,
      borderColor: C.borderBright,
      shadowOpacity: 0,
      elevation: 0,
    },
    confirmText: {
      fontFamily: "Rajdhani_700Bold",
      fontSize: 15,
      letterSpacing: 1.5,
    },
  });
}

export default function ChooseOnMapModal({
  visible,
  onClose,
  onConfirm,
  recentResults,
  initialLocation,
}: Props) {
  const { colors: C, isDark } = useTheme();
  const tierColors = useTierColors();
  const styles = useMemo(() => makeStyles(C, isDark), [C, isDark]);

  const cameraRef = useRef<any>(null);
  const [pinCoord, setPinCoord] = useState<[number, number] | null>(null);
  const [pinName, setPinName] = useState("");
  const [geocoding, setGeocoding] = useState(false);
  const [, setSelectedId] = useState<string | null>(null);
  const [userCoord, setUserCoord] = useState<[number, number] | null>(null);
  const [scaleLabel, setScaleLabel] = useState("");
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
        const matchedId = recentResults.find(
          (r) => r.lat === initialLocation.lat && r.lng === initialLocation.lng,
        )?.id;
        setSelectedId(matchedId ?? null);
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

  const tierZones = useMemo(
    () => (userCoord ? buildTierZones(userCoord) : null),
    [userCoord],
  );

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
    const meters = mPerPx * 80;
    if (meters < 1000) {
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

  // Mapbox style URL: dark hattuara dark-v11, light için light-v11.
  const mapStyleURL = isDark
    ? "mapbox://styles/mapbox/dark-v11"
    : "mapbox://styles/mapbox/light-v11";

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
              color={C.textPrimary}
            />
          </Pressable>
          <View style={{ marginLeft: Spacing.md }}>
            <Text style={[Typography.displayLG, { color: C.textPrimary }]}>
              Choose Location
            </Text>
            <Text
              style={[
                Typography.body,
                { color: C.textSecondary, marginTop: 2 },
              ]}
            >
              Tap a spot to set your mission pin
            </Text>
          </View>
        </View>

        <View style={styles.mapContainer}>
          {!userCoord ? (
            <View style={[StyleSheet.absoluteFill, styles.mapFallback]}>
              <ActivityIndicator size="large" color={C.accent} />
              <Text
                style={[
                  Typography.body,
                  { color: C.textSecondary, marginTop: 12 },
                ]}
              >
                Finding your location...
              </Text>
            </View>
          ) : MapboxAvailable ? (
            <MapView
              style={StyleSheet.absoluteFill}
              styleURL={mapStyleURL}
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
                maxZoomLevel={16}
              />
              {tierZones && <TierZonesOverlay zones={tierZones} />}
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
                            ? tierColors[
                                pinTier.tier as keyof typeof tierColors
                              ]
                            : "#ffffff",
                        },
                      ]}
                    >
                      <Ionicons
                        name="location"
                        size={16}
                        color={C.background}
                      />
                    </View>
                    <View
                      style={[
                        styles.pinTail,
                        {
                          borderTopColor: pinTier
                            ? tierColors[
                                pinTier.tier as keyof typeof tierColors
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
                color={C.textSecondary}
              />
              <Text
                style={[
                  Typography.body,
                  { color: C.textSecondary, marginTop: 8 },
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
                  <ActivityIndicator size="small" color={C.accent} />
                ) : (
                  <>
                    <View
                      style={[
                        styles.chipDot,
                        pinTier && {
                          backgroundColor:
                            tierColors[
                              pinTier.tier as keyof typeof tierColors
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
                              tierColors[
                                pinTier.tier as keyof typeof tierColors
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
              color={pinCoord ? C.background : C.textSecondary}
            />
            <Text
              style={[
                styles.confirmText,
                { color: pinCoord ? C.background : C.textSecondary },
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
