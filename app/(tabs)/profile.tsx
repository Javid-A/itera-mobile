import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, AppState, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle } from 'react-native-svg';
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

const RING_SIZE = 132;
const RING_STROKE = 6;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRC = 2 * Math.PI * RING_RADIUS;

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

  const handleEnableAutoTracking = async () => {
    setShowBgPrompt(false);
    const granted = await requestBackgroundLocation();
    if (granted) setBgGranted(true);
  };

  const handleAutoTrackingPress = () => {
    if (bgGranted) {
      openAppPermissions();
    } else {
      setShowBgPrompt(true);
    }
  };

  const xpTarget = stats.currentLevel * XP_PER_LEVEL;
  const xpProgress = Math.min(1, stats.currentXP / xpTarget);
  const dashOffset = RING_CIRC * (1 - xpProgress);

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: logout },
    ]);
  };

  const handleResetStats = () => {
    Alert.alert(
      'Reset Stats',
      'This wipes all completed missions and resets XP/level to zero. Dev use only.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiClient.delete('/profile/stats');
              refresh();
            } catch {
              Alert.alert('Error', 'Failed to reset stats.');
            }
          },
        },
      ],
    );
  };

  return (
    <ScreenContainer>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: Spacing.xxl }}
      >
        <View style={styles.identitySection}>
          <View style={styles.ringWrap}>
            <Svg width={RING_SIZE} height={RING_SIZE}>
              <Circle
                cx={RING_SIZE / 2}
                cy={RING_SIZE / 2}
                r={RING_RADIUS}
                stroke={Colors.border}
                strokeWidth={RING_STROKE}
                fill="none"
              />
              <Circle
                cx={RING_SIZE / 2}
                cy={RING_SIZE / 2}
                r={RING_RADIUS}
                stroke={Colors.accent}
                strokeWidth={RING_STROKE}
                fill="none"
                strokeDasharray={RING_CIRC}
                strokeDashoffset={dashOffset}
                strokeLinecap="round"
                transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
              />
            </Svg>
            <View style={styles.ringCenter}>
              <Text style={[Typography.label, { color: Colors.textSecondary }]}>LEVEL</Text>
              <Text style={[Typography.statXL, { color: Colors.textPrimary, marginTop: -2 }]}>
                {stats.currentLevel}
              </Text>
            </View>
          </View>

          <Text style={[Typography.displayLG, { color: Colors.textPrimary, marginTop: Spacing.md }]}>
            {(username ?? '...').toUpperCase()}
          </Text>
          <Text style={[Typography.caption, { color: Colors.textSecondary, marginTop: 2 }]}>
            {stats.currentXP} / {xpTarget} XP · {Math.round(xpProgress * 100)}% TO NEXT
          </Text>
        </View>

        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={[Typography.statLG, { color: Colors.accent }]}>{stats.totalXP}</Text>
            <Text style={[Typography.label, { color: Colors.textSecondary, marginTop: 2 }]}>TOTAL XP</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[Typography.statLG, { color: Colors.textPrimary }]}>{stats.totalMissions}</Text>
            <Text style={[Typography.label, { color: Colors.textSecondary, marginTop: 2 }]}>MISSIONS</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[Typography.statLG, { color: Colors.orange }]}>0</Text>
            <Text style={[Typography.label, { color: Colors.textSecondary, marginTop: 2 }]}>STREAK</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[Typography.statLG, { color: Colors.blue }]}>0</Text>
            <Text style={[Typography.label, { color: Colors.textSecondary, marginTop: 2 }]}>LOCATIONS</Text>
          </View>
        </View>

        <Text style={[Typography.label, { color: Colors.textSecondary, marginTop: Spacing.xl, marginBottom: Spacing.sm }]}>
          SETTINGS
        </Text>

        <Pressable style={styles.settingsRow} onPress={handleAutoTrackingPress}>
          <View style={[styles.settingsIcon, bgGranted && styles.settingsIconActive]}>
            <Ionicons
              name="navigate-outline"
              size={18}
              color={bgGranted ? Colors.accent : Colors.textSecondary}
            />
          </View>
          <View style={{ flex: 1, marginLeft: Spacing.md }}>
            <Text style={[Typography.bodyMedium, { color: Colors.textPrimary }]}>Auto-Tracking</Text>
            <Text style={[Typography.caption, { color: Colors.textSecondary, marginTop: 2 }]}>
              {bgGranted ? 'Missions complete automatically' : 'Tap to enable background location'}
            </Text>
          </View>
          <View style={[styles.statusPill, bgGranted ? styles.statusOn : styles.statusOff]}>
            <Text style={[Typography.label, { color: bgGranted ? Colors.accent : Colors.textSecondary }]}>
              {bgGranted ? 'ON' : 'OFF'}
            </Text>
          </View>
        </Pressable>

        <Pressable style={[styles.settingsRow, { marginTop: Spacing.sm }]} onPress={handleLogout}>
          <View style={styles.settingsIcon}>
            <Ionicons name="log-out-outline" size={18} color={Colors.danger} />
          </View>
          <View style={{ flex: 1, marginLeft: Spacing.md }}>
            <Text style={[Typography.bodyMedium, { color: Colors.textPrimary }]}>Sign Out</Text>
            <Text style={[Typography.caption, { color: Colors.textSecondary, marginTop: 2 }]}>
              End your current session
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={Colors.textSecondary} />
        </Pressable>

        {__DEV__ && (
          <>
            <Text style={[Typography.label, { color: Colors.textSecondary, marginTop: Spacing.xl, marginBottom: Spacing.sm }]}>
              DEVELOPER
            </Text>
            <Pressable style={styles.settingsRow} onPress={handleResetStats}>
              <View style={styles.settingsIcon}>
                <Ionicons name="refresh-outline" size={18} color={Colors.orange} />
              </View>
              <View style={{ flex: 1, marginLeft: Spacing.md }}>
                <Text style={[Typography.bodyMedium, { color: Colors.textPrimary }]}>Reset Stats</Text>
                <Text style={[Typography.caption, { color: Colors.textSecondary, marginTop: 2 }]}>
                  Wipe completed missions, XP and level
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Colors.textSecondary} />
            </Pressable>
          </>
        )}
      </ScrollView>

      <BackgroundLocationPrompt
        visible={showBgPrompt}
        onEnable={handleEnableAutoTracking}
        onSkip={() => setShowBgPrompt(false)}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  identitySection: {
    alignItems: 'center',
    marginTop: Spacing.xl,
  },
  ringWrap: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringCenter: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginTop: Spacing.xl,
  },
  statCard: {
    flexGrow: 1,
    flexBasis: '47%',
    backgroundColor: Colors.surface,
    borderRadius: 14,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.borderBright,
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.borderBright,
  },
  settingsIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.surface2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  settingsIconActive: {
    backgroundColor: Colors.accentDim,
    borderColor: Colors.accentDim,
  },
  statusPill: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  statusOn: {
    borderColor: Colors.accent,
    backgroundColor: Colors.accentDim,
  },
  statusOff: {
    borderColor: Colors.border,
    backgroundColor: Colors.surface2,
  },
});
