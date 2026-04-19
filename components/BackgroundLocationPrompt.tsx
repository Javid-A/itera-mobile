import { useEffect } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Colors, Spacing, Typography } from '../constants';

const bgVideoSource = require('../assets/video/bg-location.mp4');

interface Props {
  visible: boolean;
  onEnable: () => void;
  onSkip: () => void;
}

export default function BackgroundLocationPrompt({ visible, onEnable, onSkip }: Props) {
  const player = useVideoPlayer(bgVideoSource, (p) => {
    p.loop = true;
    p.muted = true;
    p.volume = 0;
    p.audioMixingMode = 'mixWithOthers';
  });

  useEffect(() => {
    player.muted = true;
    player.volume = 0;
    if (visible) {
      player.play();
    } else {
      player.pause();
    }
  }, [visible, player]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onSkip}>
      <Pressable style={styles.overlay} onPress={onSkip}>
        <Pressable style={styles.content} onPress={(e) => e.stopPropagation()}>
          <Pressable style={styles.closeButton} onPress={onSkip} hitSlop={12}>
            <Ionicons name="close" size={22} color={Colors.textSecondary} />
          </Pressable>
          <Text style={[Typography.displayMD, { color: Colors.textPrimary, textAlign: 'center' }]}>
            ALMOST THERE
          </Text>

          <View style={styles.videoContainer}>
            <VideoView
              player={player}
              style={styles.video}
              nativeControls={false}
              contentFit="cover"
            />
          </View>

          <Text style={[Typography.bodyLg, { color: Colors.textSecondary, textAlign: 'center', marginTop: Spacing.md }]}>
            To complete missions automatically when you arrive, Itera needs location access{' '}
            <Text style={{ color: Colors.textPrimary, fontFamily: 'Inter_600SemiBold' }}>all the time</Text>.
          </Text>

          <Text style={[Typography.caption, { color: Colors.textSecondary, textAlign: 'center', marginTop: Spacing.sm }]}>
            Without this, you'll need to open the app at each location to check in manually.
          </Text>

          <Pressable style={styles.enableButton} onPress={onEnable}>
            <Ionicons name="shield-checkmark-outline" size={18} color={Colors.background} />
            <Text style={[Typography.cta, { color: Colors.background, marginLeft: Spacing.sm }]}>
              ENABLE AUTO-TRACKING
            </Text>
          </Pressable>

          <Pressable style={styles.skipButton} onPress={onSkip}>
            <Text style={[Typography.bodyMedium, { color: Colors.textSecondary }]}>
              I'll do it manually
            </Text>
          </Pressable>
        </Pressable>
      </Pressable>
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
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: Spacing.lg,
    paddingBottom: Spacing.xxl,
    alignItems: 'center',
    borderTopWidth: 1,
    borderColor: Colors.borderBright,
  },
  closeButton: {
    position: 'absolute',
    top: Spacing.md,
    right: Spacing.md,
    zIndex: 1,
    padding: Spacing.xs,
  },
  videoContainer: {
    width: 220,
    height: 180,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: Colors.surface2,
    marginTop: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  video: {
    width: '100%',
    height: '100%',
  },
  enableButton: {
    flexDirection: 'row',
    backgroundColor: Colors.accent,
    borderRadius: 16,
    height: 52,
    paddingHorizontal: Spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginTop: Spacing.lg,
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 6,
  },
  skipButton: {
    minHeight: 44,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    marginTop: Spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
