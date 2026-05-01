import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Spacing, Typography } from "../../constants";
import { useTheme, useTierColors } from "../../context/ThemeContext";
import type { ColorScheme } from "../../constants/colors";
import { TIER_CONFIG, type TierPreview } from "../../config/tierConfig";
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

function makeStyles(C: ColorScheme) {
  return StyleSheet.create({
    xpCard: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: C.surface,
      borderWidth: 1,
      borderColor: C.borderBright,
      borderRadius: 16,
      padding: Spacing.md,
      marginTop: Spacing.md,
    },
    baseChip: {
      alignSelf: "flex-start",
      backgroundColor: C.accentSoft,
      borderWidth: 1,
      borderColor: C.accentBorder,
      borderRadius: 8,
      paddingHorizontal: 8,
      paddingVertical: 3,
      marginTop: 6,
    },
    baseChipText: {
      fontFamily: "Rajdhani_700Bold",
      fontSize: 10,
      letterSpacing: 1,
      color: C.accent,
    },
  });
}

export default function XpRewardCard({
  tierPreview,
  anchorCoords,
  anchorError,
}: Props) {
  const { colors: C } = useTheme();
  const { t } = useTranslation();
  const tierColors = useTierColors();
  const styles = useMemo(() => makeStyles(C), [C]);

  return (
    <View style={styles.xpCard}>
      <View style={{ flex: 1 }}>
        <Text style={[Typography.label, { color: C.textSecondary }]}>
          {t("xpReward.label")}
        </Text>
        {tierPreview ? (
          <>
            <Text
              style={[
                Typography.body,
                { color: C.textPrimary, marginTop: 4 },
              ]}
            >
              Tier {tierPreview.tier} ·{" "}
              {formatDistance(tierPreview.distanceMeters)} away
            </Text>
            <View
              style={[
                styles.baseChip,
                {
                  borderColor: tierColors[tierPreview.tier],
                  backgroundColor: C.accentSoft,
                },
              ]}
            >
              <Text
                style={[
                  styles.baseChipText,
                  { color: tierColors[tierPreview.tier] },
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
                { color: C.textSecondary, marginTop: 4 },
              ]}
            >
              {anchorError
                ? anchorError
                : anchorCoords
                  ? t("xpReward.pickLocation")
                  : t("xpReward.locating")}
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
                ? tierColors[tierPreview.tier]
                : C.textSecondary,
            },
          ]}
        />
        <Text
          style={[
            Typography.label,
            { color: C.textSecondary, marginTop: -4 },
          ]}
        >
          XP
        </Text>
      </View>
    </View>
  );
}
