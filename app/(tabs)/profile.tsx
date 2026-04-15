import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import ScreenContainer from '../../components/ScreenContainer';
import BackgroundLocationPrompt from '../../components/BackgroundLocationPrompt';
import { Colors, Spacing, Typography } from '../../constants';
import { useAuth } from '../../src/context/AuthContext';
import apiClient from '../../src/services/apiClient';
import { openAppPermissions, requestBackgroundLocation } from '../../src/services/locationSettings';

const XP_PER_LEVEL = 1000;

interface ProfileStats {
  currentLevel: number;
  currentXP: number;
  totalMissions: number;
  totalXP: number;
}

export default function ProfileScreen() {
  const { username, logout } = useAuth();
  const [stats, setStats] = useState<ProfileStats>({ currentLevel: 1, currentXP: 0, totalMissions: 0, totalXP: 0 });
  const [bgGranted, setBgGranted] = useState(false);
  const [showBgPrompt, setShowBgPrompt] = useState(false);
  const appState = useRef(AppState.currentState);

  const checkBgPermission = useCallback(() => {
    Location.getBackgroundPermissionsAsync().then((bg) => setBgGranted(bg.status === 'granted'));
  }, []);

  const refresh = useCallback(() => {
    apiClient.get<ProfileStats>('/profile').then(({ data }) => setStats(data)).catch(() => {});
    checkBgPermission();
  }, [checkBgPermission]);

  useFocusEffect(refresh);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (appState.current.match(/inactive|background/) && next === 'active') {
        checkBgPermission();
      }
      appState.current = next;
    });
    return () => sub.remove();
  }, [checkBgPermission]);

  // When permission is OFF: modal closes → request permission → opens settings if needed
  const handleEnableAutoTracking = async () => {
    setShowBgPrompt(false);
    const granted = await requestBackgroundLocation();
    if (granted) setBgGranted(true);
  };

  // Tap the settings row: OFF → show modal, ON → open settings to revoke
  const handleAutoTrackingPress = () => {
    if (bgGranted) {
      openAppPermissions();
    } else {
      setShowBgPrompt(true);
    }
  };

  const xpTarget = stats.currentLevel * XP_PER_LEVEL;
  const xpProgress = stats.currentXP / xpTarget;

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: logout },
    ]);
  };

  return (
    <ScreenContainer>
      {/* Player Identity */}
      <View style={styles.identitySection}>
        <View style={styles.avatar}>
          <Ionicons name="person" size={40} color={Colors.textSecondary} />
        </View>
        <Text style={[Typography.h1, { color: Colors.textPrimary, marginTop: Spacing.md }]}>
          {username ?? '...'}
        </Text>
        <View style={styles.levelBadge}>
          <Text style={[Typography.caption, { color: Colors.textPrimary, fontWeight: '700' }]}>
            LEVEL {stats.currentLevel}
          </Text>
        </View>
        <View style={styles.xpRow}>
          <View style={styles.xpTrack}>
            <View style={[styles.xpFill, { flex: xpProgress }]} />
            <View style={{ flex: 1 - xpProgress }} />
          </View>
          <Text style={[Typography.caption, { color: Colors.textSecondary, marginLeft: Spacing.sm }]}>
            {stats.currentXP} / {xpTarget} XP
          </Text>
        </View>
      </View>

      {/* Stats Grid */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={[Typography.h1, { color: Colors.accent }]}>{stats.totalXP}</Text>
          <Text style={[Typography.label, { color: Colors.textSecondary }]}>Total XP</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[Typography.h1, { color: Colors.accent }]}>{stats.totalMissions}</Text>
          <Text style={[Typography.label, { color: Colors.textSecondary }]}>Missions</Text>
        </View>
      </View>

      {/* Location Settings */}
      <View style={styles.settingsSection}>
        <Text style={[Typography.label, { color: Colors.textSecondary, marginBottom: Spacing.sm }]}>
          Settings
        </Text>
        <Pressable style={styles.settingsRow} onPress={handleAutoTrackingPress}>
          <Ionicons name="navigate-outline" size={20} color={bgGranted ? Colors.accent : Colors.textSecondary} />
          <View style={{ flex: 1, marginLeft: Spacing.md }}>
            <Text style={[Typography.body, { color: Colors.textPrimary }]}>Auto-Tracking</Text>
            <Text style={[Typography.caption, { color: Colors.textSecondary }]}>
              {bgGranted ? 'Missions complete automatically' : 'Tap to enable background location'}
            </Text>
          </View>
          <View style={[styles.statusPill, bgGranted ? styles.statusOn : styles.statusOff]}>
            <Text style={[Typography.caption, { color: bgGranted ? Colors.accent : Colors.textSecondary, fontWeight: '700' }]}>
              {bgGranted ? 'ON' : 'OFF'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={Colors.textSecondary} style={{ marginLeft: Spacing.xs }} />
        </Pressable>
      </View>

      <BackgroundLocationPrompt
        visible={showBgPrompt}
        onEnable={handleEnableAutoTracking}
        onSkip={() => setShowBgPrompt(false)}
      />

      {/* Account */}
      <View style={styles.dangerZone}>
        <Pressable style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={16} color={Colors.textSecondary} />
          <Text style={[Typography.caption, { color: Colors.textSecondary, marginLeft: Spacing.sm }]}>Sign Out</Text>
        </Pressable>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  identitySection: { alignItems: 'center', marginTop: Spacing.xl },
  avatar: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: Colors.border,
  },
  levelBadge: {
    backgroundColor: Colors.accent, borderRadius: 4,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, marginTop: Spacing.sm,
  },
  xpRow: { flexDirection: 'row', alignItems: 'center', width: '80%', marginTop: Spacing.sm },
  xpTrack: {
    flex: 1, flexDirection: 'row', height: 8,
    backgroundColor: Colors.border, borderRadius: 4, overflow: 'hidden',
  },
  xpFill: { backgroundColor: Colors.accent, borderRadius: 4 },
  statsRow: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.xl },
  statCard: {
    flex: 1, backgroundColor: Colors.surface, borderRadius: 12,
    padding: Spacing.lg, alignItems: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  settingsSection: { marginTop: Spacing.xl },
  settingsRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surface, borderRadius: 12, padding: Spacing.md,
    borderWidth: 1, borderColor: Colors.border,
  },
  statusPill: { paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: 10, borderWidth: 1 },
  statusOn: { borderColor: Colors.accent, backgroundColor: 'rgba(255,87,34,0.1)' },
  statusOff: { borderColor: Colors.border, backgroundColor: Colors.background },
  dangerZone: {
    marginTop: 'auto', marginBottom: Spacing.lg,
  },
  logoutButton: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
});
