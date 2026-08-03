import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text } from 'react-native';
import { AiInsightCard } from '../../src/components/AiInsightCard';
import { Card, PrimaryButton, SectionTitle } from '../../src/components/ui';
import { saveAiReport } from '../../src/db/aiReportsRepo';
import { getProgressStats, getRecentSessions } from '../../src/db/sessionsRepo';
import { AI_FALLBACK_MESSAGE, getWeeklySummary } from '../../src/engine/aiCoachClient';
import { colors } from '../../src/theme';

export default function AiWeeklyScreen() {
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<any>(null);

  async function run() {
    setLoading(true);
    try {
      const [sessions, progress] = await Promise.all([getRecentSessions(30), getProgressStats()]);
      const result = await getWeeklySummary({ profile: { goal: '稳、松、清、暖、实' }, sessions, moduleProgress: progress });
      setReport(result);
      await saveAiReport({
        sourceType: 'training',
        sourceId: 'weekly',
        reportType: 'weekly-summary',
        summary: result.summary,
        findings: result,
        nextAdvice: result.nextWeekFocus,
        raw: result,
      });
    } catch {
      Alert.alert('AI 服务不可用', AI_FALLBACK_MESSAGE);
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <SectionTitle title="AI 周复盘" subtitle="移动端只发送训练摘要，不默认上传录音。" />
      <PrimaryButton label={loading ? '生成中...' : '生成复盘'} onPress={run} disabled={loading} />
      {report ? (
        <>
          <AiInsightCard title="本周训练概况" body={report.summary} />
          <AiInsightCard title="进步点" body={report.progress?.join('\n') ?? ''} />
          <AiInsightCard title="主要短板" body={report.weaknesses?.join('\n') ?? ''} />
          <AiInsightCard title="可能原因" body={report.likelyReasons?.join('\n') ?? ''} />
          <AiInsightCard title="下周重点" body={report.nextWeekFocus} />
          <AiInsightCard title="3 个具体建议" body={report.actionItems?.join('\n') ?? ''} />
          <AiInsightCard title="一句提醒" body={report.reminder} />
        </>
      ) : (
        <Card>
          <Text style={styles.body}>点击生成后，AI 会基于近 7 天 / 30 天训练摘要给出复盘。</Text>
        </Card>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, paddingBottom: 36 },
  body: { color: colors.muted, fontSize: 15, lineHeight: 22 },
});
