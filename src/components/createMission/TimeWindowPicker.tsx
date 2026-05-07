import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { Spacing, Typography } from "../../constants";
import { useTheme } from "../../context/ThemeContext";
import type { ColorScheme } from "../../constants/colors";
import {
  formatTargetTime,
  isTargetTimeInPast,
  PUNCTUALITY_BONUS_XP,
  PUNCTUALITY_WINDOW_MIN,
  type TargetTimeState,
} from "./types";

interface Props {
  state: TargetTimeState;
  onChange: (next: TargetTimeState) => void;
}

function makeStyles(C: ColorScheme) {
  return StyleSheet.create({
    row: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: C.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: C.borderBright,
      paddingHorizontal: Spacing.md,
      height: 50,
    },
    rowActive: {
      borderColor: C.accent,
      backgroundColor: C.accentSoft,
    },
    bonusText: {
      fontFamily: "Rajdhani_700Bold",
      fontSize: 12,
      letterSpacing: 0.5,
      color: C.accent,
      marginRight: Spacing.sm,
    },
    card: {
      backgroundColor: C.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: C.borderBright,
      padding: Spacing.md,
      marginTop: Spacing.sm,
    },
    cardHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: Spacing.md,
    },
    label24h: {
      fontFamily: "Rajdhani_700Bold",
      fontSize: 11,
      letterSpacing: 1.4,
      color: C.textSecondary,
    },
    timeDisplay: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: Spacing.sm,
    },
    timeColumn: {
      alignItems: "center",
      gap: 4,
    },
    chevronBtn: {
      padding: 4,
    },
    timeValue: {
      fontFamily: "Inter_600SemiBold",
      fontSize: 36,
      color: C.textPrimary,
      minWidth: 56,
      textAlign: "center",
    },
    timeColon: {
      fontFamily: "Inter_600SemiBold",
      fontSize: 30,
      color: C.textSecondary,
    },
    amPmButton: {
      backgroundColor: C.accentSoft,
      borderWidth: 1,
      borderColor: C.accent,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 8,
      marginLeft: 10,
    },
    amPmText: {
      fontFamily: "Rajdhani_700Bold",
      fontSize: 15,
      letterSpacing: 1,
      color: C.accent,
    },
    helper: {
      marginTop: Spacing.sm,
      fontFamily: "Inter_400Regular",
      fontSize: 12,
      color: C.textSecondary,
      textAlign: "center",
    },
    error: {
      marginTop: Spacing.sm,
      fontFamily: "Inter_600SemiBold",
      fontSize: 12,
      color: C.danger,
      textAlign: "center",
    },
    checkbox: {
      width: 22,
      height: 22,
      borderRadius: 6,
      borderWidth: 1.5,
      borderColor: C.borderBright,
      backgroundColor: C.surface2,
      alignItems: "center",
      justifyContent: "center",
    },
    checkboxChecked: {
      backgroundColor: C.accent,
      borderColor: C.accent,
    },
  });
}

export default function TimeWindowPicker({ state, onChange }: Props) {
  const { colors: C } = useTheme();
  const { t } = useTranslation();
  const styles = useMemo(() => makeStyles(C), [C]);

  // Seçim sırasında geçen dakikalarda "geçmiş" durumunun yenilenmesi için
  // dakikada bir tetikleyici. UI sadece validation çıktısını kullanır.
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!state.enabled) return;
    const id = setInterval(() => setTick((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, [state.enabled]);

  const inPast = state.enabled && isTargetTimeInPast(state.hour, state.minute);

  const adjustHour = (delta: number) => {
    const next = (state.hour + delta + 24) % 24;
    onChange({ ...state, hour: next });
  };
  const adjustMinute = (delta: number) => {
    // 5'er dakika adımları.
    const next = (state.minute + delta * 5 + 60) % 60;
    onChange({ ...state, minute: next });
  };
  const toggleAmPm = () => {
    // 12 saatlik moda göre AM↔PM: 12 saat ekle/çıkar (mod 24).
    const next = (state.hour + 12) % 24;
    onChange({ ...state, hour: next });
  };
  const toggle24h = (use24h: boolean) => {
    onChange({ ...state, use24h });
  };

  const displayHour = state.use24h
    ? String(state.hour).padStart(2, "0")
    : String(state.hour % 12 === 0 ? 12 : state.hour % 12).padStart(2, "0");
  const isPm = state.hour >= 12;

  return (
    <>
      <Pressable
        style={[styles.row, state.enabled && styles.rowActive]}
        onPress={() => onChange({ ...state, enabled: !state.enabled })}
      >
        <View style={[styles.checkbox, state.enabled && styles.checkboxChecked]}>
          {state.enabled && (
            <Ionicons name="checkmark" size={14} color={C.background} />
          )}
        </View>
        <Text
          style={[
            Typography.body,
            {
              color: state.enabled ? C.textPrimary : C.textSecondary,
              flex: 1,
              marginLeft: Spacing.sm,
            },
          ]}
        >
          {t("createMission.targetTimeRowLabel")}
        </Text>
        {state.enabled && (
          <Text style={styles.bonusText}>
            +{PUNCTUALITY_BONUS_XP} XP
          </Text>
        )}
        <Ionicons
          name="time-outline"
          size={18}
          color={state.enabled ? C.accent : C.textSecondary}
        />
      </Pressable>

      {state.enabled && (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.label24h}>{t("createMission.use24h")}</Text>
            <Switch
              value={state.use24h}
              onValueChange={toggle24h}
              trackColor={{ false: C.surface2, true: C.accent }}
              thumbColor={C.background}
            />
          </View>

          <View style={styles.timeDisplay}>
            <View style={styles.timeColumn}>
              <Pressable
                hitSlop={8}
                style={styles.chevronBtn}
                onPress={() => adjustHour(1)}
              >
                <Ionicons name="chevron-up" size={20} color={C.accent} />
              </Pressable>
              <Text style={styles.timeValue}>{displayHour}</Text>
              <Pressable
                hitSlop={8}
                style={styles.chevronBtn}
                onPress={() => adjustHour(-1)}
              >
                <Ionicons name="chevron-down" size={20} color={C.accent} />
              </Pressable>
            </View>

            <Text style={styles.timeColon}>:</Text>

            <View style={styles.timeColumn}>
              <Pressable
                hitSlop={8}
                style={styles.chevronBtn}
                onPress={() => adjustMinute(1)}
              >
                <Ionicons name="chevron-up" size={20} color={C.accent} />
              </Pressable>
              <Text style={styles.timeValue}>
                {String(state.minute).padStart(2, "0")}
              </Text>
              <Pressable
                hitSlop={8}
                style={styles.chevronBtn}
                onPress={() => adjustMinute(-1)}
              >
                <Ionicons name="chevron-down" size={20} color={C.accent} />
              </Pressable>
            </View>

            {!state.use24h && (
              <Pressable style={styles.amPmButton} onPress={toggleAmPm}>
                <Text style={styles.amPmText}>{isPm ? "PM" : "AM"}</Text>
              </Pressable>
            )}
          </View>

          {inPast ? (
            <Text style={styles.error}>
              {t("createMission.timeMustBeFuture")}
            </Text>
          ) : (
            <Text style={styles.helper}>
              {t("createMission.targetTimeHelper", {
                window: PUNCTUALITY_WINDOW_MIN,
                bonus: PUNCTUALITY_BONUS_XP,
                time: formatTargetTime(state.hour, state.minute, state.use24h),
              })}
            </Text>
          )}
        </View>
      )}
    </>
  );
}
