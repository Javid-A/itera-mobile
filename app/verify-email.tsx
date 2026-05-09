import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { sendVerificationCode, verifyEmail } from '../src/api/auth';
import { updateEmail } from '../src/api/profile';
import VerificationCodeInput from '../src/components/VerificationCodeInput';
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
      flex: 1,
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
    fieldLabel: {
      color: C.textSecondary,
      marginBottom: Spacing.xs,
    },
    input: {
      backgroundColor: C.surface2,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: C.borderBright,
      color: C.textPrimary,
      fontFamily: 'Inter_400Regular',
      fontSize: 15,
      paddingHorizontal: Spacing.md,
      paddingVertical: 0,
      height: 50,
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

  // Two phases: legacy users (no email on record) must enter one first;
  // everyone else jumps straight to code entry.
  const needsEmail = !profileLoading && !profile?.email;

  const [emailDraft, setEmailDraft] = useState('');
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [cooldown, setCooldown] = useState(0);
  // Has the backend accepted /auth/send-verification at least once on this
  // mount? Until it has, "Resend" is meaningless.
  const [codeSent, setCodeSent] = useState(false);

  // Auto-send a fresh code when we already know the user's email.
  useEffect(() => {
    if (profileLoading || codeSent || !profile?.email) return;
    sendVerificationCode()
      .then(() => {
        setCodeSent(true);
        setCooldown(RESEND_COOLDOWN_S);
      })
      .catch((e) => {
        const errCode = extractErrorCode(e);
        if (errCode === 'EMAIL_NOT_SET') {
          // Profile cache was stale; the input flow handles this state.
          return;
        }
        // Silent — user can hit Resend manually.
      });
  }, [profileLoading, profile?.email, codeSent]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => setCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  useEffect(() => {
    if (profile?.emailVerified) router.back();
  }, [profile?.emailVerified]);

  const submitEmail = async () => {
    const trimmed = emailDraft.trim();
    if (!trimmed.includes('@')) {
      setError(t('verifyEmail.emailInvalid'));
      return;
    }
    setSubmitting(true);
    setError('');
    setInfo('');
    try {
      await updateEmail(trimmed);
      // Profile now has the new email; refetch so needsEmail flips to false.
      await queryClient.invalidateQueries({ queryKey: qk.profile });
      setCodeSent(true);
      setCooldown(RESEND_COOLDOWN_S);
      setInfo(t('verifyEmail.codeResent'));
    } catch (e: any) {
      const errCode = extractErrorCode(e);
      if (errCode === 'EMAIL_TAKEN') setError(t('verifyEmail.errorEmailTaken'));
      else if (errCode === 'ALREADY_VERIFIED') {
        // Server says we're already done; bounce.
        await queryClient.invalidateQueries({ queryKey: qk.profile });
        router.back();
      } else setError(t('verifyEmail.errorGeneric'));
    } finally {
      setSubmitting(false);
    }
  };

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
      await queryClient.invalidateQueries({ queryKey: qk.profile });
      router.back();
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

      <View style={styles.body}>
        {needsEmail ? (
          <>
            <Text style={[Typography.displayMD, styles.title]}>{t('verifyEmail.titleAddEmail')}</Text>
            <Text style={[Typography.body, styles.subtitle]}>{t('verifyEmail.subtitleAddEmail')}</Text>

            <Text style={[Typography.label, styles.fieldLabel]}>{t('login.email')}</Text>
            <TextInput
              style={styles.input}
              placeholder={t('login.emailPlaceholder')}
              placeholderTextColor={C.textSecondary}
              autoCapitalize="none"
              keyboardType="email-address"
              value={emailDraft}
              onChangeText={setEmailDraft}
              autoFocus
            />

            {error ? <Text style={[Typography.caption, styles.error]}>{error}</Text> : null}

            <Pressable
              style={[styles.button, submitting && styles.buttonDisabled]}
              onPress={submitEmail}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color={C.background} />
              ) : (
                <Text style={[Typography.cta, { color: C.background }]}>
                  {t('verifyEmail.sendCode')}
                </Text>
              )}
            </Pressable>
          </>
        ) : (
          <>
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
          </>
        )}
      </View>
    </View>
  );
}
