import { useEffect, useMemo, useRef, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Spacing, Typography } from "../constants";
import { useTheme } from "../context/ThemeContext";
import type { ColorScheme } from "../constants/colors";
import type { DayMission } from "../types/DayMission";
import { haversineMeters } from "../config/tierConfig";
import {
  MapboxAvailable,
  MapView,
  Camera,
  MarkerView,
} from "../services/mapbox";

interface Props {
  visible: boolean;
  date: Date | null;
  missions: DayMission[];
  onClose: () => void;
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

type CameraSettings =
  | {
      kind: "point";
      centerCoordinate: [number, number];
      zoomLevel: number;
      spreadM: number;
    }
  | {
      kind: "bounds";
      ne: [number, number];
      sw: [number, number];
      spreadM: number;
    };

const SINGLE_MISSION_ZOOM = 15;
const FOCUS_ZOOM = 17;
const FOCUS_FLY_MS_FAR = 850;
const FOCUS_FLY_MS_CLOSE = 2100;
const FOCUS_PITCH_MAX = 55;
const SPREAD_TIGHT_M = 250;
const SPREAD_LOOSE_M = 5000;
const BOUNDS_PADDING = 40;

function isValidCoord(m: DayMission): boolean {
  return m.latitude !== 0 && m.longitude !== 0;
}

function calcCameraSettings(missions: DayMission[]): CameraSettings | null {
  const valid = missions.filter(isValidCoord);
  if (valid.length === 0) return null;

  if (valid.length === 1) {
    return {
      kind: "point",
      centerCoordinate: [valid[0].longitude, valid[0].latitude],
      zoomLevel: SINGLE_MISSION_ZOOM,
      spreadM: 0,
    };
  }

  const lngs = valid.map((m) => m.longitude);
  const lats = valid.map((m) => m.latitude);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);

  return {
    kind: "bounds",
    ne: [maxLng, maxLat],
    sw: [minLng, minLat],
    spreadM: haversineMeters(minLat, minLng, maxLat, maxLng),
  };
}

