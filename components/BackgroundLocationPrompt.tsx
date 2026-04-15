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
            <Ionicons name="close" size={24} color={Colors.textSecondary} />
          </Pressable>
          <Text style={[Typography.h2, { color: Colors.textPrimary, textAlign: 'center' }]}>
            Almost there!
          </Text>

          <View style={styles.videoContainer}>
            <VideoView
              player={player}
              style={styles.video}
              nativeControls={false}
              contentFit="cover"
            />
          </View>

          <Text style={[Typography.body, { color: Colors.textSecondary, textAlign: 'center', marginTop: Spacing.md, lineHeight: 24 }]}>
            To automatically complete missions when you arrive, Itera needs location access{' '}
            <Text style={{ color: Colors.textPrimary, fontWeight: '600' }}>all the time</Text>.
          </Text>

          <Text style={[Typography.caption, { color: Colors.textSecondary, textAlign: 'center', marginTop: Spacing.sm, lineHeight: 20 }]}>
            Without this, you'll need to open the app at each location to check in manually.
          </Text>

          <Pressable style={styles.enableButton} onPress={onEnable}>
            <Ionicons name="shield-checkmark-outline" size={20} color={Colors.textPrimary} />
            <Text style={[Typography.h3, { color: Colors.textPrimary, marginLeft: Spacing.sm }]}>
              Enable Auto-Tracking
            </Text>
          </Pressable>

          <Pressable style={styles.skipButton} onPress={onSkip}>
            <Text style={[Typography.body, { color: Colors.textPrimary, opacity: 0.6 }]}>
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
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: Spacing.lg,
    paddingBottom: Spacing.xxl,
    alignItems: 'center',
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
    backgroundColor: Colors.background,
    marginTop: Spacing.lg,
  },
  video: {
    width: '100%',
    height: '100%',
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
    minHeight: 44,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    marginTop: Spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
