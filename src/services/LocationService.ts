import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GEOFENCE_TASK_NAME } from './GeofenceTask';
import { getMissionsToday } from '../api/missions';
import { STORAGE_KEYS } from '../config/gameConfig';

export interface GeofenceRegion {
  id: string;
  latitude: number;
  longitude: number;
  radius: number;
}

async function hasPermissions(): Promise<boolean> {
  const fg = await Location.getForegroundPermissionsAsync();
  const bg = await Location.getBackgroundPermissionsAsync();
  return fg.status === 'granted' && bg.status === 'granted';
}

async function requestPermissions(): Promise<boolean> {
  if (await hasPermissions()) return true;

  const { status: foreground } = await Location.requestForegroundPermissionsAsync();
  if (foreground !== 'granted') {
    console.warn('[LocationService] Foreground permission denied');
    return false;
  }

  // Background permission is handled by BackgroundLocationPrompt UI
  // Just check if it's already granted
  const bg = await Location.getBackgroundPermissionsAsync();
  return bg.status === 'granted';
}

async function registerGeofences(regions: GeofenceRegion[]): Promise<void> {
  const isRunning = await TaskManager.isTaskRegisteredAsync(GEOFENCE_TASK_NAME);
  if (isRunning) {
    await Location.stopGeofencingAsync(GEOFENCE_TASK_NAME);
  }

  const locationRegions = regions.map((r) => ({
    identifier: r.id,
    latitude: r.latitude,
    longitude: r.longitude,
    radius: r.radius,
    notifyOnEnter: true,
    notifyOnExit: false,
  }));

  await Location.startGeofencingAsync(GEOFENCE_TASK_NAME, locationRegions);
  console.log(`[LocationService] Registered ${regions.length} geofence(s)`);
}

async function stopGeofences(): Promise<void> {
  const isRunning = await TaskManager.isTaskRegisteredAsync(GEOFENCE_TASK_NAME);
  console.log(`[LocationService] stopGeofences called, taskRegistered=${isRunning}`);
  if (isRunning) {
    try {
      await Location.stopGeofencingAsync(GEOFENCE_TASK_NAME);
      console.log('[LocationService] Geofencing stopped at OS level');
    } catch (e) {
      console.warn('[LocationService] stopGeofencingAsync failed', e);
    }
  }
}

// Switch ON yapılınca / yeni mission yaratılınca çağrılır: bugünün mission'larını
// fetch'leyip OS'a geofence olarak kaydeder. autoTrackingEnabled false ise OS
// dinlemesin diye no-op döner; permission yoksa zaten registerGeofences sessizce
// başarısız olur.
async function syncTodayGeofences(): Promise<void> {
  const flag = await AsyncStorage.getItem(STORAGE_KEYS.autoTrackingEnabled);
  if (flag !== 'true') {
    await stopGeofences();
    return;
  }
  if (!(await hasPermissions())) return;
  try {
    const missions = await getMissionsToday();
    if (missions.length === 0) {
      await stopGeofences();
      return;
    }
    await registerGeofences(
      missions.map((m) => ({
        id: m.id,
        latitude: m.latitude,
        longitude: m.longitude,
        radius: m.radiusMeters,
      })),
    );
  } catch {
    // Network/permission hatası — geofence'ler eski haliyle kalır
  }
}

export const LocationService = {
  requestPermissions,
  registerGeofences,
  stopGeofences,
  syncTodayGeofences,
};
