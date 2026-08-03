import { StyleSheet, View } from 'react-native';
import { colors } from '../theme';

export function VoiceCueAnimation() {
  return (
    <View style={styles.wrap}>
      <View style={[styles.bar, { height: 24 }]} />
      <View style={[styles.bar, { height: 44 }]} />
      <View style={[styles.bar, { height: 34 }]} />
      <View style={[styles.bar, { height: 52 }]} />
      <View style={[styles.bar, { height: 28 }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    height: 74,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginVertical: 8,
  },
  bar: {
    width: 10,
    borderRadius: 5,
    backgroundColor: colors.accent,
    opacity: 0.7,
  },
});
