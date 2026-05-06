import { Animated, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Colors, Spacing } from "../../constants";

interface Props {
  count: number;
  opacity: Animated.Value;
  translateY: Animated.Value;
}

// Mission arm bildirimi: kullanıcı pin'in 100 m dışına çıkıp uyuyan mission(lar)
// canlandığında "geri dön ve tamamla" mesajı. count > 1 ise toplu varyant.
export default function ArmToast({ count, opacity, translateY }: Props) {
  const { t } = useTranslation();
  if (count <= 0) return null;
  const text =
    count === 1
      ? t("mission.armedToast")
      : t("mission.armedToastMulti", { count });
  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.container, { opacity, transform: [{ translateY }] }]}
    >
      <View style={styles.badge}>
        <Text style={styles.text}>{text}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: 0,
    right: 0,
    top: "32%",
    alignItems: "center",
  },
  badge: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: 10,
    backgroundColor: "rgba(11, 13, 18, 0.92)",
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: Colors.orange,
    shadowColor: Colors.orange,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 12,
    elevation: 8,
  },
  text: {
    color: "#ffb27a",
    fontFamily: "Rajdhani_700Bold",
    fontSize: 16,
    letterSpacing: 1.4,
  },
});