function hexToRgba(hex: string, alpha: number): string {
  if (!hex.startsWith("#") || hex.length !== 7) return hex;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function makeStyles(C: ColorScheme, isDark: boolean) {
  const dangerSoft = hexToRgba(C.danger, 0.18);
  const dangerBorder = hexToRgba(C.danger, 0.55);
  const dangerCardBorder = hexToRgba(C.danger, 0.3);
  const orangeBorderStrong = hexToRgba(C.orange, 0.5);
  const orangeCardBorder = hexToRgba(C.orange, 0.3);
  // Map overlay chips need a solid backing that reads on both light and dark
  // tile bases — use an opaque surface scrim.
  const overlayChipBg = isDark
    ? "rgba(7, 8, 15, 0.85)"
    : "rgba(255, 255, 255, 0.92)";
  const numberedPinBg = isDark
    ? "rgba(7, 8, 15, 0.92)"
    : "rgba(255, 255, 255, 0.96)";

  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.7)",
      justifyContent: "flex-end",
    },
    sheet: {
      backgroundColor: C.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.sm,
      paddingBottom: Spacing.xxl,
      borderTopWidth: 1,
      borderColor: C.borderBright,
    },
    handle: {
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: C.muted,
      alignSelf: "center",
      marginBottom: Spacing.md,
    },
    header: {
      flexDirection: "row",
      alignItems: "flex-start",
    },
    dot: {
      width: 5,
      height: 5,
      borderRadius: 3,
      backgroundColor: C.accent,
      marginHorizontal: 4,
    },
    closeButton: {
      width: 34,
      height: 34,
      borderRadius: 10,
      backgroundColor: C.surface2,
      borderWidth: 1,
      borderColor: C.borderBright,
      alignItems: "center",
      justifyContent: "center",
    },
    mapWrap: {
      height: 200,
      borderRadius: 18,
      overflow: "hidden",
      backgroundColor: C.surface2,
      borderWidth: 1,
      borderColor: C.borderBright,
      marginTop: Spacing.md,
      position: "relative",
    },
    map: {
      flex: 1,
    },
    mapPlaceholder: {
      flex: 1,
      backgroundColor: C.surface2,
    },
    mapLegend: {
      position: "absolute",
      top: Spacing.sm,
      right: Spacing.sm,
      zIndex: 10,
      gap: 6,
      alignItems: "flex-end",
    },
    legendChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      backgroundColor: overlayChipBg,
      borderWidth: 1,
      borderColor: C.accentBorder,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 999,
    },
    legendDot: {
      width: 7,
      height: 7,
      borderRadius: 4,
    },
    legendText: {
      fontFamily: "Rajdhani_700Bold",
      fontSize: 10,
      letterSpacing: 1.2,
      color: C.accent,
    },
    numberedPin: {
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: numberedPinBg,
      borderWidth: 2,
      borderColor: C.accent,
      alignItems: "center",
      justifyContent: "center",
      shadowColor: C.accent,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.8,
      shadowRadius: 8,
    },
    numberedPinDim: {
      opacity: 0.65,
    },
    numberedPinText: {
      fontFamily: "Rajdhani_700Bold",
      fontSize: 14,
      color: C.accent,
    },
    dailyRouteChip: {
      position: "absolute",
      bottom: Spacing.sm,
      left: Spacing.sm,
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      backgroundColor: overlayChipBg,
      borderWidth: 1,
      borderColor: C.borderBright,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 999,
    },
    dailyRouteText: {
      fontFamily: "Rajdhani_700Bold",
      fontSize: 10,
      letterSpacing: 1.2,
      color: C.textSecondary,
    },
    statsRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginTop: Spacing.md,
      paddingVertical: Spacing.md,
      borderTopWidth: 1,
      borderBottomWidth: 1,
      borderColor: C.border,
    },
    statCol: {
      flex: 1,
      alignItems: "center",
    },
    statLabel: {
      fontFamily: "Rajdhani_700Bold",
      fontSize: 10,
      letterSpacing: 1.2,
      color: C.textSecondary,
      marginTop: 2,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: C.surface2,
      borderRadius: 14,
      padding: Spacing.md,
      gap: Spacing.md,
      borderWidth: 1,
      borderColor: C.border,
    },
    rowMissed: {
      borderColor: dangerCardBorder,
    },
    rowPending: {
      borderColor: orangeCardBorder,
    },
    rowSelected: {
      borderColor: C.accent,
      backgroundColor: C.accentSoft,
    },
    rowNumber: {
      width: 30,
      height: 30,
      borderRadius: 10,
      backgroundColor: C.accentSoft,
      borderWidth: 1.5,
      borderColor: C.accent,
      alignItems: "center",
      justifyContent: "center",
    },
    rowNumberText: {
      fontFamily: "Rajdhani_700Bold",
      fontSize: 14,
      color: C.accent,
    },
    missedPill: {
      backgroundColor: dangerSoft,
      borderWidth: 1,
      borderColor: dangerBorder,
      borderRadius: 8,
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    missedPillText: {
      fontFamily: "Rajdhani_700Bold",
      fontSize: 11,
      letterSpacing: 1,
      color: C.danger,
    },
    pendingPill: {
      backgroundColor: C.orangeSubtle,
      borderWidth: 1,
      borderColor: orangeBorderStrong,
      borderRadius: 8,
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    pendingPillText: {
      fontFamily: "Rajdhani_700Bold",
      fontSize: 11,
      letterSpacing: 1,
      color: C.orange,
    },
  });
}

