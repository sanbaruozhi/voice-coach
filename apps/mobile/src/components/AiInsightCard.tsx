import { StyleSheet, Text } from 'react-native';
import { Card } from './ui';
import { colors } from '../theme';

export function AiInsightCard({ title, body }: { title: string; body: string }) {
  return (
    <Card>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  title: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 8,
  },
  body: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
  },
});
