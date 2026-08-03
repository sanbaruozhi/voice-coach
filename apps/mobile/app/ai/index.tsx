import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { Card, PrimaryButton, SectionTitle } from '../../src/components/ui';
import { colors } from '../../src/theme';

export default function AiHomeScreen() {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <SectionTitle title="AI 辅助复盘" subtitle="AI 只做辅助复盘和个性化建议。训练安全边界仍由本地规则控制。" />
      <Card>
        <Text style={styles.title}>可以做什么</Text>
        <Text style={styles.body}>生成本周声音训练复盘、生成个性化公务训练稿、分析最近一次录音、根据训练记录生成下周计划。</Text>
      </Card>
      <PrimaryButton label="生成本周声音训练复盘" onPress={() => router.push('/ai/weekly')} />
      <PrimaryButton label="生成个性化公务训练稿" variant="secondary" onPress={() => router.push('/ai/script')} />
      <PrimaryButton label="分析最近一次录音" variant="secondary" onPress={() => router.push('/recordings')} />
      <PrimaryButton label="根据最近训练生成下周计划" variant="secondary" onPress={() => router.push('/ai/weekly')} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, paddingBottom: 36 },
  title: { color: colors.text, fontSize: 18, fontWeight: '800', marginBottom: 8 },
  body: { color: colors.muted, fontSize: 15, lineHeight: 22 },
});
