import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Spacing } from "../../constants";
import { useTheme } from "../../context/ThemeContext";
import type { ColorScheme } from "../../constants/colors";

interface Props {
  selectedName: string;
  onPress: () => void;
}

function makeStyles(C: ColorScheme, isDark: boolean) {
  // Light mode'da koyu mavi-siyah grid arka planı temaya yamuk düşüyor —
  // surface2 üstüne lavanter aksanlı grid çiziyoruz.
  const previewBg = isDark ? "#060e1f" : C.surface2;
  // Grid çizgileri: dark'ta orijinal yeşil-alfa, light'ta accent-alfa
  const gridLineColor = isDark
    ? "rgba(166, 230, 53, 0.05)"
    : "rgba(22, 194, 106, 0.08)";
  const glowColor = isDark
    ? "rgba(166, 230, 53, 0.06)"
    : "rgba(22, 194, 106, 0.08)";

  return StyleSheet.create({
    mapPreview: {
      height: 110,
      borderRadius: 16,
      backgroundColor: previewBg,
      borderWidth: 1,
      borderColor: C.borderBright,
      marginTop: Spacing.sm,
      overflow: "hidden",
      justifyContent: "center",
    },
    mapPreviewBg: {
      ...StyleSheet.absoluteFillObject,
    },
    mapGridLineH: {
      position: "absolute",
      left: 0,
      right: 0,
      height: 1,
      backgroundColor: gridLineColor,
    },
    mapGridLineV: {
      position: "absolute",
      top: 0,
      bottom: 0,
      width: 1,
      backgroundColor: gridLineColor,
    },
    mapGlow: {
      position: "absolute",
      width: 120,
      height: 120,
      borderRadius: 60,
      backgroundColor: glowColor,
      alignSelf: "center",
      top: -20,
    },
    mapCta: {
      alignItems: "center",
      gap: 4,
    },
    mapCtaIcon: {
      width: 38,
      height: 38,
      borderRadius: 12,
      backgroundColor: C.accentSoft,
      borderWidth: 1,
      borderColor: C.accentBorder,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 2,
    },
    mapCtaTitle: {
      fontFamily: "Rajdhani_700Bold",
      fontSize: 12,
      letterSpacing: 1.4,
      color: C.accent,
    },
    mapCtaSub: {
      fontFamily: "Inter_400Regular",
      fontSize: 11,
      color: C.textSecondary,
    },
    mapSelectedWrap: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: Spacing.md,
    },
    mapSelectedPin: {
      width: 36,
      height: 36,
      borderRadius: 11,
      backgroundColor: C.accent,
      alignItems: "center",
      justifyContent: "center",
    },
    mapSelectedName: {
      fontFamily: "Inter_600SemiBold",
      fontSize: 14,
      color: C.textPrimary,
    },
    mapSelectedSub: {
      fontFamily: "Inter_400Regular",
      fontSize: 11,
      color: C.textSecondary,
      marginTop: 2,
    },
    mapChangePill: {
      backgroundColor: C.accentSoft,
      borderWidth: 1,
      borderColor: C.accent,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 999,
    },
    mapChangePillText: {
      fontFamily: "Rajdhani_700Bold",
      fontSize: 10,
      letterSpacing: 1.2,
      color: C.accent,
    },
  });
}

export default function MapLocationPreview({ selectedName, onPress }: Props) {
  const { colors: C, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(C, isDark), [C, isDark]);

  return (
    <Pressable style={styles.mapPreview} onPress={onPress}>
      <View style={styles.mapPreviewBg}>
        {Array.from({ length: 7 }).map((_, i) => (
          <View
            key={`h${i}`}
            style={[styles.mapGridLineH, { top: `${(i + 1) * 12.5}%` }]}
          />
        ))}
        {Array.from({ length: 8 }).map((_, i) => (
          <View
            key={`v${i}`}
            style={[styles.mapGridLineV, { left: `${(i + 1) * 11}%` }]}
          />
        ))}
        <View style={styles.mapGlow} />
      </View>
      {selectedName ? (
        <View style={styles.mapSelectedWrap}>
          <View style={styles.mapSelectedPin}>
            <Ionicons name="location" size={18} color={C.background} />
          </View>
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={styles.mapSelectedName} numberOfLines={1}>
              {selectedName.split(",")[0]}
            </Text>
            <Text style={styles.mapSelectedSub} numberOfLines={1}>
              {selectedName.split(",").slice(1, 3).join(",").trim() ||
                "Tap to change"}
            </Text>
          </View>
          <View style={styles.mapChangePill}>
            <Text style={styles.mapChangePillText}>CHANGE</Text>
          </View>
        </View>
      ) : (
        <View style={styles.mapCta}>
          <View style={styles.mapCtaIcon}>
            <Ionicons name="location" size={22} color={C.accent} />
          </View>
          <Text style={styles.mapCtaTitle}>TAP TO CHOOSE ON MAP</Text>
          <Text style={styles.mapCtaSub}>Pin your mission location</Text>
        </View>
      )}
    </Pressable>
  );
}
