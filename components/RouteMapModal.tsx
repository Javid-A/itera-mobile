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
// Drone-effect ramp: duration and pitch interpolate against the day's spread.
// Tight cluster (~250m) → slow, pitched flyTo. Cross-city spread (~5km+) →
// snappy, flat. Driven by haversine spread, not the overview zoom — bounds
// fitting no longer produces a single zoom number we can read.
const FOCUS_FLY_MS_FAR = 850;
const FOCUS_FLY_MS_CLOSE = 2100;
const FOCUS_PITCH_MAX = 55;
const SPREAD_TIGHT_M = 250;
const SPREAD_LOOSE_M = 5000;
// Pin glyph is 30px and the legend/route chips overlay the corners — keep this
// much padding around the bbox so nothing renders under them.
const BOUNDS_PADDING = 40;

function isValidCoord(m: DayMission): boolean {
  return m.latitude !== 0 && m.longitude !== 0;
}

function haversineMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function calcCameraSettings(missions: DayMission[]): CameraSettings | null {
  // AND, not OR: a mission with one zero coord is uninitialized junk that would
  // otherwise drag the bbox to lat=0/lng=0 and break either the fit or the pin
  // render. (Today's pending missions sometimes arrive partially populated.)
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
  // Memoize so a row tap (state change) doesn't recreate the camera object and
  // re-fire the overview effect, which would yank the camera back from focus.
  const camera = useMemo(() => calcCameraSettings(missions), [missions]);
  const cameraRef = useRef<any>(null);
  const [selectedMissionId, setSelectedMissionId] = useState<string | null>(
    null,
  );
  const prevSelectedRef = useRef<string | null>(null);

  // defaultSettings only applies on mount; when the modal is reopened for a
  // different day we must push fresh camera state imperatively. Also resets
  // the focus selection so reopening always starts from the overview.
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
      // fitBounds picks the right zoom from viewport size — avoids the
      // diagonal-vs-width heuristic that overshot zoom on tightly clustered
      // (e.g. same-neighborhood) days.
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

    // Closeness: 1 when missions cluster within a few blocks (tight spread),
    // 0 when spread across the city. Drives both pitch and duration so tight
    // routes get the drone treatment and far-flung routes stay snappy.
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
                  // Skip pins for uninitialized coords — otherwise they render
                  // at (0,0) off the African coast, polluting nothing visually
                  // but still being a wasted MarkerView.
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
                </Pressable>
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
  rowSelected: {
    borderColor: Colors.accent,
    backgroundColor: Colors.accentSoft,
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
