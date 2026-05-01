export const XP_PER_LEVEL = 1000;

export const STREAK_BONUS_TIERS = [
  { minDays: 30, bonusXP: 100 },
  { minDays: 7, bonusXP: 50 },
  { minDays: 3, bonusXP: 20 },
] as const;

export const STORAGE_KEYS = {
  autoTrackingEnabled: 'autoTrackingEnabled',
} as const;
