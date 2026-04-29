import { StyleSheet, Text, View } from "react-native";
import { Colors, Spacing, Typography } from "../../constants";
import { TIER_COLORS, TIER_CONFIG, type TierPreview } from "../../config/tierConfig";
import XPCountUp from "../XPCountUp";

interface Props {
  tierPreview: (TierPreview & { distanceMeters: number }) | null;
  anchorCoords: { lat: number; lng: number } | null;
  anchorError: string | null;
}

function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(meters < 10000 ? 2 : 1)} km`;
}

export default function XpRewardCard({
  tierPreview,
  anchorCoords,
  anchorError,
}: Props) {
  return (
    <View style={styles.xpCard}>
      <View style={{ flex: 1 }}>
        <Text style={[Typography.label, { color: Colors.textSecondary }]}>
          XP REWARD
        </Text>
        {tierPreview ? (
          <>
            <Text
              style={[
                Typography.body,
                { color: Colors.textPrimary, marginTop: 4 },
              ]}
            >
              Tier {tierPreview.tier} ·{" "}
              {formatDistance(tierPreview.distanceMeters)} away
            </Text>
            <View
              style={[
                styles.baseChip,
                {
                  borderColor: TIER_COLORS[tierPreview.tier],
                  backgroundColor: "rgba(166, 230, 53, 0.08)",
                },
              ]}
            >
              <Text
                style={[
                  styles.baseChipText,
                  { color: TIER_COLORS[tierPreview.tier] },
                ]}
              >
                {TIER_CONFIG.baseXP} × {tierPreview.multiplier.toFixed(1)}
              </Text>
            </View>
          </>
        ) : (
          <>
            <Text
              style={[
                Typography.body,
                { color: Colors.textSecondary, marginTop: 4 },
              ]}
            >
              {anchorError
                ? anchorError
                : anchorCoords
                  ? "Pick a location to classify tier."
                  : "Locating you…"}
            </Text>
            <View style={styles.baseChip}>
              <Text style={styles.baseChipText}>A · B · C</Text>
            </View>
          </>
        )}
      </View>
      <View style={{ alignItems: "flex-end" }}>
        <XPCountUp
          key={
            tierPreview
              ? `${tierPreview.tier}-${tierPreview.potentialXP}`
              : "pending"
          }
          target={tierPreview?.potentialXP ?? 0}
          prefix="+"
          duration={800}
          style={[
            Typography.statXL,
            {
              color: tierPreview
                ? TIER_COLORS[tierPreview.tier]
                : Colors.textSecondary,
            },
          ]}
        />
        <Text
          style={[
            Typography.label,
            { color: Colors.textSecondary, marginTop: -4 },
          ]}
        >
          XP
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  xpCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.borderBright,
    borderRadius: 16,
    padding: Spacing.md,
    marginTop: Spacing.md,
  },
  baseChip: {
    alignSelf: "flex-start",
    backgroundColor: Colors.accentSoft,
    borderWidth: 1,
    borderColor: "rgba(166, 230, 53, 0.55)",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: 6,
  },
  baseChipText: {
    fontFamily: "Rajdhani_700Bold",
    fontSize: 10,
    letterSpacing: 1,
    color: Colors.accent,
  },
});
