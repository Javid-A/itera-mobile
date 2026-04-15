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
      <Text style={[Typography.h1, styles.title]}>ITERA</Text>
      <Text style={[Typography.caption, styles.subtitle]}>GAMIFIED PRODUCTIVITY</Text>

      <View style={styles.card}>
        <Text style={[Typography.h3, { color: Colors.textPrimary, marginBottom: Spacing.lg }]}>
          {showRegister ? 'CREATE ACCOUNT' : 'SIGN IN'}
        </Text>

        <Text style={[Typography.label, { color: Colors.textSecondary }]}>Username</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter username"
          placeholderTextColor={Colors.textSecondary}
          autoCapitalize="none"
          value={username}
          onChangeText={setUsername}
        />

        <Text style={[Typography.label, { color: Colors.textSecondary, marginTop: Spacing.md }]}>Password</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter password"
          placeholderTextColor={Colors.textSecondary}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        {error ? (
          <Text style={[Typography.caption, { color: '#FF4444', marginTop: Spacing.sm }]}>{error}</Text>
        ) : null}

        <Pressable style={styles.button} onPress={handleSubmit} disabled={loading}>
          {loading ? (
            <ActivityIndicator color={Colors.textPrimary} />
          ) : (
            <Text style={[Typography.h3, { color: Colors.textPrimary }]}>
              {showRegister ? 'REGISTER' : 'LOGIN'}
            </Text>
          )}
        </Pressable>

        <Pressable onPress={() => { setShowRegister((v) => !v); setError(''); }} style={styles.toggle}>
          <Text style={[Typography.caption, { color: Colors.textSecondary }]}>
            {showRegister ? 'Already have an account? ' : "Don't have an account? "}
            <Text style={{ color: Colors.accent }}>
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
  title: {
    color: Colors.accent,
    letterSpacing: 8,
  },
  subtitle: {
    color: Colors.textSecondary,
    letterSpacing: 4,
    marginTop: Spacing.xs,
    marginBottom: Spacing.xxl,
  },
  card: {
    width: '100%',
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: Spacing.xl,
  },
  input: {
    backgroundColor: Colors.background,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#444444',
    color: Colors.textPrimary,
    fontSize: 16,
    padding: Spacing.md,
    marginTop: Spacing.xs,
  },
  button: {
    backgroundColor: Colors.accent,
    borderRadius: 8,
    padding: Spacing.md,
    alignItems: 'center',
    marginTop: Spacing.xl,
  },
  toggle: {
    alignItems: 'center',
    marginTop: Spacing.lg,
  },
});
