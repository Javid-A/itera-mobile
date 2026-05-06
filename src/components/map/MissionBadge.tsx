import { Animated, StyleSheet, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { Colors, Spacing, Typography } from "../../constants";

interface Props {
  missionName: string;
  opacity: Animated.Value;
  armed?: boolean;
}

export default function MissionBadge({
  missionName,
  opacity,
  armed = true,
}: Props) {
  const { t } = useTranslation();
  // armed=false: kullanıcı pin'in 100 m içinde oluşturduğu mission'a yakın
  // ama henüz "uzaklaşıp dön" yapmamış. Turuncu yerine soluk mute renkte ve
  // kilit ikonuyla aksiyon yönlendirmesi ver.
  const muted = "#9aa1ad";
  const color = armed ? Colors.orange : muted;
  const iconName = armed ? "radio-outline" : "lock-closed-outline";
  const text = armed ? missionName.toUpperCase() : t("mission.armBadge");
  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.missionBadge, { opacity, borderColor: color }]}
    >
      <Ionicons name={iconName} size={12} color={color} />
      <Text
        style={[Typography.label, { color, marginLeft: Spacing.xs }]}
        numberOfLines={1}
      >
        {text}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  missionBadge: {
    position: "absolute",
    top: 152,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(11, 13, 18, 0.85)",
    borderRadius: 20,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderWidth: 1,
  },
});
