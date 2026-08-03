import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text } from 'react-native';
import { TrainingStepCard } from '../../src/components/TrainingStepCard';
import { TimerCircle } from '../../src/components/TimerCircle';
import { Card, PrimaryButton } from '../../src/components/ui';
import { moduleById } from '../../src/data/trainingModules';
import { readSessionDraft, updateSessionDraft } from '../../src/state/sessionDraft';
import { SessionDraft } from '../../src/types';
import { colors } from '../../src/theme';

export default function SessionRunScreen() {
  const [draft, setDraft] = useState<SessionDraft | null>(null);
  const [index, setIndex] = useState(0);
  const [running, setRunning] = useState(false);
  const [startedAt] = useState(Date.now());

  useEffect(() => {
    readSessionDraft().then((value) => {
      if (!value) {
        Alert.alert('没有训练计划', '请先生成本次训练。', [{ text: '返回', onPress: () => router.replace('/session/start') }]);
      }
      setDraft(value);
    });
  }, []);

  const modules = useMemo(
    () => draft?.recommendation.moduleIds.map((id) => moduleById[id]).filter(Boolean) ?? [],
    [draft]
  );
  const current = modules[index];

  async function next() {
    await Haptics.selectionAsync().catch(() => undefined);
    if (index < modules.length - 1) {
      setIndex(index + 1);
      setRunning(false);
      return;
    }
    await updateSessionDraft({ actualDurationSec: Math.floor((Date.now() - startedAt) / 1000) });
    router.replace('/session/review');
  }

  if (!draft || !current) {
    return null;
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Card>
        <Text style={styles.sessionName}>{draft.recommendation.sessionName}</Text>
        <Text style={styles.reason}>{draft.recommendation.recommendationReason}</Text>
      </Card>
      <TrainingStepCard module={current} index={index} total={modules.length} />
      <TimerCircle durationSec={current.durationSec} running={running} onDone={() => setRunning(false)} />
      <PrimaryButton label={running ? '暂停倒计时' : '开始倒计时'} onPress={() => setRunning((value) => !value)} />
      <PrimaryButton
        label={current.demoAudioUri ? '播放示范' : '示范音频待补充'}
        variant="secondary"
        onPress={() => {
          if (!current.demoAudioUri) Alert.alert('示范音频待补充', '第一版先按文字提示练习。');
        }}
      />
      <PrimaryButton label={index < modules.length - 1 ? '下一步' : '完成训练'} onPress={next} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, paddingBottom: 36 },
  sessionName: { color: colors.text, fontSize: 21, fontWeight: '900' },
  reason: { color: colors.muted, fontSize: 15, lineHeight: 22, marginTop: 8 },
});
