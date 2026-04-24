import { useEffect, useRef } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors, Spacing, Typography } from "../constants";
import type { DayMission } from "../app/(tabs)/history";

let MapboxAvailable = false;
let MapView: any;
let Camera: any;
let MarkerView: any;

try {
  const maps = require("@rnmapbox/maps");
  MapView = maps.MapView;
  Camera = maps.Camera;
  MarkerView = maps.MarkerView;
  MapboxAvailable = true;
} catch {
  MapboxAvailable = false;
}

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
      kind: "center";
      centerCoordinate: [number, number];
      zoomLevel: number;
      pitch: number;
    }
  | {
      kind: "bounds";
      bounds: {
        ne: [number, number];
        sw: [number, number];
        paddingLeft: number;
        paddingRight: number;
        paddingTop: number;
        paddingBottom: number;
      };
      pitch: number;
    };

function calcCameraSettings(missions: DayMission[]): CameraSettings | null {
  const valid = missions.filter((m) => m.latitude !== 0 || m.longitude !== 0);
  if (valid.length === 0) return null;

  if (valid.length === 1) {
    return {
      kind: "center",
      centerCoordinate: [valid[0].longitude, valid[0].latitude],
      zoomLevel: 16,
      pitch: 45,
    };
  }

  const lngs = valid.map((m) => m.longitude);
  const lats = valid.map((m) => m.latitude);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);

  // All markers effectively at the same point — bounds would zoom in too far, fall back to center+zoom.
  const lngSpan = maxLng - minLng;
  const latSpan = maxLat - minLat;
  if (lngSpan < 0.0005 && latSpan < 0.0005) {
    return {
      kind: "center",
      centerCoordinate: [(minLng + maxLng) / 2, (minLat + maxLat) / 2],
      zoomLevel: 16,
      pitch: 45,
    };
  }

  return {
    kind: "bounds",
    bounds: {
      ne: [maxLng, maxLat],
      sw: [minLng, minLat],
      paddingLeft: 40,
      paddingRight: 40,
      paddingTop: 60,
      paddingBottom: 60,
    },
    pitch: 0,
  };
}

const PIN_COLORS: Record<DayMission["status"], string> = {
  completed: Colors.accent,
  pending: Colors.orange,
  missed: Colors.danger,
};

