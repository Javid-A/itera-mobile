import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors, Spacing, Typography } from "../../constants";
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

export default function LocationSearchField({
  selectedName,
  query,
  results,
  searching,
  onQueryChange,
  onSelectResult,
  onClear,
}: Props) {
  return (
    <>
      <View style={styles.locationField}>
        <Ionicons name="search" size={16} color={Colors.textSecondary} />
        <TextInput
          style={styles.locationInput}
          placeholder="Search a place..."
          placeholderTextColor={Colors.textSecondary}
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
            <Ionicons name="close" size={16} color={Colors.background} />
          </Pressable>
        ) : searching ? (
          <ActivityIndicator size="small" color={Colors.accent} />
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
              <Ionicons name="location-outline" size={15} color={Colors.accent} />
              <Text
                style={[
                  Typography.body,
                  { color: Colors.textPrimary, flex: 1, marginLeft: 8 },
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

const styles = StyleSheet.create({
  locationField: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.borderBright,
    paddingHorizontal: Spacing.md,
    height: 50,
    gap: 10,
  },
  locationInput: {
    flex: 1,
    color: Colors.textPrimary,
    fontFamily: "Inter_400Regular",
    fontSize: 15,
  },
  clearLocationBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  resultsList: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.borderBright,
    marginTop: Spacing.sm,
  },
  resultItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
  },
  resultBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
});
