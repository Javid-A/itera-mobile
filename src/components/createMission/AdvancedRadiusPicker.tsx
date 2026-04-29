import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors, Spacing } from "../../constants";

interface Props {
  expanded: boolean;
  onToggle: () => void;
  radiusMeters: number;
  onRadiusChange: (next: number) => void;
}

const PRESETS = [50, 100, 150, 200, 300, 500];
const FIELD_LABEL_STYLE = {
  fontFamily: "Rajdhani_700Bold",
  fontSize: 11,
  letterSpacing: 1.4,
  color: Colors.textSecondary,
  marginTop: Spacing.lg,
  marginBottom: Spacing.sm,
} as const;

export default function AdvancedRadiusPicker({
  expanded,
  onToggle,
  radiusMeters,
  onRadiusChange,
}: Props) {
  return (
    <>
      <Pressable style={styles.advancedToggle} onPress={onToggle}>
        <Ionicons
          name={expanded ? "chevron-down" : "chevron-forward"}
          size={14}
          color={Colors.textSecondary}
        />
        <Text style={styles.advancedToggleText}>ADVANCED</Text>
        {!expanded && (
          <Text style={styles.advancedSummary}>{radiusMeters}m radius</Text>
        )}
      </Pressable>

      {expanded && (
        <View style={styles.advancedCard}>
          <Text style={FIELD_LABEL_STYLE}>GEOFENCE RADIUS</Text>
          <View style={styles.radiusRow}>
            <Pressable
              style={styles.radiusBtn}
              onPress={() => onRadiusChange(Math.max(50, radiusMeters - 50))}
              hitSlop={8}
            >
              <Ionicons name="remove" size={18} color={Colors.textPrimary} />
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
              <Ionicons name="add" size={18} color={Colors.textPrimary} />
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
                    radiusMeters === r && { color: Colors.accent },
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

const styles = StyleSheet.create({
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
    color: Colors.textSecondary,
  },
  advancedSummary: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: Colors.textSecondary,
    marginLeft: 2,
  },
  advancedCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.borderBright,
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
    backgroundColor: Colors.surface2,
    borderWidth: 1,
    borderColor: Colors.borderBright,
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
    color: Colors.textPrimary,
  },
  radiusUnit: {
    fontFamily: "Rajdhani_700Bold",
    fontSize: 16,
    color: Colors.textSecondary,
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
    backgroundColor: Colors.surface2,
    borderWidth: 1,
    borderColor: Colors.borderBright,
  },
  radiusPresetActive: {
    borderColor: Colors.accent,
    backgroundColor: Colors.accentSoft,
  },
  radiusPresetText: {
    fontFamily: "Rajdhani_700Bold",
    fontSize: 12,
    letterSpacing: 0.5,
    color: Colors.textSecondary,
  },
  radiusHint: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 4,
  },
});
