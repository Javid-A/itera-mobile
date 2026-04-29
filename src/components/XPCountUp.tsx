import { useEffect, useRef, useState } from 'react';
import { Text, TextStyle, StyleProp } from 'react-native';

interface Props {
  target: number;
  prefix?: string;
  suffix?: string;
  duration?: number;
  delay?: number;
  style?: StyleProp<TextStyle>;
  format?: (value: number) => string;
}

export default function XPCountUp({
  target,
  prefix = '',
  suffix = '',
  duration = 1100,
  delay = 0,
  style,
  format,
}: Props) {
  const [value, setValue] = useState(0);
  const targetRef = useRef(target);

  useEffect(() => {
    targetRef.current = target;
    let raf: number | null = null;
    let startTs: number | null = null;
    const from = 0;

    const timeout = setTimeout(() => {
      const tick = (ts: number) => {
        if (startTs === null) startTs = ts;
        const t = Math.min(1, (ts - startTs) / duration);
        const eased = 1 - Math.pow(1 - t, 3);
        setValue(Math.round(from + (targetRef.current - from) * eased));
        if (t < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }, delay);

    return () => {
      clearTimeout(timeout);
      if (raf !== null) cancelAnimationFrame(raf);
    };
  }, [target, duration, delay]);

  const display = format ? format(value) : value.toLocaleString();
  return <Text style={style}>{prefix}{display}{suffix}</Text>;
}
