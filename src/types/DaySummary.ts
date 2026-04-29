export interface DayCompletedItem {
  id: string;
  missionId: string;
  missionName: string;
  earnedXP: number;
  completedAt: string;
  latitude: number;
  longitude: number;
}

export interface DayPendingItem {
  missionId: string;
  missionName: string;
  locationName: string;
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
