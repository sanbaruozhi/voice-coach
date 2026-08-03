import { createAudioPlayer } from 'expo-audio';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text } from 'react-native';
import { AiInsightCard } from '../../src/components/AiInsightCard';
import { Card, PrimaryButton, SectionTitle } from '../../src/components/ui';
import { deleteAiReport, getAiReport, saveAiReport } from '../../src/db/aiReportsRepo';
import { deleteRecording, getRecording, RecordingRow } from '../../src/db/recordingsRepo';
import { AI_FALLBACK_MESSAGE, analyzeRecording, transcribeRecording } from '../../src/engine/aiCoachClient';
import { formatDateTime, secondsToText } from '../../src/utils/date';
import { colors } from '../../src/theme';

export default function RecordingDetailScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const [recording, setRecording] = useState<RecordingRow | null>(null);
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    if (!params.id) return;
    const row = await getRecording(params.id);
    setRecording(row ?? null);
    const saved = await getAiReport('recording', params.id);
    setReport(saved ? JSON.parse(saved.raw_response_json) : null);
  }

  useEffect(() => {
    load();
  }, [params.id]);

  function play() {
    if (!recording) return;
    const player = createAudioPlayer(recording.file_uri);
    player.play();
  }

  function confirmAnalyze() {
    Alert.alert(
      '上传这一条录音？',
      '本次会上传这一条录音到 AI 服务端进行转写和分析。默认不会上传其他录音。',
      [
        { text: '取消', style: 'cancel' },
        { text: 'AI 分析', onPress: runAnalyze },
      ]
    );
  }

  async function runAnalyze() {
    if (!recording) return;
    setLoading(true);
    try {
      const transcribed = await transcribeRecording(recording.file_uri);
      const result = await analyzeRecording({
        transcript: transcribed.transcript,
        durationSec: transcribed.durationSec || recording.duration_sec,
        selfScores: {},
        focusGoal: '句尾落住',
        sessionType: '录音复盘',
      });
      const raw = { ...result, transcript: transcribed.transcript };
      await saveAiReport({
        sourceType: 'recording',
        sourceId: recording.id,
        reportType: 'recording-analysis',
        summary: result.summary,
        findings: result,
        nextAdvice: result.nextPractice?.focus ?? '',
        raw,
      });
      setReport(raw);
    } catch {
      Alert.alert('AI 服务不可用', AI_FALLBACK_MESSAGE);
    } finally {
      setLoading(false);
    }
  }

  async function removeReport() {
    if (!recording) return;
    await deleteAiReport('recording', recording.id);
    setReport(null);
  }

  async function removeRecording() {
    if (!recording) return;
    await deleteRecording(recording.id);
    router.replace('/recordings');
  }

  if (!recording) {
    return null;
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <SectionTitle title="录音详情" subtitle="这条录音仍在本机，AI 分析需要你主动确认。" />
      <Card>
        <Text style={styles.title}>{formatDateTime(recording.created_at)}</Text>
        <Text style={styles.body}>时长：{secondsToText(recording.duration_sec)}</Text>
        <Text style={styles.body}>关联训练：{recording.session_id ?? '未关联'}</Text>
        <PrimaryButton label="播放录音" onPress={play} />
        <PrimaryButton label={loading ? 'AI 分析中...' : 'AI 分析'} variant="secondary" onPress={confirmAnalyze} disabled={loading} />
      </Card>

      {report ? (
        <>
          <AiInsightCard title="AI 转写文本" body={report.transcript ?? '暂无'} />
          <AiInsightCard title="AI 反馈" body={report.summary ?? ''} />
          <AiInsightCard title="AI 发现的问题" body={report.issues?.join('\n') ?? ''} />
          <AiInsightCard title="AI 推荐的下一步训练" body={`${report.nextPractice?.focus ?? ''}\n${report.nextPractice?.recommendedSession ?? ''}\n${report.nextPractice?.reason ?? ''}`} />
          <AiInsightCard title="安全提醒" body={report.caution ?? 'AI 不做医学诊断。'} />
          <PrimaryButton label="删除 AI 报告" variant="danger" onPress={removeReport} />
        </>
      ) : (
        <Card>
          <Text style={styles.body}>还没有 AI 报告。你可以先播放确认，再点击 AI 分析。</Text>
        </Card>
      )}

      <PrimaryButton label="删除录音" variant="danger" onPress={removeRecording} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, paddingBottom: 36 },
  title: { color: colors.text, fontSize: 20, fontWeight: '900', marginBottom: 6 },
  body: { color: colors.muted, fontSize: 15, lineHeight: 22, marginBottom: 4 },
});
