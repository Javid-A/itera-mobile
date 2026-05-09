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

  // Mirror of the latest value, updated synchronously inside handleChange so
  // that rapid keystrokes which arrive before the parent re-renders don't read
  // stale state and overwrite each other.
  const valueRef = useRef(value);
  valueRef.current = value;

  useEffect(() => {
    if (autoFocus) {
      const t = setTimeout(() => refs.current[0]?.focus(), 80);
      return () => clearTimeout(t);
    }
  }, [autoFocus]);

  const chars = Array.from({ length }, (_, i) => value[i] ?? '');

  const commit = (next: string) => {
    valueRef.current = next;
    onChange(next);
  };

  const handleChange = (idx: number, raw: string) => {
    const digits = raw.replace(/\D/g, '');
    const cur = valueRef.current;
    const arr = Array.from({ length }, (_, i) => cur[i] ?? '');

    if (!digits) {
      // Clear ONLY this box; preserve any chars after it (don't slice tail).
      // arr.join('') compacts gaps so the parent's string stays gap-free.
      arr[idx] = '';
      const next = arr.join('');
      commit(next);
      if (idx > 0) refs.current[idx - 1]?.focus();
      return;
    }

    // Multi-digit input = paste/autofill. Replace the whole value.
    if (digits.length > 1) {
      const filled = digits.slice(0, length);
      commit(filled);
      const focusIdx = Math.min(filled.length, length - 1);
      refs.current[focusIdx]?.focus();
      if (filled.length === length) onComplete?.(filled);
      return;
    }

    arr[idx] = digits;
    const next = arr.join('').slice(0, length);
    commit(next);
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
            // iOS-only safety: backspace on an already-empty box doesn't fire
            // onChangeText, so step focus back manually.
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
