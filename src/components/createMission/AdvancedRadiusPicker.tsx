import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Spacing } from "../../constants";
import { useTheme } from "../../context/ThemeContext";
import type { ColorScheme } from "../../constants/colors";

interface Props {
  expanded: boolean;
  onToggle: () => void;
  radiusMeters: number;
  onRadiusChange: (next: number) => void;
}

const PRESETS = [50, 100, 150, 200, 300, 500];

function makeStyles(C: ColorScheme) {
  return StyleSheet.create({
    fieldLabel: {
      fontFamily: "Rajdhani_700Bold",
      fontSize: 11,
      letterSpacing: 1.4,
      color: C.textSecondary,
      marginTop: Spacing.lg,
      marginBottom: Spacing.sm,
    },
    advancedToggle: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginTop: Spacing.md,
      paddingVertical: 4,
      alignSelf: "flex-start",
    },
    advancedToggleText: {
      fontFamily: "Rajdhani_700Bold",
      fontSize: 11,
      letterSpacing: 1.4,
      color: C.textSecondary,
    },
    advancedSummary: {
      fontFamily: "Inter_400Regular",
      fontSize: 11,
      color: C.textSecondary,
      marginLeft: 2,
    },
    advancedCard: {
      backgroundColor: C.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: C.borderBright,
      padding: Spacing.md,
      marginTop: 6,
    },
    radiusRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: Spacing.md,
    },
    radiusBtn: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: C.surface2,
      borderWidth: 1,
      borderColor: C.borderBright,
      alignItems: "center",
      justifyContent: "center",
    },
    radiusValueWrap: {
      flexDirection: "row",
      alignItems: "baseline",
      gap: 4,
    },
    radiusValue: {
      fontFamily: "Inter_600SemiBold",
      fontSize: 32,
      color: C.textPrimary,
    },
    radiusUnit: {
      fontFamily: "Rajdhani_700Bold",
      fontSize: 16,
      color: C.textSecondary,
    },
    radiusPresets: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      marginBottom: Spacing.sm,
    },
    radiusPreset: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 8,
      backgroundColor: C.surface2,
      borderWidth: 1,
      borderColor: C.borderBright,
    },
    radiusPresetActive: {
      borderColor: C.accent,
      backgroundColor: C.accentSoft,
    },
    radiusPresetText: {
      fontFamily: "Rajdhani_700Bold",
      fontSize: 12,
      letterSpacing: 0.5,
      color: C.textSecondary,
    },
    radiusHint: {
      fontFamily: "Inter_400Regular",
      fontSize: 11,
      color: C.textSecondary,
      marginTop: 4,
    },
  });
}

export default function AdvancedRadiusPicker({
  expanded,
  onToggle,
  radiusMeters,
  onRadiusChange,
}: Props) {
  const { colors: C } = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);

  return (
    <>
      <Pressable style={styles.advancedToggle} onPress={onToggle}>
        <Ionicons
          name={expanded ? "chevron-down" : "chevron-forward"}
          size={14}
          color={C.textSecondary}
        />
        <Text style={styles.advancedToggleText}>ADVANCED</Text>
        {!expanded && (
          <Text style={styles.advancedSummary}>{radiusMeters}m radius</Text>
        )}
      </Pressable>

      {expanded && (
        <View style={styles.advancedCard}>
          <Text style={styles.fieldLabel}>GEOFENCE RADIUS</Text>
          <View style={styles.radiusRow}>
            <Pressable
              style={styles.radiusBtn}
              onPress={() => onRadiusChange(Math.max(50, radiusMeters - 50))}
              hitSlop={8}
            >
              <Ionicons name="remove" size={18} color={C.textPrimary} />
            </Pressable>
            <View style={styles.radiusValueWrap}>
              <Text style={styles.radiusValue}>{radiusMeters}</Text>
              <Text style={styles.radiusUnit}>m</Text>
            </View>
            <Pressable
              style={styles.radiusBtn}
              onPress={() => onRadiusChange(Math.min(500, radiusMeters + 50))}
              hitSlop={8}
            >
              <Ionicons name="add" size={18} color={C.textPrimary} />
            </Pressable>
          </View>
          <View style={styles.radiusPresets}>
            {PRESETS.map((r) => (
              <Pressable
                key={r}
                style={[
                  styles.radiusPreset,
                  radiusMeters === r && styles.radiusPresetActive,
                ]}
                onPress={() => onRadiusChange(r)}
              >
                <Text
                  style={[
                    styles.radiusPresetText,
                    radiusMeters === r && { color: C.accent },
                  ]}
                >
                  {r}m
                </Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.radiusHint}>
            Mission triggers when you enter this radius around the pin.
          </Text>
        </View>
      )}
    </>
  );
}
