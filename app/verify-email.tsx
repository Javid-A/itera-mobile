import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { sendVerificationCode, verifyEmail } from '../src/api/auth';
import VerificationCodeInput from '../src/components/VerificationCodeInput';
import { useKeyboardBottomInset } from '../src/hooks/useKeyboardBottomInset';
import { useTheme } from '../src/context/ThemeContext';
import { useProfile } from '../src/state/queries/useProfile';
import { qk } from '../src/state/queryKeys';
import { Spacing, Typography } from '../src/constants';
import type { ColorScheme } from '../src/constants/colors';

const RESEND_COOLDOWN_S = 60;

function extractErrorCode(e: any): string | undefined {
  // Backend uses ProblemDetails (`code`); some legacy paths still emit `error`.
  return e?.response?.data?.code ?? e?.response?.data?.error;
}

function makeStyles(C: ColorScheme) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: C.background,
      padding: Spacing.xl,
    },
    closeBtn: {
      alignSelf: 'flex-end',
      padding: Spacing.sm,
      marginTop: Spacing.lg,
    },
    body: {
      flexGrow: 1,
      justifyContent: 'center',
    },
    title: {
      color: C.textPrimary,
      textAlign: 'center',
      marginBottom: Spacing.sm,
    },
    subtitle: {
      color: C.textSecondary,
      textAlign: 'center',
      marginBottom: Spacing.xxl,
      paddingHorizontal: Spacing.md,
    },
    email: {
      color: C.accent,
      fontFamily: 'Inter_600SemiBold',
    },
    error: {
      color: C.danger,
      textAlign: 'center',
      marginTop: Spacing.md,
    },
    success: {
      color: C.success,
      textAlign: 'center',
      marginTop: Spacing.md,
    },
    button: {
      backgroundColor: C.accent,
      borderRadius: 18,
      height: 54,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: Spacing.xl,
    },
    buttonDisabled: {
      opacity: 0.5,
    },
    resendRow: {
      alignItems: 'center',
      marginTop: Spacing.xl,
    },
    resendText: {
      color: C.textSecondary,
    },
    resendLink: {
      color: C.accent,
      fontFamily: 'Inter_700Bold',
    },
    skipBtn: {
      alignItems: 'center',
      marginTop: Spacing.lg,
    },
    skipText: {
      color: C.textSecondary,
    },
  });
}

export default function VerifyEmailScreen() {
  const { colors: C } = useTheme();
  const { t } = useTranslation();
  const styles = useMemo(() => makeStyles(C), [C]);
  const queryClient = useQueryClient();
  const { data: profile, isLoading: profileLoading } = useProfile();
  const keyboardInset = useKeyboardBottomInset();

  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [cooldown, setCooldown] = useState(0);
  // Has the backend accepted /auth/send-verification at least once on this
  // mount? Until it has, "Resend" is meaningless.
  const [codeSent, setCodeSent] = useState(false);

  // Auto-send a fresh code as soon as the profile is loaded.
  useEffect(() => {
    if (profileLoading || codeSent) return;
    sendVerificationCode()
      .then(() => {
        setCodeSent(true);
        setCooldown(RESEND_COOLDOWN_S);
      })
      .catch(() => {
        // Silent — user can hit Resend manually.
      });
  }, [profileLoading, codeSent]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => setCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  useEffect(() => {
    if (!profile?.emailVerified) return;
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/map');
  }, [profile?.emailVerified]);

  const submitCode = async (codeToSubmit?: string) => {
    const final = codeToSubmit ?? code;
    if (final.length !== 6) {
      setError(t('verifyEmail.codeLengthError'));
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await verifyEmail(final);
      // Dismiss is handled by the emailVerified useEffect — calling router.back() here too triggers a double-pop.
      await queryClient.invalidateQueries({ queryKey: qk.profile });
    } catch (e: any) {
      const errCode = extractErrorCode(e);
      if (errCode === 'EXPIRED') setError(t('verifyEmail.errorExpired'));
      else if (errCode === 'INVALID_CODE') setError(t('verifyEmail.errorInvalid'));
      else setError(t('verifyEmail.errorGeneric'));
      setCode('');
    } finally {
      setSubmitting(false);
    }
  };

  const resend = async () => {
    if (cooldown > 0) return;
    setError('');
    setInfo('');
    try {
      await sendVerificationCode();
      setInfo(t('verifyEmail.codeResent'));
      setCooldown(RESEND_COOLDOWN_S);
      setCodeSent(true);
    } catch (e: any) {
      const errCode = extractErrorCode(e);
      if (errCode === 'EMAIL_NOT_SET') setError(t('verifyEmail.errorEmailNotSet'));
      else setError(t('verifyEmail.errorGeneric'));
    }
  };

  return (
    <View style={styles.container}>
      <Pressable style={styles.closeBtn} onPress={() => router.back()} hitSlop={12}>
        <Ionicons name="close" size={28} color={C.textPrimary} />
      </Pressable>

      <ScrollView
        contentContainerStyle={[styles.body, { paddingBottom: keyboardInset }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      >
        <Text style={[Typography.displayMD, styles.title]}>{t('verifyEmail.title')}</Text>
        <Text style={[Typography.body, styles.subtitle]}>
          {t('verifyEmail.subtitle')}
          {profile?.email ? (
            <>
              {' '}
              <Text style={styles.email}>{profile.email}</Text>
            </>
          ) : null}
        </Text>

        <VerificationCodeInput
          value={code}
          onChange={setCode}
          onComplete={(c) => submitCode(c)}
          disabled={submitting}
        />

        {error ? <Text style={[Typography.caption, styles.error]}>{error}</Text> : null}
        {info && !error ? <Text style={[Typography.caption, styles.success]}>{info}</Text> : null}

        <Pressable
          style={[styles.button, (submitting || code.length !== 6) && styles.buttonDisabled]}
          onPress={() => submitCode()}
          disabled={submitting || code.length !== 6}
        >
          {submitting ? (
            <ActivityIndicator color={C.background} />
          ) : (
            <Text style={[Typography.cta, { color: C.background }]}>
              {t('verifyEmail.verifyButton')}
            </Text>
          )}
        </Pressable>

        <View style={styles.resendRow}>
          <Pressable onPress={resend} disabled={cooldown > 0} hitSlop={8}>
            <Text style={[Typography.body, styles.resendText]}>
              {t('verifyEmail.didntGetIt')}{' '}
              <Text style={[styles.resendLink, cooldown > 0 && { opacity: 0.5 }]}>
                {cooldown > 0
                  ? t('verifyEmail.resendIn', { seconds: cooldown })
                  : t('verifyEmail.resend')}
              </Text>
            </Text>
          </Pressable>
        </View>

        <Pressable style={styles.skipBtn} onPress={() => router.back()} hitSlop={8}>
          <Text style={[Typography.caption, styles.skipText]}>{t('verifyEmail.doLater')}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}
