import { useEffect, useMemo } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useTranslation } from 'react-i18next';
import { Spacing, Typography } from '../constants';
import { useTheme } from '../context/ThemeContext';
import type { ColorScheme } from '../constants/colors';

const bgVideoSource = require('../../assets/video/bg-location.mp4');

interface Props {
  visible: boolean;
  onEnable: () => void;
  onSkip: () => void;
}

function makeStyles(C: ColorScheme, isDark: boolean) {
  // Video kutusu daima koyu kalır (videonun background'u koyu) — light mode'da
  // sadece kart kabuğu ve metinler tema renklerine geçiyor.
  const videoBg = isDark ? '#0a1226' : '#0a1226';
  const tooltipBg = isDark ? 'rgba(7, 8, 15, 0.92)' : 'rgba(255, 255, 255, 0.95)';
  const tooltipBorder = isDark ? C.borderBright : 'rgba(14, 15, 42, 0.18)';
  // Light mode'da turuncu chip üstündeki metin için koyu navy daha okunaklı.
  const xpChipText = isDark ? '#1a0f06' : '#1a0f06';

  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.7)',
      justifyContent: 'flex-end',
    },
    content: {
      backgroundColor: C.surface,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.lg,
      paddingBottom: Spacing.xxl,
      borderTopWidth: 1,
      borderColor: C.borderBright,
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
      backgroundColor: C.surface2,
      borderWidth: 1,
      borderColor: C.borderBright,
      alignItems: 'center',
      justifyContent: 'center',
    },
    videoContainer: {
      width: '100%',
      height: 180,
      borderRadius: 18,
      overflow: 'hidden',
      backgroundColor: videoBg,
      marginTop: Spacing.md,
      borderWidth: 1,
      borderColor: C.borderBright,
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
      backgroundColor: tooltipBg,
      borderWidth: 1,
      borderColor: tooltipBorder,
      borderRadius: 12,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    previewTooltipTitle: {
      fontFamily: 'Inter_700Bold',
      fontSize: 12,
      color: isDark ? C.textPrimary : '#0e0f2a',
    },
    previewTooltipXP: {
      fontFamily: 'Rajdhani_700Bold',
      fontSize: 13,
      color: C.orange,
    },
    previewXpChip: {
      position: 'absolute',
      right: 16,
      top: '38%',
      backgroundColor: C.orange,
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 6,
    },
    previewXpChipText: {
      fontFamily: 'Rajdhani_700Bold',
      fontSize: 13,
      letterSpacing: 0.6,
      color: xpChipText,
    },
    enableButton: {
      flexDirection: 'row',
      backgroundColor: C.accent,
      borderRadius: 18,
      height: 56,
      paddingHorizontal: Spacing.lg,
      alignItems: 'center',
      justifyContent: 'center',
      width: '100%',
      marginTop: Spacing.lg,
      shadowColor: C.accent,
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
}

function PromptContent({ onEnable, onSkip }: { onEnable: () => void; onSkip: () => void }) {
  const { colors: C, isDark } = useTheme();
  const { t } = useTranslation();
  const styles = useMemo(() => makeStyles(C, isDark), [C, isDark]);

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
      try {
        player.pause();
      } catch {}
    };
  }, [player]);

  return (
    <Pressable style={styles.overlay} onPress={onSkip}>
      <Pressable style={styles.content} onPress={(e) => e.stopPropagation()}>
        <View style={styles.titleRow}>
          <Text style={[Typography.displayLG, { color: C.textPrimary, fontSize: 28 }]}>
            {t('bgPrompt.title')}
          </Text>
          <Pressable style={styles.closeButton} onPress={onSkip} hitSlop={12}>
            <Ionicons name="close" size={20} color={C.textSecondary} />
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
            <Text style={styles.previewTooltipTitle}>{t('bgPrompt.missionComplete')}</Text>
            <Text style={styles.previewTooltipXP}>{t('bgPrompt.xpPreview')}</Text>
          </View>
          <View style={styles.previewXpChip}>
            <Text style={styles.previewXpChipText}>{t('bgPrompt.xpPreview')}</Text>
          </View>
        </View>

        <Text style={[Typography.bodyLg, { color: C.textSecondary, textAlign: 'center', marginTop: Spacing.md }]}>
          {t('bgPrompt.bodyPrefix')}{' '}
          <Text style={{ color: C.textPrimary, fontFamily: 'Inter_700Bold' }}>{t('bgPrompt.bodyHighlight')}</Text>.
        </Text>

        <Text style={[Typography.caption, { color: C.textSecondary, textAlign: 'center', marginTop: Spacing.sm }]}>
          {t('bgPrompt.caption')}
        </Text>

        <Pressable style={styles.enableButton} onPress={onEnable}>
          <Ionicons name="shield-checkmark" size={18} color={C.background} />
          <Text style={[Typography.cta, { color: C.background, marginLeft: Spacing.sm }]}>
            {t('bgPrompt.enableButton')}
          </Text>
        </Pressable>

        <Pressable style={styles.skipButton} onPress={onSkip}>
          <Text style={[Typography.bodyMedium, { color: C.textSecondary }]}>
            {t('bgPrompt.skipButton')}
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
