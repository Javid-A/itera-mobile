import type { Ionicons } from "@expo/vector-icons";

export type LocType = {
  key: string;
  label: string;
  iconType: string;
  icon: keyof typeof Ionicons.glyphMap;
};

export const LOC_TYPES: LocType[] = [
  { key: "gym", label: "Gym", iconType: "barbell", icon: "barbell" },
  { key: "cafe", label: "Café", iconType: "cafe", icon: "cafe" },
  { key: "office", label: "Office", iconType: "briefcase", icon: "briefcase" },
  { key: "park", label: "Park", iconType: "leaf", icon: "leaf" },
  { key: "custom", label: "Custom", iconType: "star", icon: "location" },
];

export interface TargetTimeState {
  enabled: boolean;
  hour: number;   // 0..23
  minute: number; // 0..59
  use24h: boolean;
}

export const PUNCTUALITY_BONUS_XP = 50;
export const PUNCTUALITY_WINDOW_MIN = 30;

export function formatTargetTime(
  hour: number,
  minute: number,
  use24h: boolean,
): string {
  const mm = String(minute).padStart(2, "0");
  if (use24h) return `${String(hour).padStart(2, "0")}:${mm}`;
  const ap = hour >= 12 ? "PM" : "AM";
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${String(h12).padStart(2, "0")}:${mm} ${ap}`;
}

// Backend TimeOnly: "HH:mm:ss" — saniye 00.
export function toBackendTargetTime(hour: number, minute: number): string {
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00`;
}

// "Now"a göre seçilen saat geçmişte mi? (aynı gün varsayımı — 23:59 üst sınır)
export function isTargetTimeInPast(
  hour: number,
  minute: number,
  now: Date = new Date(),
): boolean {
  const nowMins = now.getHours() * 60 + now.getMinutes();
  const targetMins = hour * 60 + minute;
  return targetMins <= nowMins;
}
