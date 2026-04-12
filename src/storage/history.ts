import AsyncStorage from '@react-native-async-storage/async-storage';
import type { CompletedMission } from '../types/CompletedMission';

const STORAGE_KEY = 'itera_history';
const COOLDOWN_KEY = 'itera_cooldowns';
const COOLDOWN_MS = 60 * 60 * 1000; // 1 hour

export async function loadHistory(): Promise<CompletedMission[]> {
  const json = await AsyncStorage.getItem(STORAGE_KEY);
  return json ? JSON.parse(json) : [];
}

export async function addCompletedMission(mission: CompletedMission): Promise<void> {
  const history = await loadHistory();
  history.unshift(mission);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(history));
}

export async function isOnCooldown(routineId: string): Promise<boolean> {
  const json = await AsyncStorage.getItem(COOLDOWN_KEY);
  const cooldowns: Record<string, number> = json ? JSON.parse(json) : {};
  const lastCompletion = cooldowns[routineId];
  if (!lastCompletion) return false;
  return Date.now() - lastCompletion < COOLDOWN_MS;
}

export async function setCooldown(routineId: string): Promise<void> {
  const json = await AsyncStorage.getItem(COOLDOWN_KEY);
  const cooldowns: Record<string, number> = json ? JSON.parse(json) : {};
  cooldowns[routineId] = Date.now();
  await AsyncStorage.setItem(COOLDOWN_KEY, JSON.stringify(cooldowns));
}
