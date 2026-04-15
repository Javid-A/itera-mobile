import { useCallback, useRef, useState } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import ScreenContainer from '../../components/ScreenContainer';
import { Colors, Spacing, Typography } from '../../constants';
import apiClient from '../../src/services/apiClient';
import { useAuth } from '../../src/context/AuthContext';
import type { CompletedMission } from '../../src/types/CompletedMission';

const XP_PER_LEVEL = 1000;
const GREEN = '#22C55E';

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

interface Profile {
  username: string;
  currentLevel: number;
  currentXP: number;
  totalMissions: number;
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

// Returns camera props to fit all mission coordinates
// Map frame dimensions (height fixed, width conservative floor for zoom calc)
const MAP_FRAME_H = 160;
const MAP_FRAME_W = 320;

// Spread pins that share identical coordinates into a small circle so they
// don't stack invisibly. Offset ≈ 20m at the given latitude.
function spreadDuplicates(missions: CompletedMission[]): { id: string; lng: number; lat: number }[] {
  const OFFSET_DEG = 0.00018; // ~20m
  const seen = new Map<string, number>(); // "lat,lng" → count

  return missions.map((m) => {
    const key = `${m.latitude.toFixed(6)},${m.longitude.toFixed(6)}`;
    const idx = seen.get(key) ?? 0;
    seen.set(key, idx + 1);

    if (idx === 0) return { id: m.id, lng: m.longitude, lat: m.latitude };

    // Distribute duplicates evenly around a small circle
    const angle = (idx / 6) * 2 * Math.PI; // max 6 before overlap
    return {
      id: m.id,
      lng: m.longitude + OFFSET_DEG * Math.cos(angle),
      lat: m.latitude + OFFSET_DEG * Math.sin(angle),
    };
  });
}

// Calculates { centerCoordinate, zoom } to fit all valid pins.
// Uses explicit Mercator zoom formula so every pin is always visible
// regardless of how spread out they are.
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

  // All pins at the same spot → street-level zoom
  if (lngSpan < 0.0001 && latSpan < 0.0001) {
    return { centerCoordinate: [centerLng, centerLat] as [number, number], zoom: 15 };
  }

  // Standard Web-Mercator: at zoom Z, 256 × 2^Z px covers 360° of longitude.
  // Solve for Z per axis, take the tighter one, subtract 1 for padding margin.
  const lngZoom = Math.log2((MAP_FRAME_W / 256) * (360 / lngSpan));
  const latZoom = Math.log2((MAP_FRAME_H / 256) * (170 / latSpan)); // 170 ≈ Mercator-visible range
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
      {/* Header */}
      <Pressable style={styles.accordionHeader} onPress={toggle}>
        <View style={styles.accordionLeft}>
          <Text style={[Typography.label, { color: Colors.textPrimary, fontWeight: '700' }]}>
            {group.label}
          </Text>
          <Text style={[Typography.caption, { color: Colors.textSecondary, marginTop: 2 }]}>
            {group.missions.length} {group.missions.length === 1 ? 'mission' : 'missions'}
          </Text>
        </View>
        <View style={styles.accordionRight}>
          <View style={styles.xpBadge}>
            <Text style={[Typography.caption, { color: Colors.accent, fontWeight: '700' }]}>
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
          {/* Mission rows */}
          <View style={styles.missionList}>
            {group.missions.map((m) => (
              <View key={m.id} style={styles.missionRow}>
                <View style={styles.missionDot} />
                <View style={{ flex: 1 }}>
                  <Text style={[Typography.body, { color: Colors.textPrimary }]}>
                    {m.missionName}
                  </Text>
                  <Text style={[Typography.caption, { color: Colors.textSecondary }]}>
                    {formatTime(m.completedAt)}
                  </Text>
                </View>
                <Text style={[Typography.caption, { color: Colors.accent, fontWeight: '700' }]}>
                  +{m.earnedXP} XP
                </Text>
              </View>
            ))}
          </View>

          {/* Map frame */}
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
                {group.missions.map((m) => (
                  <MarkerView
                    key={m.id}
                    coordinate={[m.longitude, m.latitude]}
                    anchor={{ x: 0.5, y: 0.5 }}
                  >
                    <View style={styles.mapPin}>
                      <View style={styles.mapPinInner} />
                    </View>
                  </MarkerView>
                ))}
              </MapView>