export default function RouteMapModal({
  visible,
  date,
  missions,
  onClose,
}: Props) {
  const { colors: C, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(C, isDark), [C, isDark]);

  const PIN_COLORS: Record<DayMission["status"], string> = useMemo(
    () => ({
      completed: C.accent,
      pending: C.orange,
      missed: C.danger,
    }),
    [C],
  );

  const completed = missions.filter((m) => m.status === "completed").length;
  const pending = missions.filter((m) => m.status === "pending").length;
  const missed = missions.filter((m) => m.status === "missed").length;
  const total = missions.length;
  const xp = missions.reduce((sum, m) => sum + (m.earnedXP ?? 0), 0);
  const camera = useMemo(() => calcCameraSettings(missions), [missions]);
  const cameraRef = useRef<any>(null);
  const [selectedMissionId, setSelectedMissionId] = useState<string | null>(
    null,
  );
  const prevSelectedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!visible) {
      setSelectedMissionId(null);
      prevSelectedRef.current = null;
      return;
    }
    if (!camera || !cameraRef.current) return;
    if (camera.kind === "point") {
      cameraRef.current.setCamera({
        centerCoordinate: camera.centerCoordinate,
        zoomLevel: camera.zoomLevel,
        pitch: 0,
        animationDuration: 0,
      });
    } else {
      cameraRef.current.fitBounds(
        camera.ne,
        camera.sw,
        [BOUNDS_PADDING, BOUNDS_PADDING, BOUNDS_PADDING, BOUNDS_PADDING],
        0,
      );
    }
    setSelectedMissionId(null);
    prevSelectedRef.current = null;
  }, [visible, date, camera]);

  const focusMission = (m: DayMission) => {
    if (!cameraRef.current) return;
    if (!isValidCoord(m)) return;
    if (prevSelectedRef.current === m.id) return;

    const spreadM = camera?.spreadM ?? 0;
    const closeness =
      1 -
      Math.min(
        Math.max(
          (spreadM - SPREAD_TIGHT_M) / (SPREAD_LOOSE_M - SPREAD_TIGHT_M),
          0,
        ),
        1,
      );
    const focusPitch = Math.round(closeness * FOCUS_PITCH_MAX);
    const flyMs = Math.round(
      FOCUS_FLY_MS_FAR + (FOCUS_FLY_MS_CLOSE - FOCUS_FLY_MS_FAR) * closeness,
    );

    cameraRef.current.setCamera({
      centerCoordinate: [m.longitude, m.latitude],
      zoomLevel: FOCUS_ZOOM,
      pitch: focusPitch,
      animationDuration: flyMs,
      animationMode: "flyTo",
    });

    prevSelectedRef.current = m.id;
    setSelectedMissionId(m.id);
  };

  // Light mode'da kendi custom dark stilimiz yerine standart Mapbox light stiline düş.
  const mapStyleURL = isDark
    ? "mapbox://styles/javid-a/cmnywehfe001101qz3nmtgtsa"
    : "mapbox://styles/mapbox/light-v11";

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />

          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
              >
                <Text style={[Typography.displayMD, { color: C.textPrimary }]}>
                  Today
                </Text>
                <View style={styles.dot} />
                <Text style={[Typography.displayMD, { color: C.textPrimary }]}>
                  Route Map
                </Text>
              </View>
              <Text
                style={[
                  Typography.caption,
                  { color: C.textSecondary, marginTop: 2 },
                ]}
              >
                {date ? formatDate(date) : ""} · {total} missions
              </Text>
            </View>
            <Pressable style={styles.closeButton} onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={20} color={C.textSecondary} />
            </Pressable>
          </View>

          <View style={styles.mapWrap}>
            <View style={styles.mapLegend}>
              <View style={styles.legendChip}>
                <View
                  style={[styles.legendDot, { backgroundColor: C.accent }]}
                />
                <Text style={styles.legendText}>DONE</Text>
              </View>
              {pending > 0 && (
                <View
                  style={[
                    styles.legendChip,
                    { borderColor: hexToRgba(C.orange, 0.55) },
                  ]}
                >
                  <View
                    style={[styles.legendDot, { backgroundColor: C.orange }]}
                  />
                  <Text style={[styles.legendText, { color: C.orange }]}>
                    PENDING
                  </Text>
                </View>
              )}
              {missed > 0 && (
                <View
                  style={[
                    styles.legendChip,
                    { borderColor: hexToRgba(C.danger, 0.55) },
                  ]}
                >
                  <View
                    style={[styles.legendDot, { backgroundColor: C.danger }]}
                  />
                  <Text style={[styles.legendText, { color: C.danger }]}>
                    MISSED
                  </Text>
                </View>
              )}
            </View>

            {MapboxAvailable && camera ? (
              <MapView
                style={styles.map}
                styleURL={mapStyleURL}
                compassEnabled={false}
                logoEnabled={false}
                attributionEnabled={false}
                scaleBarEnabled={false}
                scrollEnabled={false}
                pitchEnabled={false}
                rotateEnabled={false}
                zoomEnabled={false}
              >
                <Camera
                  ref={cameraRef}
                  defaultSettings={
                    camera.kind === "point"
                      ? {
                          centerCoordinate: camera.centerCoordinate,
                          zoomLevel: camera.zoomLevel,
                          pitch: 0,
                        }
                      : {
                          bounds: {
                            ne: camera.ne,
                            sw: camera.sw,
                            paddingLeft: BOUNDS_PADDING,
                            paddingRight: BOUNDS_PADDING,
                            paddingTop: BOUNDS_PADDING,
                            paddingBottom: BOUNDS_PADDING,
                          },
                        }
                  }
                />
                {missions.map((m, i) => {
                  if (!isValidCoord(m)) return null;
                  return (
                    <MarkerView
                      key={m.id}
                      coordinate={[m.longitude, m.latitude]}
                      anchor={{ x: 0.5, y: 0.5 }}
                    >
                      <View
                        style={[
                          styles.numberedPin,
                          { borderColor: PIN_COLORS[m.status] },
                          m.status !== "completed" && styles.numberedPinDim,
                        ]}
                      >
                        <Text
                          style={[
                            styles.numberedPinText,
                            { color: PIN_COLORS[m.status] },
                          ]}
                        >
                          {i + 1}
                        </Text>
                      </View>
                    </MarkerView>
                  );
                })}
              </MapView>
            ) : (
              <View style={styles.mapPlaceholder} />
            )}

            <View style={styles.dailyRouteChip}>
              <Ionicons
                name="git-network-outline"
                size={12}
                color={C.textSecondary}
              />
              <Text style={styles.dailyRouteText}>DAILY ROUTE</Text>
            </View>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statCol}>
              <Text style={[Typography.statLG, { color: C.textPrimary }]}>
                {total}
              </Text>
              <Text style={styles.statLabel}>TOTAL</Text>
            </View>
            <View style={styles.statCol}>
              <Text style={[Typography.statLG, { color: C.accent }]}>
                {completed}
              </Text>
              <Text style={styles.statLabel}>DONE</Text>
            </View>
            {pending > 0 ? (
              <View style={styles.statCol}>
                <Text style={[Typography.statLG, { color: C.orange }]}>
                  {pending}
                </Text>
                <Text style={styles.statLabel}>PENDING</Text>
              </View>
            ) : (
              <View style={styles.statCol}>
                <Text style={[Typography.statLG, { color: C.danger }]}>
                  {missed}
                </Text>
                <Text style={styles.statLabel}>MISSED</Text>
              </View>
            )}
            <View style={styles.statCol}>
              <Text style={[Typography.statLG, { color: C.accent }]}>
                +{xp}
              </Text>
              <Text style={styles.statLabel}>XP EARNED</Text>
            </View>
          </View>

          <ScrollView
            style={{ maxHeight: 220 }}
            showsVerticalScrollIndicator={false}
          >
            <View style={{ gap: Spacing.sm, paddingTop: Spacing.sm }}>
              {missions.map((m, i) => (
                <Pressable
                  key={m.id}
                  onPress={() => focusMission(m)}
                  style={[
                    styles.row,
                    m.status === "missed" && styles.rowMissed,
                    m.status === "pending" && styles.rowPending,
                    selectedMissionId === m.id && styles.rowSelected,
                  ]}
                >
                  <View
                    style={[
                      styles.rowNumber,
                      {
                        backgroundColor: `${PIN_COLORS[m.status]}1A`,
                        borderColor: `${PIN_COLORS[m.status]}99`,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.rowNumberText,
                        { color: PIN_COLORS[m.status] },
                      ]}
                    >
                      {i + 1}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[Typography.bodyBold, { color: C.textPrimary }]}
                    >
                      {m.missionName}
                    </Text>
                    <Text
                      style={[
                        Typography.caption,
                        { color: C.textSecondary, marginTop: 2 },
                      ]}
                    >
                      {m.status === "completed" && m.completedAt
                        ? formatTime(m.completedAt)
                        : m.status === "pending"
                          ? "Not completed yet"
                          : "Not completed"}
                    </Text>
                  </View>
                  {m.status === "completed" ? (
                    <Text style={[Typography.statMD, { color: C.accent }]}>
                      +{m.earnedXP}
                    </Text>
                  ) : m.status === "pending" ? (
                    <View style={styles.pendingPill}>
                      <Text style={styles.pendingPillText}>PENDING</Text>
                    </View>
                  ) : (
                    <View style={styles.missedPill}>
                      <Text style={styles.missedPillText}>MISSED</Text>
                    </View>
                  )}
                </Pressable>
              ))}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
