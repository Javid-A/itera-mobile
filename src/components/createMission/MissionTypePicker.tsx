import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../context/ThemeContext";
import type { ColorScheme } from "../../constants/colors";
import { LOC_TYPES, type LocType } from "./types";

interface Props {
  selected: LocType;
  onSelect: (t: LocType) => void;
}

function makeStyles(C: ColorScheme) {
  return StyleSheet.create({
    typeGrid: {
      flexDirection: "row",
      gap: 8,
    },
    typeTile: {
      flex: 1,
      aspectRatio: 0.85,
      borderRadius: 14,
      backgroundColor: C.surface,
      borderWidth: 1.5,
      borderColor: C.borderBright,
      alignItems: "center",
      justifyContent: "center",
      gap: 4,
    },
    typeTileSelected: {
      borderColor: C.accent,
      backgroundColor: C.accentSoft,
    },
    typeTileLabel: {
      fontFamily: "Inter_600SemiBold",
      fontSize: 11,
    },
  });
}

export default function MissionTypePicker({ selected, onSelect }: Props) {
  const { colors: C } = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);

  return (
    <View style={styles.typeGrid}>
      {LOC_TYPES.map((t) => {
        const isSelected = selected.key === t.key;
        return (
          <Pressable
            key={t.key}
            style={[styles.typeTile, isSelected && styles.typeTileSelected]}
            onPress={() => onSelect(t)}
          >
            <Ionicons
              name={t.icon}
              size={22}
              color={isSelected ? C.accent : C.textSecondary}
            />
            <Text
              style={[
                styles.typeTileLabel,
                { color: isSelected ? C.accent : C.textSecondary },
              ]}
            >
              {t.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
