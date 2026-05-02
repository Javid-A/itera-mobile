import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { AVAILABLE_LANGUAGES } from '../context/LanguageContext';
import type { LanguageCode } from '../context/LanguageContext';
import { Spacing, Typography } from '../constants';
import type { ColorScheme } from '../constants/colors';

const FLAGS: Record<string, string> = {
  en: '🇬🇧',
  de: '🇩🇪',
  ru: '🇷🇺',
  tr: '🇹🇷',
};

function makeStyles(C: ColorScheme) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.6)',
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: C.background,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      borderWidth: 1,
      borderBottomWidth: 0,
      borderColor: C.borderBright,
      paddingBottom: 36,
    },
    handle: {
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: C.border,
      alignSelf: 'center',
      marginTop: 12,
      marginBottom: 4,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
    },
    title: {
      fontFamily: 'Rajdhani_700Bold',
      fontSize: 13,
      letterSpacing: 1.6,
      color: C.textSecondary,
    },
    list: {
      paddingHorizontal: Spacing.md,
      gap: Spacing.sm,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: Spacing.md,
      borderRadius: 16,
      borderWidth: 1,
    },
    rowActive: {
      backgroundColor: C.accentSoft,
      borderColor: C.accentBorder,
    },
    rowInactive: {
      backgroundColor: C.surface,
      borderColor: C.borderBright,
    },
    flag: {
      fontSize: 26,
      width: 38,
    },
    labelWrap: {
      flex: 1,
      marginLeft: Spacing.sm,
    },
    langLabel: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 15,
    },
    langCode: {
      fontFamily: 'Inter_500Medium',
      fontSize: 12,
      marginTop: 1,
    },
  });
}

interface Props {
  visible: boolean;
  current: LanguageCode;
  onSelect: (code: LanguageCode) => void;
  onClose: () => void;
}

export default function LanguagePickerModal({ visible, current, onSelect, onClose }: Props) {
  const { colors: C } = useTheme();
  const { t } = useTranslation();
  const styles = makeStyles(C);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable onPress={() => {}} style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <Text style={styles.title}>{t('profile.language').toUpperCase()}</Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <Ionicons name="close" size={20} color={C.textSecondary} />
            </Pressable>
          </View>

          <View style={styles.list}>
            {AVAILABLE_LANGUAGES.map((lang) => {
              const active = lang.code === current;
              return (
                <Pressable
                  key={lang.code}
                  style={[styles.row, active ? styles.rowActive : styles.rowInactive]}
                  onPress={() => {
                    onSelect(lang.code);
                    onClose();
                  }}
                >
                  <Text style={styles.flag}>{FLAGS[lang.code] ?? '🌐'}</Text>
                  <View style={styles.labelWrap}>
                    <Text style={[styles.langLabel, { color: active ? C.accent : C.textPrimary }]}>
                      {lang.label}
                    </Text>
                    <Text style={[styles.langCode, { color: C.textSecondary }]}>
                      {lang.code.toUpperCase()}
                    </Text>
                  </View>
                  {active && <Ionicons name="checkmark-circle" size={20} color={C.accent} />}
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
