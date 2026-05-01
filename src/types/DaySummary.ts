import type { MissionTier } from './Mission';

export interface DayCompletedItem {
  id: string;
  missionName: string;
  iconType: string;
  tier: MissionTier;
  earnedXP: number;
  completedAt: string;
  latitude: number;
  longitude: number;
}

export interface DayPendingItem {
  missionId: string;
  missionName: string;
  locationName: string;
  iconType: string;
  tier: MissionTier;
  potentialXP: number;
  latitude: number;
  longitude: number;
}

export interface DaySummary {
  date: string; // ISO yyyy-mm-dd in user's TZ
  completed: DayCompletedItem[];
  pending: DayPendingItem[];
  doneCount: number;
  totalCount: number;
}

export interface WeekDaySummary {
  date: string;
  totalXP: number;
}

export interface DaySummaryResponse {
  timeZone: string;
  today: DaySummary;
  yesterday: DaySummary;
  week: WeekDaySummary[];
}
