import { ReactNode } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../constants';

interface Props {
  children: ReactNode;
  style?: ViewStyle;
  padded?: boolean;
}

export default function ScreenContainer({ children, style, padded = true }: Props) {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={[styles.container, padded && styles.padded, style]}>
        {children}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  container: {
    flex: 1,
  },
  padded: {
    paddingHorizontal: 16,
  },
});
