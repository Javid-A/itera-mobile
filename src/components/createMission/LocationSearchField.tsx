import { useMemo } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Spacing, Typography } from "../../constants";
import { useTheme } from "../../context/ThemeContext";
import type { ColorScheme } from "../../constants/colors";
import type { LocationResult } from "../../hooks/useLocationSearch";

interface Props {
  selectedName: string;
  query: string;
  results: LocationResult[];
  searching: boolean;
  onQueryChange: (q: string) => void;
  onSelectResult: (item: LocationResult) => void;
  onClear: () => void;
}

function makeStyles(C: ColorScheme) {
  return StyleSheet.create({
    locationField: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: C.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: C.borderBright,
      paddingHorizontal: Spacing.md,
      height: 50,
      gap: 10,
    },
    locationInput: {
      flex: 1,
      color: C.textPrimary,
      fontFamily: "Inter_400Regular",
      fontSize: 15,
    },
    clearLocationBtn: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: C.accent,
      alignItems: "center",
      justifyContent: "center",
    },
    resultsList: {
      backgroundColor: C.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: C.borderBright,
      marginTop: Spacing.sm,
    },
    resultItem: {
      flexDirection: "row",
      alignItems: "center",
      padding: Spacing.md,
    },
    resultBorder: {
      borderBottomWidth: 1,
      borderBottomColor: C.border,
    },
  });
}

export default function LocationSearchField({
  selectedName,
  query,
  results,
  searching,
  onQueryChange,
  onSelectResult,
  onClear,
}: Props) {
  const { colors: C } = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);

  return (
    <>
      <View style={styles.locationField}>
        <Ionicons name="search" size={16} color={C.textSecondary} />
        <TextInput
          style={styles.locationInput}
          placeholder="Search a place..."
          placeholderTextColor={C.textSecondary}
          value={selectedName || query}
          onChangeText={(t) => {
            if (selectedName) onClear();
            onQueryChange(t);
          }}
        />
        {selectedName ? (
          <Pressable
            style={styles.clearLocationBtn}
            onPress={onClear}
            hitSlop={8}
          >
            <Ionicons name="close" size={16} color={C.background} />
          </Pressable>
        ) : searching ? (
          <ActivityIndicator size="small" color={C.accent} />
        ) : null}
      </View>

      {results.length > 0 && (
        <View style={styles.resultsList}>
          {results.map((item, i) => (
            <Pressable
              key={item.id}
              style={[
                styles.resultItem,
                i < results.length - 1 && styles.resultBorder,
              ]}
              onPress={() => onSelectResult(item)}
            >
              <Ionicons name="location-outline" size={15} color={C.accent} />
              <Text
                style={[
                  Typography.body,
                  { color: C.textPrimary, flex: 1, marginLeft: 8 },
                ]}
                numberOfLines={2}
              >
                {item.name}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
    </>
  );
}
