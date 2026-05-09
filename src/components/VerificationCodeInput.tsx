import { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import type { ColorScheme } from '../constants/colors';
import { Spacing } from '../constants';

interface Props {
  value: string;
  onChange: (next: string) => void;
  onComplete?: (code: string) => void;
  length?: number;
  autoFocus?: boolean;
  disabled?: boolean;
}

const DEFAULT_LENGTH = 6;

function makeStyles(C: ColorScheme) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      gap: Spacing.sm,
      justifyContent: 'center',
    },
    box: {
      width: 46,
      height: 56,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: C.borderBright,
      backgroundColor: C.surface2,
      color: C.textPrimary,
      fontFamily: 'Rajdhani_700Bold',
      fontSize: 26,
      textAlign: 'center',
    },
    boxFilled: {
      borderColor: C.accent,
    },
  });
}

export default function VerificationCodeInput({
  value,
  onChange,
  onComplete,
  length = DEFAULT_LENGTH,
  autoFocus = true,
  disabled = false,
}: Props) {
  const { colors: C } = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);
  const refs = useRef<Array<TextInput | null>>([]);

  useEffect(() => {
    if (autoFocus) {
      const t = setTimeout(() => refs.current[0]?.focus(), 80);
      return () => clearTimeout(t);
    }
  }, [autoFocus]);

  const chars = Array.from({ length }, (_, i) => value[i] ?? '');

  const handleChange = (idx: number, raw: string) => {
    const digits = raw.replace(/\D/g, '');
    if (!digits) {
      // Backspace clear of an already-empty box → step back.
      const next = value.slice(0, Math.max(0, idx));
      onChange(next);
      if (idx > 0) refs.current[idx - 1]?.focus();
      return;
    }
    // Support paste of the whole code into any single box.
    if (digits.length > 1) {
      const filled = digits.slice(0, length);
      onChange(filled);
      const focusIdx = Math.min(filled.length, length - 1);
      refs.current[focusIdx]?.focus();
      if (filled.length === length) onComplete?.(filled);
      return;
    }
    const arr = chars.slice();
    arr[idx] = digits;
    const next = arr.join('').slice(0, length);
    onChange(next);
    if (idx < length - 1) refs.current[idx + 1]?.focus();
    if (next.length === length) onComplete?.(next);
  };

  return (
    <View style={styles.row}>
      {chars.map((ch, i) => (
        <TextInput
          key={i}
          ref={(r) => {
            refs.current[i] = r;
          }}
          style={[styles.box, ch ? styles.boxFilled : null]}
          value={ch}
          keyboardType="number-pad"
          maxLength={length}
          onChangeText={(raw) => handleChange(i, raw)}
          onKeyPress={({ nativeEvent }) => {
            if (nativeEvent.key === 'Backspace' && !chars[i] && i > 0) {
              refs.current[i - 1]?.focus();
            }
          }}
          editable={!disabled}
          selectTextOnFocus
          textContentType="oneTimeCode"
          autoComplete="sms-otp"
        />
      ))}
    </View>
  );
}
