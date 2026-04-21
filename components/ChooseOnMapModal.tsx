import { useCallback, useEffect, useRef, useState } from "react";
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

let MapboxAvailable = false;
let MapView: any;
let Camera: any;
let MarkerView: any;
let Mapbox: any;

try {
  const maps = require("@rnmapbox/maps");
  Mapbox = maps.default;
  MapView = maps.MapView;
  Camera = maps.Camera;
  MarkerView = maps.MarkerView;
  Mapbox.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? "");
  MapboxAvailable = true;
} catch {
  MapboxAvailable = false;
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
};

export default function ChooseOnMapModal({
  visible,
  onClose,
  onConfirm,
  recentResults,
}: Props) {
  const cameraRef = useRef<any>(null);
  const [pinCoord, setPinCoord] = useState<[number, number] | null>(null);
  const [pinName, setPinName] = useState("");
  const [geocoding, setGeocoding] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [userCoord, setUserCoord] = useState<[number, number]>([
    28.9784, 41.0082,
  ]);
  const [scaleLabel, setScaleLabel] = useState("");

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
        cameraRef.current?.setCamera({
          centerCoordinate: coord,
          zoomLevel: 10,
          animationDuration: 400,
        });
      } catch {}
    })();
  }, [visible]);

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
    setPinCoord(null);
    setPinName("");
    setSelectedId(null);
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
          {MapboxAvailable ? (
            <MapView
              style={StyleSheet.absoluteFill}
              styleURL="mapbox://styles/javid-a/cmnywehfe001101qz3nmtgtsa"
              onPress={handleMapPress}
              attributionEnabled={false}
              logoEnabled={false}
              pitchEnabled={false}
              scaleBarEnabled={false}
              onCameraChanged={handleCameraChanged}
            >
              <Camera
                ref={cameraRef}
                zoomLevel={10}
                minZoomLevel={3}
                maxZoomLevel={14}
                pitch={0}
                centerCoordinate={userCoord}
                animationMode="flyTo"
                animationDuration={0}
              />
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
                    <View style={styles.pinHead}>
                      <Ionicons
                        name="location"
                        size={16}
                        color={Colors.background}
                      />
                    </View>
                    <View style={styles.pinTail} />
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
                    <View style={styles.chipDot} />
                    <Text style={styles.chipText} numberOfLines={1}>
                      {pinName.split(",")[0]}
                    </Text>
                  </>
                )}
              </View>
            </View>
          )}
        </View>

        <View style={styles.bottomSheet}>
          <Text style={styles.sectionLabel}>NEARBY SPOTS</Text>
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {recentResults.length === 0 ? (
              <View style={styles.emptyRow}>
                <Ionicons
                  name="search-outline"
                  size={18}
                  color={Colors.textSecondary}
                />
                <Text
                  style={[
                    Typography.body,
                    { color: Colors.textSecondary, marginLeft: 10 },
                  ]}
                >
                  Search a place first to see suggestions here
                </Text>
              </View>
            ) : (
              recentResults.map((item) => {
                const isSelected =
                  selectedId === item.id ||
                  (!selectedId && pinName === item.name);
                return (
                  <Pressable
                    key={item.id}
                    style={[
                      styles.spotRow,
                      isSelected && styles.spotRowSelected,
                    ]}
                    onPress={() => handleSelectSpot(item)}
                  >
                    <View
                      style={[
                        styles.spotIcon,
                        isSelected && styles.spotIconSelected,
                      ]}
                    >
                      <Ionicons
                        name="location"
                        size={16}
                        color={
                          isSelected ? Colors.background : Colors.textSecondary
                        }
                      />
                    </View>
                    <View style={{ flex: 1, marginLeft: Spacing.md }}>
                      <Text
                        style={[
                          Typography.body,
                          {
                            color: isSelected
                              ? Colors.textPrimary
                              : Colors.textSecondary,
                          },
                        ]}
                        numberOfLines={1}
                      >
                        {item.name.split(",")[0]}
                      </Text>
                      <Text
                        style={[
                          Typography.label,
                          { color: Colors.textSecondary, marginTop: 2 },
                        ]}
                        numberOfLines={1}
                      >
                        {item.name.split(",").slice(1, 3).join(",").trim() ||
                          "Tap to select"}
                      </Text>
                    </View>
                    {isSelected && (
                      <Ionicons
                        name="checkmark"
                        size={18}
                        color={Colors.accent}
                      />
                    )}
                  </Pressable>
                );
              })
            )}
          </ScrollView>

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
  bottomSheet: {
    height: 300,
    backgroundColor: Colors.background,
    borderTopWidth: 1,
    borderTopColor: Colors.borderBright,
    paddingTop: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
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
    marginTop: Spacing.sm,
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
