import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../../constants";
import { LOC_TYPES, type LocType } from "./types";

interface Props {
  selected: LocType;
  onSelect: (t: LocType) => void;
}

export default function MissionTypePicker({ selected, onSelect }: Props) {
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
              color={isSelected ? Colors.accent : Colors.textSecondary}
            />
            <Text
              style={[
                styles.typeTileLabel,
                { color: isSelected ? Colors.accent : Colors.textSecondary },
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

const styles = StyleSheet.create({
  typeGrid: {
    flexDirection: "row",
    gap: 8,
  },
  typeTile: {
    flex: 1,
    aspectRatio: 0.85,
    borderRadius: 14,
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.borderBright,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  typeTileSelected: {
    borderColor: Colors.accent,
    backgroundColor: Colors.accentSoft,
  },
  typeTileLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
  },
});