              {/* Overlay: day label bottom-left */}
              <View style={styles.mapOverlayBadge}>
                <Ionicons name="checkmark-circle" size={11} color={GREEN} />
                <Text style={[Typography.caption, { color: GREEN, marginLeft: 4, fontWeight: '700', fontSize: 10 }]}>
                  {group.missions.length} completed
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
  const { username } = useAuth();
  const router = useRouter();
  const [history, setHistory] = useState<CompletedMission[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);

  useFocusEffect(
    useCallback(() => {
      apiClient.get<CompletedMission[]>('/missions/history').then(({ data }) => setHistory(data)).catch(() => {});
      apiClient.get<Profile>('/profile').then(({ data }) => setProfile(data)).catch(() => {});
    }, [])
  );

  const xpTarget = XP_PER_LEVEL;
  const xpProgress = profile ? (profile.currentXP % XP_PER_LEVEL) / XP_PER_LEVEL : 0;
  const dayGroups = groupByDay(history);

  return (
    <ScreenContainer>
      {/* Player Header */}
      <View style={styles.headerCard}>
        <View style={styles.avatarPlaceholder}>
          <Text style={[Typography.h2, { color: Colors.textSecondary }]}>
            {(username ?? 'A')[0]}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[Typography.label, { color: Colors.textSecondary }]}>PLAYER</Text>
          <Text style={[Typography.h2, { color: Colors.textPrimary }]}>
            {username ?? '...'}
          </Text>
          <View style={styles.levelRow}>
            <View style={styles.levelBadge}>
              <Text style={[Typography.caption, { color: Colors.textPrimary, fontWeight: '700' }]}>
                LEVEL {profile?.currentLevel ?? 0}
              </Text>
            </View>
            <Text style={[Typography.caption, { color: Colors.textSecondary, marginLeft: Spacing.sm }]}>
              {profile ? profile.currentXP % XP_PER_LEVEL : 0} / {xpTarget} XP
            </Text>
          </View>
          <View style={styles.xpTrack}>
            <View style={[styles.xpFill, { flex: xpProgress }]} />
            <View style={{ flex: 1 - xpProgress }} />
          </View>
        </View>
      </View>

      {/* Mission History */}
      <Text style={[Typography.h3, { color: Colors.textPrimary, marginBottom: Spacing.md }]}>
        MISSION HISTORY
      </Text>

      {dayGroups.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="map-outline" size={48} color={Colors.border} style={{ marginBottom: Spacing.md }} />
          <Text style={[Typography.body, { color: Colors.textSecondary, textAlign: 'center' }]}>
            No completed missions yet.
          </Text>
          <Pressable onPress={() => router.push('/(tabs)/map')} style={styles.emptyAction}>
            <Text style={[Typography.caption, { color: Colors.accent }]}>
              Go to Map to find missions
            </Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: Spacing.lg }}>
          {dayGroups.map((group, i) => (
            <DayAccordion key={group.dateKey} group={group} defaultOpen={i === 0} />
          ))}
        </ScrollView>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  headerCard: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: Spacing.md,
    marginTop: Spacing.md,
    marginBottom: Spacing.lg,
    alignItems: 'center',
    gap: Spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.xs,
  },
  levelBadge: {
    backgroundColor: Colors.accent,
    borderRadius: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
  },
  xpTrack: {
    flexDirection: 'row',
    height: 4,
    backgroundColor: Colors.border,
    borderRadius: 2,
    marginTop: Spacing.xs,
    overflow: 'hidden',
  },
  xpFill: {
    backgroundColor: Colors.accent,
    borderRadius: 2,
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
    borderRadius: 10,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  accordionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
  },
  accordionLeft: {
    flex: 1,
  },
  accordionRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  xpBadge: {
    backgroundColor: Colors.background,
    borderRadius: 6,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  missionList: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  missionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  missionDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.accent,
    marginRight: Spacing.md,
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
    backgroundColor: 'rgba(34, 197, 94, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: GREEN,
  },
  mapPinInner: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: GREEN,
  },
  mapOverlayBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(11, 13, 18, 0.80)',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.35)',
  },
});
