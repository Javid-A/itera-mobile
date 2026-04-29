import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors, Spacing, Typography } from "../../constants";
import type { AmPm, TimeWindowState } from "./types";

interface Props {
  state: TimeWindowState;
  onChange: (next: TimeWindowState) => void;
}

const formatTime = (h: number, m: number, ap: AmPm) =>
  `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")} ${ap}`;

export default function TimeWindowPicker({ state, onChange }: Props) {
  const [active, setActive] = useState<"from" | "to" | null>(null);

  const adjustHour = (which: "from" | "to", delta: number) => {
    const cur = which === "from" ? state.fromHour : state.toHour;
    const next = ((cur - 1 + delta + 12) % 12) + 1;
    onChange({ ...state, [which === "from" ? "fromHour" : "toHour"]: next });
  };
  const adjustMinute = (which: "from" | "to", delta: number) => {
    const cur = which === "from" ? state.fromMinute : state.toMinute;
    const next = (cur + delta * 5 + 60) % 60;
    onChange({ ...state, [which === "from" ? "fromMinute" : "toMinute"]: next });
  };
  const toggleAmPm = (which: "from" | "to") => {
    const key = which === "from" ? "fromAmPm" : "toAmPm";
    const cur = state[key];
    onChange({ ...state, [key]: cur === "AM" ? "PM" : "AM" });
  };

  return (
    <>
      <Pressable
        style={[
          styles.timeWindowRow,
          state.enabled && styles.timeWindowRowActive,
        ]}
        onPress={() => {
          onChange({ ...state, enabled: !state.enabled });
          setActive(null);
        }}
      >
        <View style={[styles.checkbox, state.enabled && styles.checkboxChecked]}>
          {state.enabled && (
            <Ionicons name="checkmark" size={14} color={Colors.background} />
          )}
        </View>
        <Text
          style={[
            Typography.body,
            {
              color: state.enabled ? Colors.textPrimary : Colors.textSecondary,
              flex: 1,
              marginLeft: Spacing.sm,
            },
          ]}
        >
          Set a time window
        </Text>
        {state.enabled && <Text style={styles.xpBonusText}>+25 XP bonus</Text>}
        <Ionicons
          name="time-outline"
          size={18}
          color={state.enabled ? Colors.accent : Colors.textSecondary}
        />
      </Pressable>

      {state.enabled && (
        <View style={styles.timePickerCard}>
          <View style={styles.timePickerRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.timePickerLabel}>FROM</Text>
              <Pressable
                style={[
                  styles.timeButton,
                  active === "from" && styles.timeButtonActive,
                ]}
                onPress={() => setActive(active === "from" ? null : "from")}
              >
                <Text style={styles.timeButtonText}>
                  {formatTime(state.fromHour, state.fromMinute, state.fromAmPm)}
                </Text>
                <Ionicons
                  name="time-outline"
                  size={16}
                  color={
                    active === "from" ? Colors.accent : Colors.textSecondary
                  }
                />
              </Pressable>
            </View>
            <View style={styles.timeArrow}>
              <Ionicons
                name="arrow-forward"
                size={16}
                color={Colors.textSecondary}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.timePickerLabel}>TO</Text>
              <Pressable
                style={[
                  styles.timeButton,
                  active === "to" && styles.timeButtonActive,
                ]}
                onPress={() => setActive(active === "to" ? null : "to")}
              >
                <Text style={styles.timeButtonText}>
                  {formatTime(state.toHour, state.toMinute, state.toAmPm)}
                </Text>
                <Ionicons
                  name="time-outline"
                  size={16}
                  color={active === "to" ? Colors.accent : Colors.textSecondary}
                />
              </Pressable>
            </View>
          </View>

          {active && (
            <View style={styles.timeAdjuster}>
              <View style={styles.timeAdjusterCol}>
                <Pressable hitSlop={8} onPress={() => adjustHour(active, 1)}>
                  <Ionicons name="chevron-up" size={18} color={Colors.accent} />
                </Pressable>
                <Text style={styles.timeAdjusterValue}>
                  {String(
                    active === "from" ? state.fromHour : state.toHour,
                  ).padStart(2, "0")}
                </Text>
                <Pressable hitSlop={8} onPress={() => adjustHour(active, -1)}>
                  <Ionicons
                    name="chevron-down"
                    size={18}
                    color={Colors.accent}
                  />
                </Pressable>
              </View>
              <Text style={styles.timeAdjusterColon}>:</Text>
              <View style={styles.timeAdjusterCol}>
                <Pressable hitSlop={8} onPress={() => adjustMinute(active, 1)}>
                  <Ionicons name="chevron-up" size={18} color={Colors.accent} />
                </Pressable>
                <Text style={styles.timeAdjusterValue}>
                  {String(
                    active === "from" ? state.fromMinute : state.toMinute,
                  ).padStart(2, "0")}
                </Text>
                <Pressable
                  hitSlop={8}
                  onPress={() => adjustMinute(active, -1)}
                >
                  <Ionicons
                    name="chevron-down"
                    size={18}
                    color={Colors.accent}
                  />
                </Pressable>
              </View>
              <Pressable
                style={styles.amPmButton}
                onPress={() => toggleAmPm(active)}
              >
                <Text style={styles.amPmText}>
                  {active === "from" ? state.fromAmPm : state.toAmPm}
                </Text>
              </Pressable>
            </View>
          )}
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  timeWindowRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.borderBright,
    paddingHorizontal: Spacing.md,
    height: 50,
  },
  timeWindowRowActive: {
    borderColor: Colors.accent,
    backgroundColor: Colors.accentSoft,
  },
  xpBonusText: {
    fontFamily: "Rajdhani_700Bold",
    fontSize: 12,
    letterSpacing: 0.5,
    color: Colors.accent,
    marginRight: Spacing.sm,
  },
  timePickerCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.borderBright,
    padding: Spacing.md,
    marginTop: Spacing.sm,
  },
  timePickerRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
  },
  timePickerLabel: {
    fontFamily: "Rajdhani_700Bold",
    fontSize: 11,
    letterSpacing: 1.4,
    color: Colors.textSecondary,
    marginBottom: 6,
  },
  timeButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: Colors.surface2,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.borderBright,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
  },
  timeButtonActive: {
    borderColor: Colors.accent,
  },
  timeButtonText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    color: Colors.textPrimary,
  },
  timeArrow: {
    paddingBottom: 12,
    paddingHorizontal: 4,
  },
  timeAdjuster: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: Spacing.md,
    gap: 8,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  timeAdjusterCol: {
    alignItems: "center",
    gap: 6,
  },
  timeAdjusterValue: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 28,
    color: Colors.textPrimary,
    minWidth: 44,
    textAlign: "center",
  },
  timeAdjusterColon: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 24,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  amPmButton: {
    backgroundColor: Colors.accentSoft,
    borderWidth: 1,
    borderColor: Colors.accent,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginLeft: 8,
  },
  amPmText: {
    fontFamily: "Rajdhani_700Bold",
    fontSize: 15,
    letterSpacing: 1,
    color: Colors.accent,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: Colors.borderBright,
    backgroundColor: Colors.surface2,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxChecked: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
});
