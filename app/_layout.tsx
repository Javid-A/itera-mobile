import '../src/services/GeofenceTask';
import '../src/services/pushNotifications';
import '../src/i18n';
import { useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Redirect, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, AppState, View } from 'react-native';
import { LocationService } from '../src/services/LocationService';
import { STORAGE_KEYS } from '../src/config/gameConfig';
import { LevelUpProvider, useLevelUp } from '../src/context/LevelUpContext';
import {
  Rajdhani_500Medium,
  Rajdhani_600SemiBold,
  Rajdhani_700Bold,
} from '@expo-google-fonts/rajdhani';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from '@expo-google-fonts/inter';
import { QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from '../src/context/AuthContext';
import { ThemeProvider, useTheme } from '../src/context/ThemeContext';
import { LanguageProvider } from '../src/context/LanguageContext';
import { queryClient } from '../src/state/queryClient';
import { LightColors } from '../src/constants/colors';

function LoadingScreen() {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator color={colors.accent} size="large" />
    </View>
  );
}

function ThemedStack() {
  const { colors, isDark } = useTheme();
  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="login" />
        <Stack.Screen name="forgot-password" options={{ presentation: 'modal' }} />
        <Stack.Screen name="verify-email" options={{ presentation: 'modal' }} />
      </Stack>
    </>
  );
}

function PendingLevelUpBridge() {
  const { triggerLevelUp } = useLevelUp();

  useEffect(() => {
    const drain = async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEYS.pendingLevelUp);
        if (!raw) return;
        await AsyncStorage.removeItem(STORAGE_KEYS.pendingLevelUp);
        const { level, earnedXP } = JSON.parse(raw) as { level: number; earnedXP: number };
        if (typeof level === 'number' && typeof earnedXP === 'number') {
          triggerLevelUp({ level, earnedXP });
        }
      } catch (e) {
        console.warn('[LevelUp] Failed to drain pending level-up', e);
      }
    };

    drain();

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') drain();
    });
    return () => sub.remove();
  }, [triggerLevelUp]);

  return null;
}

function RootNavigator() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) return <LoadingScreen />;

  return (
    <>
      <ThemedStack />
      {isAuthenticated && <PendingLevelUpBridge />}
      {isAuthenticated ? <Redirect href="/(tabs)/map" /> : <Redirect href="/login" />}
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Rajdhani_500Medium,
    Rajdhani_600SemiBold,
    Rajdhani_700Bold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  // Boot hijyeni: kullanıcı önceki session'da auto-tracking'i kapatmış olsa
  // bile OS'ta zombi bir geofence registration kalmış olabilir (eski build'ler,
  // crash sırasında yarım kalmış stop, vs.). Flag false ise OS-level dinlemeyi
  // garanti şekilde durdur — privacy ve battery için ekstra savunma.
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEYS.autoTrackingEnabled).then((flag) => {
      if (flag !== 'true') LocationService.stopGeofences();
    });
  }, []);

  // Notification tap handler — placeholder until per-payload routing lands.
  // Logs the data payload so we can verify end-to-end delivery in dev.
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      console.log('[push] tapped', response.notification.request.content.data);
    });
    return () => sub.remove();
  }, []);

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, backgroundColor: LightColors.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={LightColors.accent} size="large" />
      </View>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <LanguageProvider>
          <AuthProvider>
            <LevelUpProvider>
              <RootNavigator />
            </LevelUpProvider>
          </AuthProvider>
        </LanguageProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
