import { useEffect } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Colors, Spacing, Typography } from '../constants';

const bgVideoSource = require('../../assets/video/bg-location.mp4');

interface Props {
  visible: boolean;
  onEnable: () => void;
  onSkip: () => void;
}

// Video player'ı sadece modal görünür haldeyken mount eden iç bileşen.
// useVideoPlayer her render'da çalıştığı için, ana bileşene konursa
// activity recreate olurken (background→foreground) "current activity is
// no longer available" hatası fırlatır.
function PromptContent({ onEnable, onSkip }: { onEnable: () => void; onSkip: () => void }) {
  const player = useVideoPlayer(bgVideoSource, (p) => {
    p.loop = true;
    p.muted = true;
    p.volume = 0;
    p.audioMixingMode = 'mixWithOthers';
  });

  useEffect(() => {
    player.muted = true;
    player.volume = 0;
    player.play();
    return () => {
      // useVideoPlayer, unmount'ta player'ı kendisi release ediyor.
      // Bu cleanup ondan sonra çalışırsa pause() "already released" atar.
      try {
        player.pause();
      } catch {}
    };
  }, [player]);

  return (
    <Pressable style={styles.overlay} onPress={onSkip}>
      <Pressable style={styles.content} onPress={(e) => e.stopPropagation()}>
        <View style={styles.titleRow}>
          <Text style={[Typography.displayLG, { color: Colors.textPrimary, fontSize: 28 }]}>
            ALMOST THERE
          </Text>
          <Pressable style={styles.closeButton} onPress={onSkip} hitSlop={12}>
            <Ionicons name="close" size={20} color={Colors.textSecondary} />
          </Pressable>
        </View>

        <View style={styles.videoContainer}>
          <VideoView
            player={player}
            style={styles.video}
            nativeControls={false}
            contentFit="cover"
          />
          <View style={styles.previewTooltip}>
            <Text style={styles.previewTooltipTitle}>Mission Complete!</Text>
            <Text style={styles.previewTooltipXP}>+100 XP</Text>
          </View>
          <View style={styles.previewXpChip}>
            <Text style={styles.previewXpChipText}>+100 XP</Text>
          </View>
        </View>

        <Text style={[Typography.bodyLg, { color: Colors.textSecondary, textAlign: 'center', marginTop: Spacing.md }]}>
          To complete missions automatically when you arrive, Itera needs location access{' '}
          <Text style={{ color: Colors.textPrimary, fontFamily: 'Inter_700Bold' }}>all the time</Text>.
        </Text>

        <Text style={[Typography.caption, { color: Colors.textSecondary, textAlign: 'center', marginTop: Spacing.sm }]}>
          Without this, you'll need to open the app at each location to check in manually.
        </Text>

        <Pressable style={styles.enableButton} onPress={onEnable}>
          <Ionicons name="shield-checkmark" size={18} color={Colors.background} />
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
  );
}

export default function BackgroundLocationPrompt({ visible, onEnable, onSkip }: Props) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onSkip}>
      {visible ? <PromptContent onEnable={onEnable} onSkip={onSkip} /> : null}
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
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xxl,
    borderTopWidth: 1,
    borderColor: Colors.borderBright,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: Colors.surface2,
    borderWidth: 1,
    borderColor: Colors.borderBright,
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoContainer: {
    width: '100%',
    height: 180,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#0a1226',
    marginTop: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.borderBright,
    position: 'relative',
  },
  video: {
    width: '100%',
    height: '100%',
  },
  previewTooltip: {
    position: 'absolute',
    left: 16,
    top: '38%',
    backgroundColor: 'rgba(7, 8, 15, 0.92)',
    borderWidth: 1,
    borderColor: Colors.borderBright,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  previewTooltipTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 12,
    color: Colors.textPrimary,
  },
  previewTooltipXP: {
    fontFamily: 'Rajdhani_700Bold',
    fontSize: 13,
    color: Colors.orange,
  },
  previewXpChip: {
    position: 'absolute',
    right: 16,
    top: '38%',
    backgroundColor: Colors.orange,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  previewXpChipText: {
    fontFamily: 'Rajdhani_700Bold',
    fontSize: 13,
    letterSpacing: 0.6,
    color: '#1a0f06',
  },
  enableButton: {
    flexDirection: 'row',
    backgroundColor: Colors.accent,
    borderRadius: 18,
    height: 56,
    paddingHorizontal: Spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginTop: Spacing.lg,
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 18,
    elevation: 8,
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
