import { useCallback, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import ScreenContainer from '../../components/ScreenContainer';
import BackgroundLocationPrompt from '../../components/BackgroundLocationPrompt';
import { Colors, Spacing, Typography } from '../../constants';
import { loadProfile, XP_PER_LEVEL } from '../../src/storage/profile';
import { loadHistory } from '../../src/storage/history';
import type { Profile } from '../../src/types/Profile';

export default function ProfileScreen() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [totalMissions, setTotalMissions] = useState(0);
  const [totalXP, setTotalXP] = useState(0);
  const [bgGranted, setBgGranted] = useState(false);
  const [showBgPrompt, setShowBgPrompt] = useState(false);

  const refresh = useCallback(() => {
    loadProfile().then(setProfile);
    loadHistory().then((h) => {
      setTotalMissions(h.length);
      setTotalXP(h.reduce((sum, m) => sum + m.xpEarned, 0));
    });
    Location.getBackgroundPermissionsAsync().then((bg) => {
      setBgGranted(bg.status === 'granted');
    });
  }, []);

  useFocusEffect(refresh);

  const xpTarget = (profile?.currentLevel ?? 1) * XP_PER_LEVEL;
  const xpProgress = profile ? profile.currentXP / xpTarget : 0;

  const handleReset = () => {
    Alert.alert(
      'Reset All Data',
      'This will wipe your profile, routines, and mission history. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            await AsyncStorage.clear();
            refresh();
          },
        },
      ]
    );
  };

  return (
    <ScreenContainer>
      {/* Player Identity */}
      <View style={styles.identitySection}>
        <View style={styles.avatar}>
          <Ionicons name="person" size={40} color={Colors.textSecondary} />
        </View>
        <Text style={[Typography.h1, { color: Colors.textPrimary, marginTop: Spacing.md }]}>
          {profile?.username ?? '...'}
        </Text>
        <View style={styles.levelBadge}>
          <Text style={[Typography.caption, { color: Colors.textPrimary, fontWeight: '700' }]}>
            LEVEL {profile?.currentLevel ?? 1}
          </Text>
        </View>
        <View style={styles.xpRow}>
          <View style={styles.xpTrack}>
            <View style={[styles.xpFill, { flex: xpProgress }]} />
            <View style={{ flex: 1 - xpProgress }} />
          </View>
          <Text style={[Typography.caption, { color: Colors.textSecondary, marginLeft: Spacing.sm }]}>
            {profile?.currentXP ?? 0} / {xpTarget} XP
          </Text>
        </View>
      </View>

      {/* Stats Grid */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={[Typography.h1, { color: Colors.accent }]}>{totalXP}</Text>
          <Text style={[Typography.label, { color: Colors.textSecondary }]}>Total XP</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[Typography.h1, { color: Colors.accent }]}>{totalMissions}</Text>
          <Text style={[Typography.label, { color: Colors.textSecondary }]}>Missions</Text>
        </View>
      </View>

      {/* Location Settings */}
      <View style={styles.settingsSection}>
        <Text style={[Typography.label, { color: Colors.textSecondary, marginBottom: Spacing.sm }]}>
          Settings
        </Text>
        <Pressable
          style={styles.settingsRow}
          onPress={() => {
            if (!bgGranted) setShowBgPrompt(true);
          }}
        >
          <Ionicons
            name="navigate-outline"
            size={20}
            color={bgGranted ? Colors.accent : Colors.textSecondary}
          />
          <View style={{ flex: 1, marginLeft: Spacing.md }}>
            <Text style={[Typography.body, { color: Colors.textPrimary }]}>
              Auto-Tracking
            </Text>
            <Text style={[Typography.caption, { color: Colors.textSecondary }]}>
              {bgGranted ? 'Missions complete automatically' : 'Tap to enable background location'}
            </Text>
          </View>
          <View style={[styles.statusPill, bgGranted ? styles.statusOn : styles.statusOff]}>
            <Text style={[Typography.caption, { color: bgGranted ? Colors.accent : Colors.textSecondary, fontWeight: '700' }]}>
              {bgGranted ? 'ON' : 'OFF'}
            </Text>
          </View>
          {!bgGranted && (
            <Ionicons name="chevron-forward" size={18} color={Colors.textSecondary} style={{ marginLeft: Spacing.xs }} />
          )}
        </Pressable>
      </View>

      <BackgroundLocationPrompt
        visible={showBgPrompt}
        onEnable={() => {
          setShowBgPrompt(false);
          refresh();
        }}
        onSkip={() => setShowBgPrompt(false)}
      />

      {/* Debug / Reset */}
      <View style={styles.dangerZone}>
        <Text style={[Typography.label, { color: Colors.textSecondary, marginBottom: Spacing.sm }]}>
          Developer Settings
        </Text>
        <Pressable style={styles.resetButton} onPress={handleReset}>
          <Ionicons name="trash-outline" size={18} color="#FF4444" />
          <Text style={[Typography.body, { color: '#FF4444', marginLeft: Spacing.sm }]}>
            Reset All Data
          </Text>
        </Pressable>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  identitySection: {
    alignItems: 'center',
    marginTop: Spacing.xl,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.border,
  },
  levelBadge: {
    backgroundColor: Colors.accent,
    borderRadius: 4,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    marginTop: Spacing.sm,
  },
  xpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '80%',
    marginTop: Spacing.sm,
  },
  xpTrack: {
    flex: 1,
    flexDirection: 'row',
    height: 6,
    backgroundColor: Colors.border,
    borderRadius: 3,
    overflow: 'hidden',
  },
  xpFill: {
    backgroundColor: Colors.accent,
    borderRadius: 3,
  },
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.xl,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: Spacing.lg,
    alignItems: 'center',
  },
  settingsSection: {
    marginTop: Spacing.xl,
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: Spacing.md,
  },
  statusPill: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
  },
  statusOn: {
    borderColor: Colors.accent,
    backgroundColor: 'rgba(255,87,34,0.1)',
  },
  statusOff: {
    borderColor: Colors.border,
    backgroundColor: Colors.background,
  },
  dangerZone: {
    marginTop: 'auto',
    marginBottom: Spacing.lg,
    paddingTop: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FF4444',
  },
});
