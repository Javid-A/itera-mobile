import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../src/context/AuthContext';
import { useTheme } from '../src/context/ThemeContext';
import { useKeyboardBottomInset } from '../src/hooks/useKeyboardBottomInset';
import { Spacing, Typography } from '../src/constants';
import type { ColorScheme } from '../src/constants/colors';

function makeStyles(C: ColorScheme) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: C.background,
    },
    scrollContent: {
      flexGrow: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: Spacing.xl,
    },
    titleWrap: {
      alignItems: 'center',
      marginBottom: Spacing.xxl,
    },
    logo: {
      width: 220,
      height: 60,
    },
    card: {
      width: '100%',
      backgroundColor: C.surface,
      borderRadius: 22,
      padding: Spacing.xl,
      borderWidth: 1,
      borderColor: C.borderBright,
    },
    cardTitle: {
      color: C.textPrimary,
      textAlign: 'center',
      marginBottom: Spacing.lg,
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
    forgot: {
      alignSelf: 'flex-end',
      marginTop: Spacing.sm,
    },
    forgotText: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 13,
      color: C.blue,
    },
    button: {
      backgroundColor: C.accent,
      borderRadius: 18,
      height: 54,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: Spacing.xl,
      shadowColor: C.accent,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.45,
      shadowRadius: 18,
      elevation: 8,
    },
    toggle: {
      alignItems: 'center',
      marginTop: Spacing.lg,
    },
  });
}

export default function LoginScreen() {
  const { login, register } = useAuth();
  const { colors: C, isDark } = useTheme();
  const { t } = useTranslation();
  const styles = useMemo(() => makeStyles(C), [C]);
  const params = useLocalSearchParams<{ resetSuccess?: string }>();
  const keyboardInset = useKeyboardBottomInset();

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);
  const [showRegister, setShowRegister] = useState(false);

  // Surface the success banner if the user just completed a password reset.
  useEffect(() => {
    if (params.resetSuccess === '1') {
      setInfo(t('login.resetSuccess'));
    }
  }, [params.resetSuccess, t]);

  const handleSubmit = async () => {
    if (!username.trim() || !password.trim()) {
      setError(t('login.validationError'));
      return;
    }
    if (showRegister && !email.trim().includes('@')) {
      setError(t('login.emailInvalid'));
      return;
    }
    setError('');
    setInfo('');
    setLoading(true);
    try {
      if (showRegister) {
        await register(username.trim(), email.trim(), password.trim());
        // Newly registered users land on the verification screen first; the
        // backend has already auto-sent the code on /auth/register.
        router.replace('/(tabs)/map');
        router.push('/verify-email');
      } else {
        await login(username.trim(), password.trim());
        router.replace('/(tabs)/map');
      }
    } catch (e: any) {
      const msg = e?.response?.data?.error ?? t('login.genericError');
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: Spacing.xl + keyboardInset }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      >
      <View style={styles.titleWrap}>
        <Image
          source={isDark
            ? require('../assets/logo-horizontal-dark.png')
            : require('../assets/logo-horizontal-light.png')}
          style={styles.logo}
          resizeMode="contain"
        />
      </View>

      <View style={styles.card}>
        <Text style={[Typography.displayMD, styles.cardTitle]}>
          {showRegister ? t('login.createAccount') : t('login.signIn')}
        </Text>

        <Text style={[Typography.label, styles.fieldLabel]}>{t('login.username')}</Text>
        <TextInput
          style={styles.input}
          placeholder={t('login.usernamePlaceholder')}
          placeholderTextColor={C.textSecondary}
          autoCapitalize="none"
          value={username}
          onChangeText={setUsername}
        />

        {showRegister && (
          <>
            <Text style={[Typography.label, styles.fieldLabel, { marginTop: Spacing.md }]}>{t('login.email')}</Text>
            <TextInput
              style={styles.input}
              placeholder={t('login.emailPlaceholder')}
              placeholderTextColor={C.textSecondary}
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
            />
          </>
        )}

        <Text style={[Typography.label, styles.fieldLabel, { marginTop: Spacing.md }]}>{t('login.password')}</Text>
        <TextInput
          style={styles.input}
          placeholder={t('login.passwordPlaceholder')}
          placeholderTextColor={C.textSecondary}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          value={password}
          onChangeText={setPassword}
        />

        {!showRegister && (
          <Pressable
            style={styles.forgot}
            hitSlop={6}
            onPress={() => router.push('/forgot-password')}
          >
            <Text style={styles.forgotText}>{t('login.forgotPassword')}</Text>
          </Pressable>
        )}

        {error ? (
          <Text style={[Typography.caption, { color: C.danger, marginTop: Spacing.sm }]}>{error}</Text>
        ) : null}
        {info && !error ? (
          <Text style={[Typography.caption, { color: C.success, marginTop: Spacing.sm }]}>{info}</Text>
        ) : null}

        <Pressable style={styles.button} onPress={handleSubmit} disabled={loading}>
          {loading ? (
            <ActivityIndicator color={C.background} />
          ) : (
            <Text style={[Typography.cta, { color: C.background }]}>
              {showRegister ? t('login.registerButton') : t('login.loginButton')}
            </Text>
          )}
        </Pressable>

        <Pressable onPress={() => { setShowRegister((v) => !v); setError(''); }} style={styles.toggle}>
          <Text style={[Typography.body, { color: C.textSecondary }]}>
            {showRegister ? t('login.alreadyHaveAccount') : t('login.dontHaveAccount')}
            <Text style={{ color: C.accent, fontFamily: 'Inter_700Bold' }}>
              {showRegister ? t('login.signInLink') : t('login.registerLink')}
            </Text>
          </Text>
        </Pressable>
      </View>
      </ScrollView>
    </View>
  );
}
