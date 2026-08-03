import { Text, View, StyleSheet } from 'react-native';
import { TrainingModule } from '../types';
import { Card } from './ui';
import { colors } from '../theme';

export function TrainingStepCard({
  module,
  index,
  total,
}: {
  module: TrainingModule;
  index: number;
  total: number;
}) {
  return (
    <Card>
      <Text style={styles.step}>
        第 {index + 1} 步 / 共 {total} 步
      </Text>
      <Text style={styles.title}>{module.name}</Text>
      <Text style={styles.goal}>{module.goal}</Text>
      <Block title="具体做法" items={module.instruction} />
      <Block title="形象提示" items={[module.visualCue]} />
      <Block title="常见错误" items={module.commonMistakes} />
      <Block title="完成标准" items={module.successCriteria} />
      {module.exampleText?.length ? <Block title="练习短句" items={module.exampleText} /> : null}
    </Card>
  );
}

function Block({ title, items }: { title: string; items: string[] }) {
  return (
    <View style={styles.block}>
      <Text style={styles.blockTitle}>{title}</Text>
      {items.map((item) => (
        <Text key={item} style={styles.item}>
          {item}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  step: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '800',
  },
  title: {
    color: colors.textStrong,
    fontSize: 24,
    fontWeight: '900',
    marginTop: 8,
  },
  goal: {
    color: colors.accentDark,
    fontSize: 16,
    lineHeight: 23,
    marginTop: 8,
    marginBottom: 8,
  },
  block: {
    marginTop: 12,
  },
  blockTitle: {
    color: colors.textStrong,
    fontSize: 15,
    fontWeight: '900',
    marginBottom: 4,
  },
  item: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 3,
  },
});
