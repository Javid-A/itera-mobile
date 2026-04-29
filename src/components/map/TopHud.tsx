import { Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import { Colors, Spacing, Typography } from "../../constants";
import { XP_PER_LEVEL } from "../../config/gameConfig";
import type { Profile } from "../../types/Profile";
import type { Mission } from "../../types/Mission";

interface Props {
  profile: Profile | null;
  missions: Mission[];
  bgDenied: boolean;
  onFixBackground: () => void;
}

export default function TopHud({
  profile,
  missions,
  bgDenied,
  onFixBackground,
}: Props) {
  const xpForLevel = (profile?.currentLevel ?? 1) * XP_PER_LEVEL;
  const xpProgress = profile ? Math.min(1, profile.currentXP / xpForLevel) : 0;
  const showStreak =
    missions.length > 0 && missions.every((m) => m.status !== "completed");

  return (
    <View style={styles.topHud} pointerEvents="box-none">
      <Pressable onPress={() => router.push("/profile")}>
        <BlurView
          intensity={45}
          tint="dark"
          style={styles.hudCard}
          experimentalBlurMethod="dimezisBlurView"
        >
          <BlurView
            intensity={30}
            tint="light"
            style={styles.levelChip}
            experimentalBlurMethod="dimezisBlurView"
          >
            <Text style={[Typography.statMD, { color: Colors.accent }]}>
              {profile?.currentLevel ?? 1}
            </Text>
          </BlurView>
          <View style={{ flex: 1 }}>
            <View style={styles.hudLabelRow}>
              <Text style={styles.hudLevelLabel}>
                LEVEL {profile?.currentLevel ?? 1}
              </Text>
              <Text style={[Typography.statSM, { color: Colors.accent }]}>
                {(profile?.currentXP ?? 0).toLocaleString()} /{" "}
                {xpForLevel.toLocaleString()} XP
              </Text>
            </View>
            <View style={styles.xpTrack}>
              <View
                style={[styles.xpFill, { width: `${xpProgress * 100}%` }]}
              />
            </View>
          </View>
          <Ionicons
            name="chevron-forward"
            size={16}
            color={Colors.textSecondary}
          />
        </BlurView>
      </Pressable>

      {showStreak || bgDenied ? (
        <View style={styles.hudPillRow}>
          {showStreak && (
            <BlurView
              intensity={45}
              tint="dark"
              style={styles.hudPill}
              experimentalBlurMethod="dimezisBlurView"
            >
              <Text style={styles.hudPillFlame}>🔥</Text>
              <Text style={styles.hudPillText}>STREAK AT RISK</Text>
              <View style={styles.hudPillBadge}>
                <Text style={styles.hudPillBadgeText}>7D</Text>
              </View>
            </BlurView>
          )}
          {bgDenied && (
            <Pressable
              style={{ borderRadius: 999, overflow: "hidden" }}
              onPress={onFixBackground}
            >
              <BlurView
                intensity={45}
                tint="dark"
                style={[styles.hudPill, styles.hudPillWarning]}
                experimentalBlurMethod="dimezisBlurView"
              >
                <Ionicons
                  name="warning-outline"
                  size={13}
                  color={Colors.orange}
                />
                <Text style={[styles.hudPillText, { color: Colors.orange }]}>
                  AUTO-TRACKING OFF
                </Text>
                <Text style={styles.hudPillEnable}>FIX</Text>
              </BlurView>
            </Pressable>
          )}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  topHud: {
    position: "absolute",
    top: 58,
    left: Spacing.md,
    right: Spacing.md,
    zIndex: 10,
  },
  hudCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(11, 14, 26, 0.45)",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    gap: 12,
    overflow: "hidden",
  },
  hudLevelLabel: {
    fontFamily: "Rajdhani_700Bold",
    fontSize: 11,
    letterSpacing: 1.6,
    color: Colors.textSecondary,
  },
  hudPillRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
  },
  hudPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(20, 14, 8, 0.4)",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(249, 115, 22, 0.35)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    overflow: "hidden",
  },
  hudPillWarning: {
    backgroundColor: "rgba(11, 14, 26, 0.4)",
    borderColor: "rgba(249, 115, 22, 0.35)",
  },
  hudPillFlame: {
    fontSize: 13,
  },
  hudPillText: {
    fontFamily: "Rajdhani_700Bold",
    fontSize: 11,
    letterSpacing: 1.2,
    color: Colors.orange,
  },
  hudPillBadge: {
    backgroundColor: Colors.orange,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  hudPillBadgeText: {
    fontFamily: "Rajdhani_700Bold",
    fontSize: 10,
    color: "#1a0f06",
    letterSpacing: 0.5,
  },
  hudPillEnable: {
    fontFamily: "Rajdhani_700Bold",
    fontSize: 11,
    letterSpacing: 1,
    color: Colors.accent,
  },
  levelChip: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(141, 232, 58, 0.12)",
    borderWidth: 1.5,
    borderColor: "rgba(141, 232, 58, 0.4)",
    overflow: "hidden",
  },
  hudLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 5,
  },
  xpTrack: {
    height: 5,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 3,
    overflow: "hidden",
  },
  xpFill: {
    height: "100%",
    backgroundColor: Colors.accent,
    borderRadius: 3,
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 6,
  },
});
