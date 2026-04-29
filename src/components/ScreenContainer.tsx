import { ReactNode } from 'react';
import { View, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';

interface Props {
  children: ReactNode;
  style?: ViewStyle;
  padded?: boolean;
}

export default function ScreenContainer({ children, style, padded = true }: Props) {
  const { colors } = useTheme();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={[{ flex: 1 }, padded && { paddingHorizontal: 16 }, style]}>
        {children}
      </View>
    </SafeAreaView>
  );
}
