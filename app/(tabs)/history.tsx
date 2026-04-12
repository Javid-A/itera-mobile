import { useCallback, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import ScreenContainer from '../../components/ScreenContainer';
import { Colors, Spacing, Typography } from '../../constants';
import { loadHistory } from '../../src/storage/history';
import { loadProfile, XP_PER_LEVEL } from '../../src/storage/profile';
import type { CompletedMission } from '../../src/types/CompletedMission';
import type { Profile } from '../../src/types/Profile';

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

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

export default function HistoryScreen() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [history, setHistory] = useState<CompletedMission[]>([]);

  useFocusEffect(
    useCallback(() => {
      loadProfile().then(setProfile);
      loadHistory().then(setHistory);
    }, [])
  );

  const xpTarget = (profile?.currentLevel ?? 1) * XP_PER_LEVEL;
  const xpProgress = profile ? profile.currentXP / xpTarget : 0;

  return (
    <ScreenContainer>
      {/* Player Header */}
      <View style={styles.headerCard}>
        <View style={styles.avatarPlaceholder}>
          <Text style={[Typography.h2, { color: Colors.textSecondary }]}>
            {(profile?.username ?? 'A')[0]}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[Typography.label, { color: Colors.textSecondary }]}>PLAYER</Text>
          <Text style={[Typography.h2, { color: Colors.textPrimary }]}>
            {profile?.username ?? '...'}
          </Text>
          <View style={styles.levelRow}>
            <View style={styles.levelBadge}>
              <Text style={[Typography.caption, { color: Colors.textPrimary, fontWeight: '700' }]}>
                LEVEL {profile?.currentLevel ?? 1}
              </Text>
            </View>
            <Text style={[Typography.caption, { color: Colors.textSecondary, marginLeft: Spacing.sm }]}>
              {profile?.currentXP ?? 0} / {xpTarget} XP
            </Text>
          </View>
          <View style={styles.xpTrack}>
            <View style={[styles.xpFill, { flex: xpProgress }]} />
            <View style={{ flex: 1 - xpProgress }} />
          </View>
        </View>
      </View>

      {/* Mission History Header */}
      <Text style={[Typography.h3, { color: Colors.textPrimary, marginTop: Spacing.lg, marginBottom: Spacing.sm }]}>
        MISSION HISTORY
      </Text>

      {history.length === 0 ? (
        <View style={styles.empty}>
          <Text style={[Typography.body, { color: Colors.textSecondary }]}>
            No completed missions yet.
          </Text>
        </View>
      ) : (
        <>
          <FlatList
            data={history}
            keyExtractor={(item) => item.id}
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingBottom: Spacing.md }}
            renderItem={({ item }) => (
              <View style={styles.missionCard}>
                <View style={styles.missionDot} />
                <View style={{ flex: 1 }}>
                  <Text style={[Typography.caption, { color: Colors.textSecondary }]}>
                    {formatDate(item.completedAt)} · {formatTime(item.completedAt)}
                  </Text>
                  <Text style={[Typography.body, { color: Colors.textPrimary }]}>
                    {item.missionName}
                  </Text>
                </View>
                <View style={styles.xpBadge}>
                  <Text style={[Typography.caption, { color: Colors.accent, fontWeight: '700' }]}>
                    +{item.xpEarned} XP
                  </Text>
                </View>
              </View>
            )}
          />

          {/* 2D Minimap */}
          {MapboxAvailable && history.some((m) => m.latitude) && (
            <View style={styles.minimapContainer}>
              <MapView
                style={styles.minimap}
                styleURL="mapbox://styles/mapbox/dark-v11"
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
                    centerCoordinate: [
                      history[0].longitude,
                      history[0].latitude,
                    ],
                    zoomLevel: 13,
                    pitch: 0,
                  }}
                />
                {history.map((m) => (
                  <MarkerView
                    key={m.id}
                    coordinate={[m.longitude, m.latitude]}
                  >
                    <View style={styles.minimapDot} />
                  </MarkerView>
                ))}
              </MapView>
            </View>
          )}
        </>
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
    alignItems: 'center',
    gap: Spacing.md,
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
  missionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 10,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  missionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.accent,
    marginRight: Spacing.md,
  },
  xpBadge: {
    backgroundColor: Colors.background,
    borderRadius: 6,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  minimapContainer: {
    height: 160,
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: Spacing.sm,
    marginBottom: Spacing.md,
  },
  minimap: {
    flex: 1,
  },
  minimapDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.accent,
    borderWidth: 2,
    borderColor: Colors.textPrimary,
  },
});
