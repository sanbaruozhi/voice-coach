import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';

export function TimerCircle({
  durationSec,
  running,
  onDone,
}: {
  durationSec: number;
  running: boolean;
  onDone?: () => void;
}) {
  const [remaining, setRemaining] = useState(durationSec);

  useEffect(() => {
    setRemaining(durationSec);
  }, [durationSec]);

  useEffect(() => {
    if (!running || remaining <= 0) return;
    const timer = setInterval(() => {
      setRemaining((value) => {
        if (value <= 1) {
          clearInterval(timer);
          onDone?.();
          return 0;
        }
        return value - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [running, remaining, onDone]);

  const label = useMemo(() => {
    const min = Math.floor(remaining / 60);
    const sec = remaining % 60;
    return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  }, [remaining]);

  return (
    <View style={styles.wrap}>
      <Text style={styles.time}>{label}</Text>
      <Text style={styles.caption}>本步倒计时</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: 150,
    height: 150,
    borderRadius: 75,
    borderWidth: 9,
    borderColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginVertical: 14,
    backgroundColor: '#FFFFFF',
    shadowColor: '#0A2A5E',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },
  time: {
    color: colors.textStrong,
    fontSize: 33,
    fontWeight: '900',
  },
  caption: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
});
