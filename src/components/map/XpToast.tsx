import { Animated, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../../constants";

interface Props {
  xp: number;
  opacity: Animated.Value;
  translateY: Animated.Value;
}

export default function XpToast({ xp, opacity, translateY }: Props) {
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
});
