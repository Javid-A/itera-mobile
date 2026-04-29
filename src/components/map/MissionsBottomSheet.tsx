import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { GestureResponderHandlers } from "react-native";
import { Colors, Spacing, Typography } from "../../constants";
import { TIER_COLORS } from "../../config/tierConfig";
import type { Mission } from "../../types/Mission";

interface Props {
  missions: Mission[];
  sheetY: Animated.AnimatedInterpolation<number> | Animated.Value;
  isExpanded: boolean;
  panHandlers: GestureResponderHandlers;
  backdropOpacity: Animated.AnimatedInterpolation<number> | Animated.Value;
  onCollapse: () => void;
  onMissionPress: (mission: Mission) => void;
  onMissionDelete: (id: string) => void;
}

const SHEET_COLLAPSED_HEIGHT = 82;
const SHEET_EXPANDED_HEIGHT = 320;

export const SHEET_HEIGHTS = {
  collapsed: SHEET_COLLAPSED_HEIGHT,
  expanded: SHEET_EXPANDED_HEIGHT,
};

export default function MissionsBottomSheet({
  missions,
  sheetY,
  isExpanded,
  panHandlers,
  backdropOpacity,
  onCollapse,
  onMissionPress,
  onMissionDelete,
}: Props) {
  const activeMissions = missions.filter((m) => m.status !== "completed");

  return (
    <>
      <Animated.View
        pointerEvents={isExpanded ? "auto" : "none"}
        style={[styles.backdrop, { opacity: backdropOpacity }]}
      >
        <Pressable style={{ flex: 1 }} onPress={onCollapse} />
      </Animated.View>

      <Animated.View
        style={[styles.sheet, { transform: [{ translateY: sheetY }] }]}
      >
        <View style={styles.sheetHeader} {...panHandlers}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetTitleRow}>
            <Text style={[Typography.displaySM, { color: Colors.textPrimary }]}>
              Active Missions
            </Text>
            <View style={styles.countPill}>
              <Text style={[Typography.label, { color: Colors.accent }]}>
                {activeMissions.length} ACTIVE
              </Text>
            </View>
          </View>
        </View>
        <ScrollView
          style={styles.sheetList}
          scrollEnabled={isExpanded}
          showsVerticalScrollIndicator={false}
        >
          {activeMissions.length === 0 ? (
            <View style={styles.emptySheet}>
              <Text
                style={[
                  Typography.body,
                  { color: Colors.textSecondary, textAlign: "center" },
                ]}
              >
                No missions yet. Tap the + button to add your first.
              </Text>
            </View>
          ) : (
            activeMissions.map((mission, i) => {
              const tierColor = TIER_COLORS[mission.tier] ?? Colors.accent;
              return (
                <Pressable
                  key={mission.id}
                  style={[styles.missionRow, i > 0 && styles.missionRowBorder]}
                  onPress={() => onMissionPress(mission)}
                >
                  <View
                    style={[
                      styles.missionIconWrap,
                      {
                        backgroundColor: `${tierColor}1F`,
                        borderColor: `${tierColor}66`,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.missionIconDot,
                        { backgroundColor: tierColor, shadowColor: tierColor },
                      ]}
                    />
                  </View>
                  <View style={styles.missionInfo}>
                    <Text
                      style={[
                        Typography.bodyMedium,
                        { color: Colors.textPrimary },
                      ]}
                      numberOfLines={1}
                    >
                      {mission.missionName}
                    </Text>
                    <Text
                      style={[
                        Typography.caption,
                        { color: Colors.textSecondary },
                      ]}
                      numberOfLines={1}
                    >
                      {mission.locationName}
                    </Text>
                  </View>
                  <Text style={[Typography.statSM, { color: tierColor }]}>
                    +{mission.potentialXP} XP
                  </Text>
                  <Pressable
                    style={styles.deleteMissionBtn}
                    onPress={() => onMissionDelete(mission.id)}
                    hitSlop={8}
                  >
                    <Ionicons
                      name="trash-outline"
                      size={16}
                      color={Colors.textSecondary}
                    />
                  </Pressable>
                </Pressable>
              );
            })
          )}
        </ScrollView>
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: SHEET_COLLAPSED_HEIGHT,
    backgroundColor: "#000",
    zIndex: 20,
    elevation: 20,
  },
  sheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: SHEET_EXPANDED_HEIGHT,
    backgroundColor: "rgba(6, 7, 14, 0.96)",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: Colors.borderBright,
    zIndex: 25,
    elevation: 25,
  },
  sheetHeader: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.sm,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: Colors.muted,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: Spacing.sm,
  },
  sheetTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  countPill: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 20,
    backgroundColor: "rgba(141, 232, 58, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(141, 232, 58, 0.4)",
  },
  sheetList: {
    flex: 1,
  },
  emptySheet: {
    padding: Spacing.xl,
    alignItems: "center",
  },
  missionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
  },
  missionRowBorder: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  missionIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
    borderWidth: 1,
  },
  missionIconDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.accent,
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
  },
  missionInfo: {
    flex: 1,
  },
  deleteMissionBtn: {
    marginLeft: Spacing.sm,
    padding: 4,
  },
});