export default function RouteMapModal({
  visible,
  date,
  missions,
  onClose,
}: Props) {
  const completed = missions.filter((m) => m.status === "completed").length;
  const pending = missions.filter((m) => m.status === "pending").length;
  const missed = missions.filter((m) => m.status === "missed").length;
  const total = missions.length;
  const xp = missions.reduce((sum, m) => sum + (m.earnedXP ?? 0), 0);
  const camera = calcCameraSettings(missions);
  const cameraRef = useRef<any>(null);

  // defaultSettings only applies on mount; when the modal is reopened for a
  // different day we must push fresh bounds/center imperatively.
  useEffect(() => {
    if (!visible || !camera || !cameraRef.current) return;
    if (camera.kind === "bounds") {
      cameraRef.current.setCamera({
        bounds: camera.bounds,
        pitch: camera.pitch,
        animationDuration: 0,
      });
    } else {
      cameraRef.current.setCamera({
        centerCoordinate: camera.centerCoordinate,
        zoomLevel: camera.zoomLevel,
        pitch: camera.pitch,
        animationDuration: 0,
      });
    }
  }, [visible, date, missions.length, camera]);

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
                <Text
                  style={[Typography.displayMD, { color: Colors.textPrimary }]}
                >
                  Today
                </Text>
                <View style={styles.dot} />
                <Text
                  style={[Typography.displayMD, { color: Colors.textPrimary }]}
                >
                  Route Map
                </Text>
              </View>
              <Text
                style={[
                  Typography.caption,
                  { color: Colors.textSecondary, marginTop: 2 },
                ]}
              >
                {date ? formatDate(date) : ""} · {total} missions
              </Text>
            </View>
            <Pressable style={styles.closeButton} onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={20} color={Colors.textSecondary} />
            </Pressable>
          </View>

          <View style={styles.mapWrap}>
            <View style={styles.mapLegend}>
              <View style={styles.legendChip}>
                <View
                  style={[styles.legendDot, { backgroundColor: Colors.accent }]}
                />
                <Text style={styles.legendText}>DONE</Text>
              </View>
              {pending > 0 && (
                <View
                  style={[
                    styles.legendChip,
                    { borderColor: "rgba(249, 115, 22, 0.55)" },
                  ]}
                >
                  <View
                    style={[
                      styles.legendDot,
                      { backgroundColor: Colors.orange },
                    ]}
                  />
                  <Text style={[styles.legendText, { color: Colors.orange }]}>
                    PENDING
                  </Text>
                </View>
              )}
              {missed > 0 && (
                <View
                  style={[
                    styles.legendChip,
                    { borderColor: "rgba(239, 68, 68, 0.55)" },
                  ]}
                >
                  <View
                    style={[
                      styles.legendDot,
                      { backgroundColor: Colors.danger },
                    ]}
                  />
                  <Text style={[styles.legendText, { color: Colors.danger }]}>
                    MISSED
                  </Text>
                </View>
              )}
            </View>

            {MapboxAvailable && camera ? (
              <MapView
                style={styles.map}
                styleURL="mapbox://styles/javid-a/cmnywehfe001101qz3nmtgtsa"
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
                    camera.kind === "bounds"
                      ? { bounds: camera.bounds, pitch: camera.pitch }
                      : {
                          centerCoordinate: camera.centerCoordinate,
                          zoomLevel: camera.zoomLevel,
                          pitch: camera.pitch,
                        }
                  }
                />
                {missions.map((m, i) => (
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
                ))}
              </MapView>
            ) : (
              <View style={styles.mapPlaceholder} />
            )}

            <View style={styles.dailyRouteChip}>
              <Ionicons
                name="git-network-outline"
                size={12}
                color={Colors.textSecondary}
              />
              <Text style={styles.dailyRouteText}>DAILY ROUTE</Text>
            </View>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statCol}>
              <Text style={[Typography.statLG, { color: Colors.textPrimary }]}>
                {total}
              </Text>
              <Text style={styles.statLabel}>TOTAL</Text>
            </View>
            <View style={styles.statCol}>
              <Text style={[Typography.statLG, { color: Colors.accent }]}>
                {completed}
              </Text>
              <Text style={styles.statLabel}>DONE</Text>
            </View>
            {pending > 0 ? (
              <View style={styles.statCol}>
                <Text style={[Typography.statLG, { color: Colors.orange }]}>
                  {pending}
                </Text>
                <Text style={styles.statLabel}>PENDING</Text>
              </View>
            ) : (
              <View style={styles.statCol}>
                <Text style={[Typography.statLG, { color: Colors.danger }]}>
                  {missed}
                </Text>
                <Text style={styles.statLabel}>MISSED</Text>
              </View>
            )}
            <View style={styles.statCol}>
              <Text style={[Typography.statLG, { color: Colors.accent }]}>
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
                <View
                  key={m.id}
                  style={[
                    styles.row,
                    m.status === "missed" && styles.rowMissed,
                    m.status === "pending" && styles.rowPending,
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
                      style={[
                        Typography.bodyBold,
                        { color: Colors.textPrimary },
                      ]}
                    >
                      {m.missionName}
                    </Text>
                    <Text
                      style={[
                        Typography.caption,
                        { color: Colors.textSecondary, marginTop: 2 },
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
                    <Text style={[Typography.statMD, { color: Colors.accent }]}>
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
                </View>
              ))}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xxl,
    borderTopWidth: 1,
    borderColor: Colors.borderBright,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.muted,
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
    backgroundColor: Colors.accent,
    marginHorizontal: 4,
  },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: Colors.surface2,
    borderWidth: 1,
    borderColor: Colors.borderBright,
    alignItems: "center",
    justifyContent: "center",
  },
  mapWrap: {
    height: 200,
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: Colors.surface2,
    borderWidth: 1,
    borderColor: Colors.borderBright,
    marginTop: Spacing.md,
    position: "relative",
  },
  map: {
    flex: 1,
  },
  mapPlaceholder: {
    flex: 1,
    backgroundColor: Colors.surface2,
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
    backgroundColor: "rgba(7, 8, 15, 0.85)",
    borderWidth: 1,
    borderColor: "rgba(166, 230, 53, 0.55)",
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
    color: Colors.accent,
  },
  numberedPin: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "rgba(7, 8, 15, 0.92)",
    borderWidth: 2,
    borderColor: Colors.accent,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: Colors.accent,
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
    color: Colors.accent,
  },
  dailyRouteChip: {
    position: "absolute",
    bottom: Spacing.sm,
    left: Spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(7, 8, 15, 0.85)",
    borderWidth: 1,
    borderColor: Colors.borderBright,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  dailyRouteText: {
    fontFamily: "Rajdhani_700Bold",
    fontSize: 10,
    letterSpacing: 1.2,
    color: Colors.textSecondary,
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: Spacing.md,
    paddingVertical: Spacing.md,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: Colors.border,
  },
  statCol: {
    flex: 1,
    alignItems: "center",
  },
  statLabel: {
    fontFamily: "Rajdhani_700Bold",
    fontSize: 10,
    letterSpacing: 1.2,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface2,
    borderRadius: 14,
    padding: Spacing.md,
    gap: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  rowMissed: {
    borderColor: "rgba(239, 68, 68, 0.3)",
  },
  rowPending: {
    borderColor: "rgba(249, 115, 22, 0.3)",
  },
  rowNumber: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: Colors.accentSoft,
    borderWidth: 1.5,
    borderColor: Colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  rowNumberText: {
    fontFamily: "Rajdhani_700Bold",
    fontSize: 14,
    color: Colors.accent,
  },
  missedPill: {
    backgroundColor: "rgba(239, 68, 68, 0.18)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.55)",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  missedPillText: {
    fontFamily: "Rajdhani_700Bold",
    fontSize: 11,
    letterSpacing: 1,
    color: Colors.danger,
  },
  pendingPill: {
    backgroundColor: "rgba(249, 115, 22, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(249, 115, 22, 0.5)",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  pendingPillText: {
    fontFamily: "Rajdhani_700Bold",
    fontSize: 11,
    letterSpacing: 1,
    color: Colors.orange,
  },
});
