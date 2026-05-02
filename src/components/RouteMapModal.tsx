import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
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
import { useTheme, useTierColors } from "../context/ThemeContext";
import type { ColorScheme } from "../constants/colors";
import type { DayMission } from "../types/DayMission";
import { haversineMeters } from "../config/tierConfig";
import { getMissionIconName } from "../config/missionIcons";
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
const FOCUS_FLY_MS = 1400;
const FOCUS_PITCH = 65;
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
    rowNumber: {
      width: 30,
      height: 30,
      borderRadius: 10,
      borderWidth: 1.5,
      alignItems: "center",
      justifyContent: "center",
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
    pinWrapper: {
      alignItems: "center",
      justifyContent: "flex-end",
    },
    pinTooltip: {
      backgroundColor: overlayChipBg,
      borderWidth: 1,
      borderColor: C.borderBright,
      borderRadius: 10,
      paddingHorizontal: 8,
      paddingVertical: 5,
      maxWidth: 140,
      marginBottom: 6,
    },
    pinTooltipText: {
      fontFamily: "Rajdhani_700Bold",
      fontSize: 11,
      letterSpacing: 0.5,
      color: C.textPrimary,
      textAlign: "center",
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
  const tierColors = useTierColors();
  const { t } = useTranslation();
  const styles = useMemo(() => makeStyles(C, isDark), [C, isDark]);

  const colorForMission = (m: DayMission): string => {
    if (m.status === "missed") return C.danger;
    if (m.status === "pending") return C.orange;
    return tierColors[m.tier];
  };

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
  const [tooltipMissionId, setTooltipMissionId] = useState<string | null>(null);
  const prevSelectedRef = useRef<string | null>(null);
  const tooltipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setSelectedMissionId(null);
    setTooltipMissionId(null);
    prevSelectedRef.current = null;
    if (tooltipTimerRef.current) {
      clearTimeout(tooltipTimerRef.current);
      tooltipTimerRef.current = null;
    }
    if (!visible || !camera) return;
    if (!cameraRef.current) return;
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
  }, [visible, date, camera]);

  const focusMission = (m: DayMission) => {
    if (!cameraRef.current) return;
    if (!isValidCoord(m)) return;
    if (prevSelectedRef.current === m.id) return;

    cameraRef.current.setCamera({
      centerCoordinate: [m.longitude, m.latitude],
      zoomLevel: FOCUS_ZOOM,
      pitch: FOCUS_PITCH,
      animationDuration: FOCUS_FLY_MS,
      animationMode: "flyTo",
    });

    prevSelectedRef.current = m.id;
    setSelectedMissionId(m.id);
    setTooltipMissionId(null);
    if (tooltipTimerRef.current) clearTimeout(tooltipTimerRef.current);
    if (m.locationName) {
      tooltipTimerRef.current = setTimeout(
        () => setTooltipMissionId(m.id),
        FOCUS_FLY_MS,
      );
    }
  };

  // Light mode'da kendi custom dark stilimiz yerine standart Mapbox light stiline düş.
  const mapStyleURL = isDark
    ? "mapbox://styles/javid-a/cmnywehfe001101qz3nmtgtsa"
    : // : "mapbox://styles/mapbox/light-v11";
      "mapbox://styles/javid-a/cmnywehfe001101qz3nmtgtsa";

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
                  {t("routeMap.today")}
                </Text>
                <View style={styles.dot} />
                <Text style={[Typography.displayMD, { color: C.textPrimary }]}>
                  {t("routeMap.title")}
                </Text>
              </View>
              <Text
                style={[
                  Typography.caption,
                  { color: C.textSecondary, marginTop: 2 },
                ]}
              >
                {date ? formatDate(date) : ""} · {t("routeMap.missionCount", { count: total })}
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
                <Text style={styles.legendText}>{t("routeMap.done")}</Text>
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
                    {t("history.pending")}
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
                    {t("history.missed")}
                  </Text>
                </View>
              )}
            </View>

            {visible && MapboxAvailable && camera ? (
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
                {missions.map((m) => {
                  if (!isValidCoord(m)) return null;
                  const pinColor = colorForMission(m);
                  const iconName = getMissionIconName(m.iconType);
                  const showTooltip = tooltipMissionId === m.id;
                  return (
                    <MarkerView
                      key={m.id}
                      coordinate={[m.longitude, m.latitude]}
                      anchor={{ x: 0.5, y: 0.5 }}
                    >
                      <View style={styles.pinWrapper}>
                        {showTooltip && (
                          <View style={styles.pinTooltip}>
                            <Text style={styles.pinTooltipText}>
                              {m.missionName}
                            </Text>
                          </View>
                        )}
                        <View
                          style={[
                            styles.numberedPin,
                            { borderColor: pinColor },
                            m.status !== "completed" && styles.numberedPinDim,
                          ]}
                        >
                          <Ionicons
                            name={iconName}
                            size={14}
                            color={pinColor}
                          />
                        </View>
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
              <Text style={styles.dailyRouteText}>{t("routeMap.dailyRoute")}</Text>
            </View>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statCol}>
              <Text style={[Typography.statLG, { color: C.textPrimary }]}>
                {total}
              </Text>
              <Text style={styles.statLabel}>{t("routeMap.total")}</Text>
            </View>
            <View style={styles.statCol}>
              <Text style={[Typography.statLG, { color: C.accent }]}>
                {completed}
              </Text>
              <Text style={styles.statLabel}>{t("routeMap.done")}</Text>
            </View>
            {pending > 0 ? (
              <View style={styles.statCol}>
                <Text style={[Typography.statLG, { color: C.orange }]}>
                  {pending}
                </Text>
                <Text style={styles.statLabel}>{t("history.pending")}</Text>
              </View>
            ) : (
              <View style={styles.statCol}>
                <Text style={[Typography.statLG, { color: C.danger }]}>
                  {missed}
                </Text>
                <Text style={styles.statLabel}>{t("history.missed")}</Text>
              </View>
            )}
            <View style={styles.statCol}>
              <Text style={[Typography.statLG, { color: C.accent }]}>
                +{xp}
              </Text>
              <Text style={styles.statLabel}>{t("routeMap.xpEarned")}</Text>
            </View>
          </View>

          <ScrollView
            style={{ maxHeight: 220 }}
            showsVerticalScrollIndicator={false}
          >
            <View style={{ gap: Spacing.sm, paddingTop: Spacing.sm }}>
              {missions.map((m) => {
                const rowColor = colorForMission(m);
                const iconName = getMissionIconName(m.iconType);
                return (
                  <Pressable
                    key={m.id}
                    onPress={() => focusMission(m)}
                    style={[
                      styles.row,
                      m.status === "missed" && styles.rowMissed,
                      m.status === "pending" && styles.rowPending,
                      selectedMissionId === m.id && {
                        borderColor: rowColor,
                        backgroundColor: hexToRgba(rowColor, 0.12),
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.rowNumber,
                        {
                          backgroundColor: hexToRgba(rowColor, 0.15),
                          borderColor: hexToRgba(rowColor, 0.6),
                        },
                      ]}
                    >
                      <Ionicons name={iconName} size={16} color={rowColor} />
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
                            ? t("routeMap.notCompletedYet")
                            : t("history.notCompleted")}
                      </Text>
                    </View>
                    {m.status === "completed" ? (
                      <Text style={[Typography.statMD, { color: rowColor }]}>
                        +{m.earnedXP}
                      </Text>
                    ) : m.status === "pending" ? (
                      <View style={styles.pendingPill}>
                        <Text style={styles.pendingPillText}>{t("history.pending")}</Text>
                      </View>
                    ) : (
                      <View style={styles.missedPill}>
                        <Text style={styles.missedPillText}>{t("history.missed")}</Text>
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
