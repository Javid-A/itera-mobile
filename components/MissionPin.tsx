import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants';

const ICON_MAP: Record<string, keyof typeof Ionicons.glyphMap> = {
  briefcase: 'briefcase',
  barbell: 'barbell',
  cafe: 'cafe',
  star: 'star',
  home: 'home',
  school: 'school',
};

interface Props {
  iconType: string;
}

export default function MissionPin({ iconType }: Props) {
  const iconName = ICON_MAP[iconType] ?? 'location';

  return (
    <View style={styles.container}>
      <View style={styles.diamond}>
        <View style={styles.iconInner}>
          <Ionicons name={iconName} size={12} color={Colors.textPrimary} />
        </View>
      </View>
      <View style={styles.stem} />
      <View style={styles.glow} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    width: 30,
    height: 42,
  },
  diamond: {
    width: 22,
    height: 22,
    backgroundColor: Colors.accent,
    transform: [{ rotate: '45deg' }],
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 4,
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 6,
  },
  stem: {
    width: 2,
    height: 10,
    backgroundColor: Colors.accent,
    marginTop: -2,
  },
  iconInner: {
    transform: [{ rotate: '-45deg' }],
  },
  glow: {
    width: 10,
    height: 3,
    borderRadius: 6,
    backgroundColor: Colors.accent,
    opacity: 0.3,
    marginTop: 2,
  },
});
