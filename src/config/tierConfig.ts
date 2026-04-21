import type { MissionTier } from '../types/Routine';

// Must mirror the backend's `XpTiers` section in appsettings.json.
// Kept in code so the Create-mission UI can show a live preview before the
// server locks the value in. The server's calculation is authoritative.
export const TIER_CONFIG = {
  baseXP: 100,
  tiers: [
    { tier: 'A' as MissionTier, upperBoundMeters: 1000, multiplier: 1.0 },
    { tier: 'B' as MissionTier, upperBoundMeters: 5000, multiplier: 1.5 },
    { tier: 'C' as MissionTier, upperBoundMeters: null as number | null, multiplier: 2.0 },
  ],
} as const;

export interface TierPreview {
  tier: MissionTier;
  multiplier: number;
  potentialXP: number;
  upperBoundMeters: number | null;
}

export function classifyDistance(distanceMeters: number): TierPreview {
  const { baseXP, tiers } = TIER_CONFIG;
  const hit =
    tiers.find((t) => distanceMeters < (t.upperBoundMeters ?? Infinity)) ??
    tiers[tiers.length - 1];
  return {
    tier: hit.tier,
    multiplier: hit.multiplier,
    upperBoundMeters: hit.upperBoundMeters,
    potentialXP: Math.round(baseXP * hit.multiplier),
  };
}

export function haversineMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
