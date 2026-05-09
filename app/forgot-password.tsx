import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { forgotPassword, resetPassword } from '../src/api/auth';
import { useAuth } from '../src/context/AuthContext';
import { useTheme } from '../src/context/ThemeContext';
import VerificationCodeInput from '../src/components/VerificationCodeInput';
import { Spacing, Typography } from '../src/constants';
import type { ColorScheme } from '../src/constants/colors';

type Step = 'email' | 'code' | 'password';

const RESEND_COOLDOWN_S = 60;
const MIN_PASSWORD_LENGTH = 8;

function makeStyles(C: ColorScheme) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: C.background,
      padding: Spacing.xl,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: Spacing.lg,
    },
    iconBtn: {
      padding: Spacing.sm,
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
  });
}

export default function ForgotPasswordScreen() {
  const { colors: C } = useTheme();
  const { t } = useTranslation();
  const { login } = useAuth();
  const styles = useMemo(() => makeStyles(C), [C]);

  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => setCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  const goBack = () => {
    setError('');
    setInfo('');
    if (step === 'email') {
      router.back();
      return;
    }
    if (step === 'code') {
      setCode('');
      setStep('email');
      return;
    }
    setStep('code');
  };

  const submitEmail = async () => {
    const trimmed = email.trim();
    if (!trimmed || !trimmed.includes('@')) {
      setError(t('forgotPassword.emailInvalid'));
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await forgotPassword(trimmed);
      setEmail(trimmed);
      setStep('code');
      setCooldown(RESEND_COOLDOWN_S);
    } catch {
      setError(t('forgotPassword.errorGeneric'));
    } finally {
      setSubmitting(false);
    }
  };

  const submitCode = (codeToCheck?: string) => {
    const final = codeToCheck ?? code;
    if (final.length !== 6) {
      setError(t('forgotPassword.codeLengthError'));
      return;
    }
    // No backend verify-only endpoint — final reset call validates the code.
    // Move on to the password step; show validation errors there.
    setError('');
    setInfo('');
    setCode(final);
    setStep('password');
  };

  const submitPassword = async () => {
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setError(t('forgotPassword.passwordTooShort', { length: MIN_PASSWORD_LENGTH }));
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await resetPassword(email, code, newPassword);
      // Backend has no "username from email" endpoint right now, so we can't
      // auto-login here. Send the user back to /login with a success notice.
      router.replace({ pathname: '/login', params: { resetSuccess: '1' } });
    } catch (e: any) {
      const errCode = e?.response?.data?.code ?? e?.response?.data?.error;
      if (errCode === 'EXPIRED' || errCode === 'INVALID_CODE') {
        setError(t('forgotPassword.errorCodeInvalid'));
        setStep('code');
        setCode('');
      } else if (errCode === 'WEAK_PASSWORD') {
        setError(t('forgotPassword.passwordWeak'));
      } else {
        setError(t('forgotPassword.errorGeneric'));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const resend = async () => {
    if (cooldown > 0) return;
    setError('');
    setInfo('');
    try {
      await forgotPassword(email);
      setInfo(t('forgotPassword.codeResent'));
      setCooldown(RESEND_COOLDOWN_S);
    } catch {
      setError(t('forgotPassword.errorGeneric'));
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Pressable style={styles.iconBtn} onPress={goBack} hitSlop={12}>
          <Ionicons name="chevron-back" size={28} color={C.textPrimary} />
        </Pressable>
        <View style={{ width: 28 }} />
      </View>

      <View style={styles.body}>
        {step === 'email' && (
          <>
            <Text style={[Typography.displayMD, styles.title]}>{t('forgotPassword.titleEmail')}</Text>
            <Text style={[Typography.body, styles.subtitle]}>{t('forgotPassword.subtitleEmail')}</Text>

            <Text style={[Typography.label, styles.fieldLabel]}>{t('login.email')}</Text>
            <TextInput
              style={styles.input}
              placeholder={t('login.emailPlaceholder')}
              placeholderTextColor={C.textSecondary}
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
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
                  {t('forgotPassword.sendCode')}
                </Text>
              )}
            </Pressable>
          </>
        )}

        {step === 'code' && (
          <>
            <Text style={[Typography.displayMD, styles.title]}>{t('forgotPassword.titleCode')}</Text>
            <Text style={[Typography.body, styles.subtitle]}>
              {t('forgotPassword.subtitleCode')} <Text style={styles.email}>{email}</Text>
            </Text>

            <VerificationCodeInput
              value={code}
              onChange={setCode}
              onComplete={(c) => submitCode(c)}
            />

            {error ? <Text style={[Typography.caption, styles.error]}>{error}</Text> : null}
            {info && !error ? <Text style={[Typography.caption, styles.success]}>{info}</Text> : null}

            <Pressable
              style={[styles.button, code.length !== 6 && styles.buttonDisabled]}
              onPress={() => submitCode()}
              disabled={code.length !== 6}
            >
              <Text style={[Typography.cta, { color: C.background }]}>
                {t('forgotPassword.continue')}
              </Text>
            </Pressable>

            <View style={styles.resendRow}>
              <Pressable onPress={resend} disabled={cooldown > 0} hitSlop={8}>
                <Text style={[Typography.body, styles.resendText]}>
                  {t('forgotPassword.didntGetIt')}{' '}
                  <Text style={[styles.resendLink, cooldown > 0 && { opacity: 0.5 }]}>
                    {cooldown > 0
                      ? t('forgotPassword.resendIn', { seconds: cooldown })
                      : t('forgotPassword.resend')}
                  </Text>
                </Text>
              </Pressable>
            </View>
          </>
        )}

        {step === 'password' && (
          <>
            <Text style={[Typography.displayMD, styles.title]}>{t('forgotPassword.titlePassword')}</Text>
            <Text style={[Typography.body, styles.subtitle]}>{t('forgotPassword.subtitlePassword')}</Text>

            <Text style={[Typography.label, styles.fieldLabel]}>{t('forgotPassword.newPasswordLabel')}</Text>
            <TextInput
              style={styles.input}
              placeholder={t('forgotPassword.newPasswordPlaceholder')}
              placeholderTextColor={C.textSecondary}
              secureTextEntry
              value={newPassword}
              onChangeText={setNewPassword}
              autoFocus
            />

            {error ? <Text style={[Typography.caption, styles.error]}>{error}</Text> : null}

            <Pressable
              style={[styles.button, submitting && styles.buttonDisabled]}
              onPress={submitPassword}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color={C.background} />
              ) : (
                <Text style={[Typography.cta, { color: C.background }]}>
                  {t('forgotPassword.resetPassword')}
                </Text>
              )}
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}
