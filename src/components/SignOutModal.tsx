import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { Spacing, Typography } from '../constants';
import type { ColorScheme } from '../constants/colors';

function makeStyles(C: ColorScheme) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.6)',
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: Spacing.xl,
    },
    card: {
      width: '100%',
      backgroundColor: C.background,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: C.borderBright,
      overflow: 'hidden',
    },
    body: {
      alignItems: 'center',
      paddingTop: Spacing.xl,
      paddingBottom: Spacing.lg,
      paddingHorizontal: Spacing.xl,
    },
    iconWrap: {
      width: 56,
      height: 56,
      borderRadius: 18,
      backgroundColor: C.dangerDim ?? 'rgba(239,68,68,0.12)',
      borderWidth: 1,
      borderColor: C.danger,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: Spacing.md,
    },
    title: {
      fontFamily: 'Rajdhani_700Bold',
      fontSize: 20,
      letterSpacing: 1.2,
      color: C.textPrimary,
      marginBottom: Spacing.sm,
    },
    message: {
      fontFamily: 'Inter_500Medium',
      fontSize: 14,
      color: C.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
    },
    divider: {
      height: 1,
      backgroundColor: C.borderBright,
    },
    actions: {
      flexDirection: 'row',
    },
    btn: {
      flex: 1,
      paddingVertical: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    btnDivider: {
      width: 1,
      backgroundColor: C.borderBright,
    },
    cancelText: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 15,
      color: C.textSecondary,
    },
    confirmText: {
      fontFamily: 'Rajdhani_700Bold',
      fontSize: 16,
      letterSpacing: 0.8,
      color: C.danger,
    },
  });
}

interface Props {
  visible: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export default function SignOutModal({ visible, onConfirm, onClose }: Props) {
  const { colors: C } = useTheme();
  const { t } = useTranslation();
  const styles = makeStyles(C);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable onPress={() => {}} style={styles.card}>
          <View style={styles.body}>
            <View style={styles.iconWrap}>
              <Ionicons name="log-out-outline" size={26} color={C.danger} />
            </View>
            <Text style={styles.title}>{t('profile.signOutConfirmTitle').toUpperCase()}</Text>
            <Text style={styles.message}>{t('profile.signOutConfirmMsg')}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.actions}>
            <Pressable style={styles.btn} onPress={onClose}>
              <Text style={styles.cancelText}>{t('common.cancel')}</Text>
            </Pressable>
            <View style={styles.btnDivider} />
            <Pressable style={styles.btn} onPress={onConfirm}>
              <Text style={styles.confirmText}>{t('profile.signOut').toUpperCase()}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
