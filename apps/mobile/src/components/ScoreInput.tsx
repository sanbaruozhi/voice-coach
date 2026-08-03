import { Text, View, StyleSheet } from 'react-native';
import { ScoreInputValues } from '../types';
import { Pill } from './ui';
import { colors } from '../theme';

const fields: Array<{ key: keyof ScoreInputValues; label: string }> = [
  { key: 'throatEase', label: '喉咙轻松度' },
  { key: 'voiceStability', label: '声音稳定度' },
  { key: 'resonanceForward', label: '共鸣靠前感' },
  { key: 'sentenceEnding', label: '句尾落住' },
  { key: 'naturalness', label: '自然度' },
  { key: 'difficulty', label: '难度' },
];

export function ScoreInput({
  value,
  onChange,
}: {
  value: ScoreInputValues;
  onChange: (next: ScoreInputValues) => void;
}) {
  return (
    <View>
      {fields.map((field) => (
        <View key={field.key} style={styles.row}>
          <Text style={styles.label}>{field.label}</Text>
          <View style={styles.options}>
            {[1, 2, 3, 4, 5].map((score) => (
              <Pill
                key={score}
                label={String(score)}
                active={value[field.key] === score}
                onPress={() => onChange({ ...value, [field.key]: score })}
              />
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    marginBottom: 10,
  },
  label: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 8,
  },
  options: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
});
