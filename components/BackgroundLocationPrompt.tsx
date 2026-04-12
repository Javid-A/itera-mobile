import { Image, Linking, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Typography } from '../constants';

interface Props {
  visible: boolean;
  onEnable: () => void;
  onSkip: () => void;
}

export default function BackgroundLocationPrompt({ visible, onEnable, onSkip }: Props) {
  const handleEnable = () => {
    if (Platform.OS === 'android') {
      Linking.openSettings();
    }
    onEnable();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.content}>
          <Text style={[Typography.h2, { color: Colors.textPrimary, textAlign: 'center' }]}>
            Almost there!
          </Text>

          {/* Placeholder for animation — swap with Lottie/GIF later */}
          <View style={styles.animationPlaceholder}>
            <Ionicons name="navigate" size={48} color={Colors.accent} />
            <View style={styles.pulseRing} />
            <Text style={[Typography.caption, { color: Colors.textSecondary, marginTop: Spacing.sm }]}>
              Animation placeholder
            </Text>
          </View>

          <Text style={[Typography.body, { color: Colors.textSecondary, textAlign: 'center', marginTop: Spacing.md }]}>
            To automatically complete missions when you arrive, Itera needs location access{' '}
            <Text style={{ color: Colors.textPrimary, fontWeight: '600' }}>all the time</Text>.
          </Text>

          <Text style={[Typography.caption, { color: Colors.textSecondary, textAlign: 'center', marginTop: Spacing.sm }]}>
            Without this, you'll need to open the app at each location to check in manually.
          </Text>

          <Pressable style={styles.enableButton} onPress={handleEnable}>
            <Ionicons name="shield-checkmark-outline" size={20} color={Colors.textPrimary} />
            <Text style={[Typography.h3, { color: Colors.textPrimary, marginLeft: Spacing.sm }]}>
              Enable Auto-Tracking
            </Text>
          </Pressable>

          <Pressable style={styles.skipButton} onPress={onSkip}>
            <Text style={[Typography.body, { color: Colors.textSecondary }]}>
              I'll do it manually
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  content: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: Spacing.lg,
    paddingBottom: Spacing.xxl,
    alignItems: 'center',
  },
  animationPlaceholder: {
    width: 200,
    height: 160,
    borderRadius: 16,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.lg,
  },
  pulseRing: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: Colors.accent,
    opacity: 0.3,
  },
  enableButton: {
    flexDirection: 'row',
    backgroundColor: Colors.accent,
    borderRadius: 8,
    padding: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginTop: Spacing.lg,
  },
  skipButton: {
    padding: Spacing.md,
    marginTop: Spacing.sm,
  },
});
