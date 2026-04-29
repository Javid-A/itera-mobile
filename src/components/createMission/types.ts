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

export type AmPm = "AM" | "PM";

export interface TimeWindowState {
  enabled: boolean;
  fromHour: number;
  fromMinute: number;
  fromAmPm: AmPm;
  toHour: number;
  toMinute: number;
  toAmPm: AmPm;
}
