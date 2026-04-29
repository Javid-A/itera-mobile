import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';
import { Colors, Spacing, Typography } from '../src/constants';

export default function LoginScreen() {
  const { login, register } = useAuth();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showRegister, setShowRegister] = useState(false);

  const handleSubmit = async () => {
    if (!username.trim() || !password.trim()) {
      setError('Username and password are required.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      if (showRegister) {
        await register(username.trim(), password.trim());
      } else {
        await login(username.trim(), password.trim());
      }
      router.replace('/(tabs)/map');
    } catch (e: any) {
      const msg = e?.response?.data?.error ?? 'Something went wrong. Try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.titleWrap}>
        <Text style={styles.title}>
          ITERA<Text style={{ color: Colors.accent }}>.</Text>
        </Text>
        <Text style={styles.subtitle}>GAMIFIED PRODUCTIVITY</Text>
        <View style={styles.divider} />
      </View>

      <View style={styles.card}>
        <Text style={[Typography.displayMD, styles.cardTitle]}>
          {showRegister ? 'CREATE ACCOUNT' : 'SIGN IN'}
        </Text>

        <Text style={[Typography.label, styles.fieldLabel]}>USERNAME</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter username"
          placeholderTextColor={Colors.textSecondary}
          autoCapitalize="none"
          value={username}
          onChangeText={setUsername}
        />

        {showRegister && (
          <>
            <Text style={[Typography.label, styles.fieldLabel, { marginTop: Spacing.md }]}>EMAIL</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter email"
              placeholderTextColor={Colors.textSecondary}
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
            />
          </>
        )}

        <Text style={[Typography.label, styles.fieldLabel, { marginTop: Spacing.md }]}>PASSWORD</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter password"
          placeholderTextColor={Colors.textSecondary}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        {!showRegister && (
          <Pressable style={styles.forgot} hitSlop={6}>
            <Text style={styles.forgotText}>Forgot password?</Text>
          </Pressable>
        )}

        {error ? (
          <Text style={[Typography.caption, { color: Colors.danger, marginTop: Spacing.sm }]}>{error}</Text>
        ) : null}

        <Pressable style={styles.button} onPress={handleSubmit} disabled={loading}>
          {loading ? (
            <ActivityIndicator color={Colors.background} />
          ) : (
            <Text style={[Typography.cta, { color: Colors.background }]}>
              {showRegister ? 'REGISTER →' : 'LOGIN →'}
            </Text>
          )}
        </Pressable>

        <Pressable onPress={() => { setShowRegister((v) => !v); setError(''); }} style={styles.toggle}>
          <Text style={[Typography.body, { color: Colors.textSecondary }]}>
            {showRegister ? 'Already have an account? ' : "Don't have an account? "}
            <Text style={{ color: Colors.accent, fontFamily: 'Inter_700Bold' }}>
              {showRegister ? 'Sign In' : 'Register'}
            </Text>
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  titleWrap: {
    alignItems: 'center',
    marginBottom: Spacing.xxl,
  },
  title: {
    fontFamily: 'Rajdhani_700Bold',
    fontSize: 52,
    color: Colors.textPrimary,
    letterSpacing: -1,
    lineHeight: 56,
  },
  subtitle: {
    fontFamily: 'Rajdhani_600SemiBold',
    fontSize: 12,
    color: Colors.textSecondary,
    letterSpacing: 4,
    marginTop: Spacing.xs,
  },
  divider: {
    width: 56,
    height: 3,
    backgroundColor: Colors.accent,
    borderRadius: 2,
    marginTop: Spacing.md,
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
  },
  card: {
    width: '100%',
    backgroundColor: Colors.surface,
    borderRadius: 22,
    padding: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.borderBright,
  },
  cardTitle: {
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
  fieldLabel: {
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
  },
  input: {
    backgroundColor: Colors.surface2,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.borderBright,
    color: Colors.textPrimary,
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    padding: Spacing.md,
    height: 50,
  },
  forgot: {
    alignSelf: 'flex-end',
    marginTop: Spacing.sm,
  },
  forgotText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    color: Colors.blue,
  },
  button: {
    backgroundColor: Colors.accent,
    borderRadius: 18,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.xl,
    shadowColor: Colors.accent,
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
