import { Animated, StyleSheet, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors, Spacing, Typography } from "../../constants";

interface Props {
  missionName: string;
  opacity: Animated.Value;
}

export default function MissionBadge({ missionName, opacity }: Props) {
  return (
    <Animated.View pointerEvents="none" style={[styles.missionBadge, { opacity }]}>
      <Ionicons name="radio-outline" size={12} color={Colors.orange} />
      <Text
        style={[
          Typography.label,
          { color: Colors.orange, marginLeft: Spacing.xs },
        ]}
        numberOfLines={1}
      >
        {missionName.toUpperCase()}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  missionBadge: {
    position: "absolute",
    top: 132,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(11, 13, 18, 0.85)",
    borderRadius: 20,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: Colors.orange,
  },
});
