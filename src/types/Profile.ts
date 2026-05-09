export interface Profile {
  username: string;
  email?: string;
  emailVerified: boolean;
  currentLevel: number;
  currentXP: number;
  totalMissions: number;
  totalXP: number;
  currentStreak: number;
  longestStreak?: number;
}
