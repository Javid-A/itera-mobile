import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';
import { Colors, Spacing, Typography } from '../constants';

export default function LoginScreen() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  const { register } = useAuth();

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
        <Text style={[Typography.displayMD, { color: Colors.textPrimary, marginBottom: Spacing.lg }]}>
          {showRegister ? 'CREATE ACCOUNT' : 'SIGN IN'}
        </Text>

        <Text style={[Typography.label, { color: Colors.textSecondary }]}>Username</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter username"
          placeholderTextColor={Colors.muted}
          autoCapitalize="none"
          value={username}
          onChangeText={setUsername}
        />

        <Text style={[Typography.label, { color: Colors.textSecondary, marginTop: Spacing.md }]}>Password</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter password"
          placeholderTextColor={Colors.muted}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

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
          <Text style={[Typography.caption, { color: Colors.textSecondary }]}>
            {showRegister ? 'Already have an account? ' : "Don't have an account? "}
            <Text style={{ color: Colors.accent, fontFamily: 'Inter_600SemiBold' }}>
              {showRegister ? 'Sign in' : 'Register'}
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
    letterSpacing: 3,
    marginTop: Spacing.xs,
  },
  divider: {
    width: 44,
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
    borderRadius: 18,
    padding: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.borderBright,
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
    marginTop: Spacing.xs,
    height: 48,
  },
  button: {
    backgroundColor: Colors.accent,
    borderRadius: 16,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.xl,
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 6,
  },
  toggle: {
    alignItems: 'center',
    marginTop: Spacing.lg,
  },
});
