import type { MissionTier } from "../types/Mission";
export { haversineMeters } from "../utils/geo";

// Must mirror the backend's `XpTiers` section in appsettings.json.
// Kept in code so the Create-mission UI can show a live preview before the
// server locks the value in. The server's calculation is authoritative.

// Single knob for local testing: 1 = production, 0.2 = 5× smaller.
// Shrinks every distance-based tier threshold AND the visual overlay on the
// map so the whole system stays consistent. Set back to 1 before shipping.
export const TIER_TEST_SCALE = 0.2;

// Production baseline distances — do NOT edit these for testing; edit TIER_TEST_SCALE.
const A_BOUND_BASE_METERS = 1000;
const B_BOUND_BASE_METERS = 5000;
// Outer edge of the radial C-tier gradient shown on the map (visual only;
// tier C has no upper bound in XP classification).
const C_GRADIENT_OUTER_BASE_METERS = 22000;

export const TIER_CONFIG = {
  baseXP: 100,
  tiers: [
    {
      tier: "A" as MissionTier,
      upperBoundMeters: A_BOUND_BASE_METERS * TIER_TEST_SCALE,
      multiplier: 1.0,
    },
    {
      tier: "B" as MissionTier,
      upperBoundMeters: B_BOUND_BASE_METERS * TIER_TEST_SCALE,
      multiplier: 1.5,
    },
    {
      tier: "C" as MissionTier,
      upperBoundMeters: null as number | null,
      multiplier: 2.0,
    },
  ],
} as const;

// Tier accent colors — themed. Use `useTierColors()` from ThemeContext to pick
// the right palette at runtime; raw exports stay for non-React call sites.
export const TIER_COLORS_DARK: Record<MissionTier, string> = {
  A: "#25ff8f",
  B: "#2ae3ff",
  C: "#c64bff",
};

export const TIER_COLORS_LIGHT: Record<MissionTier, string> = {
  A: "#16c26a",
  B: "#2060ff",
  C: "#b030f0",
};

// Backward-compatible default (dark)
export const TIER_COLORS: Record<MissionTier, string> = TIER_COLORS_DARK;

// Visual-only constants for the tier zones overlay on the Choose-Location map.
// Label offsets sit just outside each border so the overlay stays legible at
// every zoom level — they scale with TIER_TEST_SCALE, so the label stays at the
// same *relative* distance from its border regardless of test scale.
export const TIER_VISUAL = {
  aRadiusMeters: A_BOUND_BASE_METERS * TIER_TEST_SCALE,
  bRadiusMeters: B_BOUND_BASE_METERS * TIER_TEST_SCALE,
  cGradientOuterMeters: C_GRADIENT_OUTER_BASE_METERS * TIER_TEST_SCALE,
  aLabelEastMeters: 1050 * TIER_TEST_SCALE,
  bLabelEastMeters: 5100 * TIER_TEST_SCALE,
  cLabelEastMeters: 7500 * TIER_TEST_SCALE,
  cLabelSouthMeters: 1800 * TIER_TEST_SCALE,
};

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

// Handy helper for UI labels that display a static XP amount per tier
// (e.g. the tier badges on the map overlay).
export function xpForTier(tier: MissionTier): number {
  const t = TIER_CONFIG.tiers.find((x) => x.tier === tier);
  return Math.round(TIER_CONFIG.baseXP * (t?.multiplier ?? 1));
}

// "5 km+" (production) / "1 km+" (test-scale 0.2) — threshold label for the
// C-tier tooltip on the map. Switches to metres when we scale below 1 km.
export function cTierThresholdLabel(): string {
  const meters = TIER_VISUAL.bRadiusMeters;
  if (meters >= 1000) {
    const km = meters / 1000;
    return `${km % 1 === 0 ? km.toFixed(0) : km.toFixed(1)} km+`;
  }
  return `${Math.round(meters)} m+`;
}
