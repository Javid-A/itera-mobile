import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Typography } from '../constants';
import type { CompletedMission } from '../src/types/CompletedMission';

let MapboxAvailable = false;
let MapView: any;
let Camera: any;
let MarkerView: any;

try {
  const maps = require('@rnmapbox/maps');
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
  missions: CompletedMission[];
  onClose: () => void;
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function calcCenter(missions: CompletedMission[]): { center: [number, number]; zoom: number } | null {
  const valid = missions.filter((m) => m.latitude !== 0 || m.longitude !== 0);
  if (valid.length === 0) return null;
  const lngs = valid.map((m) => m.longitude);
  const lats = valid.map((m) => m.latitude);
  const center: [number, number] = [
    (Math.min(...lngs) + Math.max(...lngs)) / 2,
    (Math.min(...lats) + Math.max(...lats)) / 2,
  ];
  return { center, zoom: 14 };
}

export default function RouteMapModal({ visible, date, missions, onClose }: Props) {
  const completed = missions.length;
  const total = Math.max(missions.length, 3);
  const missed = total - completed;
  const xp = missions.reduce((sum, m) => sum + m.earnedXP, 0);
  const camera = calcCenter(missions);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.handle} />

          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={[Typography.displayMD, { color: Colors.textPrimary }]}>Today</Text>
                <View style={styles.dot} />
                <Text style={[Typography.displayMD, { color: Colors.textPrimary }]}>Route Map</Text>
              </View>
              <Text style={[Typography.caption, { color: Colors.textSecondary, marginTop: 2 }]}>
                {date ? formatDate(date) : ''} · {total} missions planned
              </Text>
            </View>
            <Pressable style={styles.closeButton} onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={20} color={Colors.textSecondary} />
            </Pressable>
          </View>

          <View style={styles.mapWrap}>
            <View style={styles.mapLegend}>
              <View style={styles.legendChip}>
                <View style={[styles.legendDot, { backgroundColor: Colors.accent }]} />
                <Text style={styles.legendText}>COMPLETED</Text>
              </View>
              <View style={[styles.legendChip, { borderColor: 'rgba(239, 68, 68, 0.55)' }]}>
                <View style={[styles.legendDot, { backgroundColor: Colors.danger }]} />
                <Text style={[styles.legendText, { color: Colors.danger }]}>MISSED</Text>
              </View>
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
                <Camera defaultSettings={{ centerCoordinate: camera.center, zoomLevel: camera.zoom, pitch: 45 }} />
                {missions.map((m, i) => (
                  <MarkerView key={m.id} coordinate={[m.longitude, m.latitude]} anchor={{ x: 0.5, y: 0.5 }}>
                    <View style={styles.numberedPin}>
                      <Text style={styles.numberedPinText}>{i + 1}</Text>
                    </View>
                  </MarkerView>
                ))}
              </MapView>
            ) : (
              <View style={styles.mapPlaceholder} />
            )}

            <View style={styles.dailyRouteChip}>
              <Ionicons name="git-network-outline" size={12} color={Colors.textSecondary} />
              <Text style={styles.dailyRouteText}>DAILY ROUTE</Text>
            </View>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statCol}>
              <Text style={[Typography.statLG, { color: Colors.textPrimary }]}>{total}</Text>
              <Text style={styles.statLabel}>TOTAL</Text>
            </View>
            <View style={styles.statCol}>
              <Text style={[Typography.statLG, { color: Colors.accent }]}>{completed}</Text>
              <Text style={styles.statLabel}>DONE</Text>
            </View>
            <View style={styles.statCol}>
              <Text style={[Typography.statLG, { color: Colors.danger }]}>{missed}</Text>
              <Text style={styles.statLabel}>MISSED</Text>
            </View>
            <View style={styles.statCol}>
              <Text style={[Typography.statLG, { color: Colors.accent }]}>+{xp}</Text>
              <Text style={styles.statLabel}>XP EARNED</Text>
            </View>
          </View>

          <ScrollView style={{ maxHeight: 220 }} showsVerticalScrollIndicator={false}>
            <View style={{ gap: Spacing.sm, paddingTop: Spacing.sm }}>
              {missions.map((m, i) => (
                <View key={m.id} style={styles.row}>
                  <View style={styles.rowNumber}>
                    <Text style={styles.rowNumberText}>{i + 1}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[Typography.bodyBold, { color: Colors.textPrimary }]}>{m.missionName}</Text>
                    <Text style={[Typography.caption, { color: Colors.textSecondary, marginTop: 2 }]}>
                      {formatTime(m.completedAt)}
                    </Text>
                  </View>
                  <Text style={[Typography.statMD, { color: Colors.accent }]}>+{m.earnedXP}</Text>
                </View>
              ))}
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
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
    alignSelf: 'center',
    marginBottom: Spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapWrap: {
    height: 200,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: Colors.surface2,
    borderWidth: 1,
    borderColor: Colors.borderBright,
    marginTop: Spacing.md,
    position: 'relative',
  },
  map: {
    flex: 1,
  },
  mapPlaceholder: {
    flex: 1,
    backgroundColor: Colors.surface2,
  },
  mapLegend: {
    position: 'absolute',
    top: Spacing.sm,
    right: Spacing.sm,
    zIndex: 10,
    gap: 6,
    alignItems: 'flex-end',
  },
  legendChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(7, 8, 15, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(166, 230, 53, 0.55)',
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
    fontFamily: 'Rajdhani_700Bold',
    fontSize: 10,
    letterSpacing: 1.2,
    color: Colors.accent,
  },
  numberedPin: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(7, 8, 15, 0.92)',
    borderWidth: 2,
    borderColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
  },
  numberedPinText: {
    fontFamily: 'Rajdhani_700Bold',
    fontSize: 14,
    color: Colors.accent,
  },
  dailyRouteChip: {
    position: 'absolute',
    bottom: Spacing.sm,
    left: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(7, 8, 15, 0.85)',
    borderWidth: 1,
    borderColor: Colors.borderBright,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  dailyRouteText: {
    fontFamily: 'Rajdhani_700Bold',
    fontSize: 10,
    letterSpacing: 1.2,
    color: Colors.textSecondary,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Spacing.md,
    paddingVertical: Spacing.md,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: Colors.border,
  },
  statCol: {
    flex: 1,
    alignItems: 'center',
  },
  statLabel: {
    fontFamily: 'Rajdhani_700Bold',
    fontSize: 10,
    letterSpacing: 1.2,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface2,
    borderRadius: 14,
    padding: Spacing.md,
    gap: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  rowNumber: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: Colors.accentSoft,
    borderWidth: 1.5,
    borderColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowNumberText: {
    fontFamily: 'Rajdhani_700Bold',
    fontSize: 14,
    color: Colors.accent,
  },
});
