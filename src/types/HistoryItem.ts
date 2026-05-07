import type { MissionTier } from './Mission';

export interface HistoryItem {
  id: string;
  missionName: string;
  earnedXP: number | null;
  completedAt: string | null;
  occurredOn: string;
  status: "completed" | "missed";
  latitude: number;
  longitude: number;
  iconType: string;
  tier: MissionTier;
  locationName: string;
}

export interface HistoryPage {
  items: HistoryItem[];
  nextCursor: string | null;
}
