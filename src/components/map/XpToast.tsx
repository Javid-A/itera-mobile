import { Animated, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { Colors } from "../../constants";

interface Props {
  xp: number;
  streakBonusXP?: number;
  opacity: Animated.Value;
  translateY: Animated.Value;
}

export default function XpToast({ xp, streakBonusXP = 0, opacity, translateY }: Props) {
  const { t } = useTranslation();
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.xpToastContainer,
        { opacity, transform: [{ translateY }] },
      ]}
    >
      <View style={styles.xpToastBadge}>
        <Ionicons name="star" size={16} color={Colors.success} />
        <Text style={styles.xpToastText}>+{xp} XP</Text>
      </View>
      {streakBonusXP > 0 && (
        <View style={styles.xpToastBonusBadge}>
          <Text style={styles.xpToastBonusText}>
            {t("xpToast.streakBonus", { xp: streakBonusXP })}
          </Text>
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  xpToastContainer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: "48%",
    alignItems: "center",
  },
  xpToastBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: "rgba(11, 13, 18, 0.92)",
    borderRadius: 28,
    borderWidth: 1.5,
    borderColor: Colors.success,
    shadowColor: Colors.success,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 16,
    elevation: 10,
  },
  xpToastText: {
    color: Colors.success,
    fontFamily: "Rajdhani_700Bold",
    fontSize: 28,
    letterSpacing: 2,
  },
  xpToastBonusBadge: {
    marginTop: 8,
    paddingHorizontal: 16,
    paddingVertical: 6,
    backgroundColor: "rgba(20, 14, 8, 0.92)",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#ff8a3d",
    shadowColor: "#ff8a3d",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 6,
  },
  xpToastBonusText: {
    color: "#ffb27a",
    fontFamily: "Rajdhani_700Bold",
    fontSize: 16,
    letterSpacing: 1.5,
  },
});
