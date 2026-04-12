import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Profile } from '../types/Profile';

const STORAGE_KEY = 'itera_profile';

const XP_PER_MISSION = 100;
const XP_PER_LEVEL = 1000;

const DEFAULT_PROFILE: Profile = {
  userId: 'local-user',
  username: 'Alex R.',
  currentLevel: 1,
  currentXP: 0,
};

export async function loadProfile(): Promise<Profile> {
  const json = await AsyncStorage.getItem(STORAGE_KEY);
  return json ? JSON.parse(json) : { ...DEFAULT_PROFILE };
}

export async function saveProfile(profile: Profile): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
}

export async function awardXP(): Promise<Profile> {
  const profile = await loadProfile();
  profile.currentXP += XP_PER_MISSION;

  while (profile.currentXP >= profile.currentLevel * XP_PER_LEVEL) {
    profile.currentXP -= profile.currentLevel * XP_PER_LEVEL;
    profile.currentLevel += 1;
  }

  await saveProfile(profile);
  return profile;
}

export { XP_PER_MISSION, XP_PER_LEVEL };
