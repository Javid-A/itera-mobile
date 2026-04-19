import { useCallback, useRef, useState } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import ScreenContainer from '../../components/ScreenContainer';
import { Colors, Spacing, Typography } from '../../constants';
import apiClient from '../../src/services/apiClient';
import type { CompletedMission } from '../../src/types/CompletedMission';

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

interface DayGroup {
  dateKey: string;
  label: string;
  totalXP: number;
  missions: CompletedMission[];
}

function toDateKey(iso: string): string {
  return iso.slice(0, 10);
}

function formatDayLabel(dateKey: string): string {
  const d = new Date(dateKey + 'T00:00:00');
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function groupByDay(missions: CompletedMission[]): DayGroup[] {
  const map = new Map<string, DayGroup>();
  for (const m of missions) {
    const key = toDateKey(m.completedAt);
    if (!map.has(key)) {
      map.set(key, { dateKey: key, label: formatDayLabel(key), totalXP: 0, missions: [] });
    }
    const group = map.get(key)!;
    group.totalXP += m.earnedXP;
    group.missions.push(m);
  }
  return Array.from(map.values()).sort((a, b) => b.dateKey.localeCompare(a.dateKey));
}

const MAP_FRAME_H = 160;
const MAP_FRAME_W = 320;

function spreadDuplicates(missions: CompletedMission[]): { id: string; lng: number; lat: number }[] {
  const OFFSET_DEG = 0.00018;
  const seen = new Map<string, number>();

  return missions.map((m) => {
    const key = `${m.latitude.toFixed(6)},${m.longitude.toFixed(6)}`;
    const idx = seen.get(key) ?? 0;
    seen.set(key, idx + 1);

    if (idx === 0) return { id: m.id, lng: m.longitude, lat: m.latitude };

    const angle = (idx / 6) * 2 * Math.PI;
    return {
      id: m.id,
      lng: m.longitude + OFFSET_DEG * Math.cos(angle),
      lat: m.latitude + OFFSET_DEG * Math.sin(angle),
    };
  });
}

function calcCameraProps(missions: CompletedMission[]) {
  const valid = missions.filter((m) => m.latitude !== 0 || m.longitude !== 0);
  if (valid.length === 0) return null;

  const lngs = valid.map((m) => m.longitude);
  const lats = valid.map((m) => m.latitude);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const centerLng = (minLng + maxLng) / 2;
  const centerLat = (minLat + maxLat) / 2;

  const lngSpan = maxLng - minLng;
  const latSpan = maxLat - minLat;

  if (lngSpan < 0.0001 && latSpan < 0.0001) {
    return { centerCoordinate: [centerLng, centerLat] as [number, number], zoom: 15 };
  }

  const lngZoom = Math.log2((MAP_FRAME_W / 256) * (360 / lngSpan));
  const latZoom = Math.log2((MAP_FRAME_H / 256) * (170 / latSpan));
  const zoom = Math.max(1, Math.min(15, Math.floor(Math.min(lngZoom, latZoom)) - 1));

  return { centerCoordinate: [centerLng, centerLat] as [number, number], zoom };
}

function DayAccordion({ group, defaultOpen }: { group: DayGroup; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const anim = useRef(new Animated.Value(defaultOpen ? 1 : 0)).current;

  const toggle = () => {
    const next = !open;
    setOpen(next);
    Animated.timing(anim, {
      toValue: next ? 1 : 0,
      duration: 220,
      useNativeDriver: false,
    }).start();
  };

  const chevronRotation = anim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  const camera = calcCameraProps(group.missions);

  return (
    <View style={styles.accordion}>
      <Pressable style={styles.accordionHeader} onPress={toggle}>
        <View style={styles.accordionLeft}>
          <Text style={[Typography.displaySM, { color: Colors.textPrimary }]}>
            {group.label}
          </Text>
          <Text style={[Typography.caption, { color: Colors.textSecondary, marginTop: 2 }]}>
            {group.missions.length} {group.missions.length === 1 ? 'MISSION' : 'MISSIONS'}
          </Text>
        </View>
        <View style={styles.accordionRight}>
          <View style={styles.xpBadge}>
            <Text style={[Typography.label, { color: Colors.accent }]}>
              +{group.totalXP} XP
            </Text>
          </View>
          <Animated.View style={{ transform: [{ rotate: chevronRotation }], marginLeft: Spacing.sm }}>
            <Ionicons name="chevron-down" size={16} color={Colors.textSecondary} />
          </Animated.View>
        </View>
      </Pressable>

      {open && (
        <>
          <View style={styles.missionList}>
            {group.missions.map((m) => (
              <View key={m.id} style={styles.missionRow}>
                <View style={styles.missionDot} />
                <View style={{ flex: 1 }}>
                  <Text style={[Typography.bodyMedium, { color: Colors.textPrimary }]}>
                    {m.missionName}
                  </Text>
                  <Text style={[Typography.caption, { color: Colors.textSecondary, marginTop: 2 }]}>
                    {formatTime(m.completedAt)}
                  </Text>
                </View>
                <Text style={[Typography.statSM, { color: Colors.accent }]}>
                  +{m.earnedXP}
                </Text>
              </View>
            ))}
          </View>

          {MapboxAvailable && camera && (
            <View style={styles.mapFrame}>
              <MapView
                style={styles.mapView}
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
                  defaultSettings={{
                    centerCoordinate: camera.centerCoordinate,
                    zoomLevel: camera.zoom,
                    pitch: 0,
                  }}
                />
                {spreadDuplicates(group.missions).map((p) => (
                  <MarkerView
                    key={p.id}
                    coordinate={[p.lng, p.lat]}
                    anchor={{ x: 0.5, y: 0.5 }}
                  >
                    <View style={styles.mapPin}>
                      <View style={styles.mapPinInner} />
                    </View>
                  </MarkerView>
                ))}
              </MapView>

              <View style={styles.mapOverlayBadge}>
                <Ionicons name="checkmark-circle" size={11} color={Colors.accent} />
                <Text style={[Typography.label, { color: Colors.accent, marginLeft: 4 }]}>
                  {group.missions.length} COMPLETED
                </Text>
              </View>
            </View>
          )}
        </>
      )}
    </View>
  );
}

export default function HistoryScreen() {
  const router = useRouter();
  const [history, setHistory] = useState<CompletedMission[]>([]);

  useFocusEffect(
    useCallback(() => {
      apiClient.get<CompletedMission[]>('/missions/history').then(({ data }) => setHistory(data)).catch(() => {});
    }, [])
  );

  const dayGroups = groupByDay(history);
  const totalMissions = history.length;
  const totalXP = history.reduce((sum, m) => sum + m.earnedXP, 0);

  return (
    <ScreenContainer>
      <View style={styles.headerRow}>
        <View>
          <Text style={[Typography.label, { color: Colors.textSecondary }]}>ACTIVITY</Text>
          <Text style={[Typography.displayLG, { color: Colors.textPrimary, marginTop: 2 }]}>
            MISSION LOG
          </Text>
        </View>
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Text style={[Typography.statMD, { color: Colors.textPrimary }]}>{totalMissions}</Text>
            <Text style={[Typography.label, { color: Colors.textSecondary }]}>TOTAL</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={[Typography.statMD, { color: Colors.accent }]}>{totalXP}</Text>
            <Text style={[Typography.label, { color: Colors.textSecondary }]}>XP</Text>
          </View>
        </View>
      </View>

      {dayGroups.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="map-outline" size={48} color={Colors.border} style={{ marginBottom: Spacing.md }} />
          <Text style={[Typography.bodyLg, { color: Colors.textSecondary, textAlign: 'center' }]}>
            No completed missions yet.
          </Text>
          <Pressable onPress={() => router.push('/(tabs)/map')} style={styles.emptyAction}>
            <Text style={[Typography.cta, { color: Colors.accent, fontSize: 13 }]}>
              GO TO MAP →
            </Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: Spacing.xxl, paddingTop: Spacing.md }}
        >
          {dayGroups.map((group, i) => (
            <DayAccordion key={group.dateKey} group={group} defaultOpen={i === 0} />
          ))}
        </ScrollView>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: Spacing.md,
    marginBottom: Spacing.md,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.borderBright,
    borderRadius: 12,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  summaryItem: {
    alignItems: 'center',
    minWidth: 40,
  },
  summaryDivider: {
    width: 1,
    height: 24,
    backgroundColor: Colors.border,
    marginHorizontal: Spacing.md,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyAction: {
    marginTop: Spacing.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  accordion: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.borderBright,
    overflow: 'hidden',
  },
  accordionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
  },
  accordionLeft: {
    flex: 1,
  },
  accordionRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  xpBadge: {
    backgroundColor: Colors.accentDim,
    borderRadius: 8,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: Colors.accentDim,
  },
  missionList: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  missionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  missionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.accent,
    marginRight: Spacing.md,
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },
  mapFrame: {
    height: 160,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  mapView: {
    flex: 1,
  },
  mapPin: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Colors.accentDim,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: Colors.accent,
  },
  mapPinInner: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: Colors.accent,
  },
  mapOverlayBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(7, 8, 15, 0.85)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: Colors.accentDim,
  },
});
