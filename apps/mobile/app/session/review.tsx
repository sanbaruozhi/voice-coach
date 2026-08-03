import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput } from 'react-native';
import { ScoreInput } from '../../src/components/ScoreInput';
import { Card, PrimaryButton, SectionTitle } from '../../src/components/ui';
import { moduleById } from '../../src/data/trainingModules';
import { saveCompletedSession } from '../../src/db/sessionsRepo';
import { clearSessionDraft, readSessionDraft } from '../../src/state/sessionDraft';
import { ScoreInputValues, SessionDraft } from '../../src/types';
import { secondsToText } from '../../src/utils/date';
import { colors } from '../../src/theme';

const defaultScores: ScoreInputValues = {
  throatEase: 4,
  voiceStability: 3,
  resonanceForward: 3,
  sentenceEnding: 3,
  naturalness: 4,
  difficulty: 3,
};

export default function SessionReviewScreen() {
  const [draft, setDraft] = useState<SessionDraft | null>(null);
  const [scores, setScores] = useState(defaultScores);
  const [notes, setNotes] = useState('');
  const [throatAfter, setThroatAfter] = useState('normal');

  useEffect(() => {
    readSessionDraft().then(setDraft);
  }, []);

  const moduleNames = useMemo(
    () => draft?.recommendation.moduleIds.map((id) => moduleById[id]?.name).filter(Boolean).join('、') ?? '',
    [draft]
  );

  async function save() {
    if (!draft) return;
    await saveCompletedSession({ draft, scores, notes, throatAfter });
    await clearSessionDraft();
    Alert.alert('已保存', '这次训练已经记录。下次打开会继续根据记录推荐。', [
      { text: '用 AI 复盘本次训练', onPress: () => router.replace('/ai') },
      { text: '回首页', onPress: () => router.replace('/') },
    ]);
  }

  if (!draft) return null;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <SectionTitle title="训练后复盘" subtitle="只记录真实感受，不做打卡评价。" />
      <Card>
        <Text style={styles.title}>{draft.recommendation.sessionName}</Text>
        <Text style={styles.line}>目标：{draft.recommendation.focusGoal}</Text>
        <Text style={styles.line}>推荐理由：{draft.recommendation.recommendationReason}</Text>
        <Text style={styles.line}>实际时长：{secondsToText(draft.actualDurationSec ?? draft.availableMinutes * 60)}</Text>
        <Text style={styles.line}>包含模块：{moduleNames}</Text>
      </Card>

      <Card>
        <Text style={styles.label}>用户自评</Text>
        <ScoreInput value={scores} onChange={setScores} />
      </Card>

      <Card>
        <Text style={styles.label}>训练后嗓子状态</Text>
        <TextInput value={throatAfter} onChangeText={setThroatAfter} style={styles.input} placeholder="normal / tired / dry / better" />
        <Text style={styles.label}>备注</Text>
        <TextInput
          value={notes}
          onChangeText={setNotes}
          style={[styles.input, styles.notes]}
          placeholder="例如：句尾比之前稳一点，但共鸣还容易掉回喉咙。"
          multiline
        />
      </Card>

      <PrimaryButton label="保存复盘" onPress={save} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, paddingBottom: 36 },
  title: { color: colors.text, fontSize: 22, fontWeight: '900', marginBottom: 8 },
  line: { color: colors.muted, fontSize: 15, lineHeight: 22, marginTop: 5 },
  label: { color: colors.text, fontSize: 16, fontWeight: '800', marginBottom: 8, marginTop: 4 },
  input: {
    backgroundColor: colors.surfaceSoft,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    color: colors.text,
    marginBottom: 12,
  },
  notes: { minHeight: 96, textAlignVertical: 'top' },
});
