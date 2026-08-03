import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Card, Pill, PrimaryButton, SectionTitle } from '../../src/components/ui';
import {
  getAverageScores,
  getRecentModuleIds,
  getRecentSessions,
  getUserStage,
  getWeakCategories,
} from '../../src/db/sessionsRepo';
import { recommendSession } from '../../src/engine/recommendation';
import { saveSessionDraft } from '../../src/state/sessionDraft';
import { CurrentStatus, FocusPreference } from '../../src/types';
import { daysBetween, nowIso } from '../../src/utils/date';
import { createId } from '../../src/utils/ids';
import { colors } from '../../src/theme';

const minutesOptions = [3, 5, 10, 20] as const;
const statusOptions: Array<{ value: CurrentStatus; label: string }> = [
  { value: 'normal', label: '正常' },
  { value: 'tired', label: '嗓子累' },
  { value: 'silent', label: '不方便出声' },
  { value: 'preMeeting', label: '会议前' },
];
const focusOptions: Array<{ value: FocusPreference; label: string }> = [
  { value: 'appDecides', label: 'App 决定' },
  { value: 'breath', label: '气息' },
  { value: 'resonance', label: '共鸣' },
  { value: 'tone', label: '稳重语气' },
  { value: 'articulation', label: '咬字' },
  { value: 'review', label: '录音复盘' },
];

export default function SessionStartScreen() {
  const params = useLocalSearchParams<{ status?: CurrentStatus; minutes?: string }>();
  const [minutes, setMinutes] = useState<3 | 5 | 10 | 20>((Number(params.minutes) as 3 | 5 | 10 | 20) || 5);
  const [status, setStatus] = useState<CurrentStatus>(params.status ?? 'normal');
  const [focus, setFocus] = useState<FocusPreference>('appDecides');
  const [preview, setPreview] = useState<string>('选择状态后生成训练。');

  useEffect(() => {
    let alive = true;
    async function buildPreview() {
      const [recent, modules, averages, weak, stage] = await Promise.all([
        getRecentSessions(8),
        getRecentModuleIds(7),
        getAverageScores(),
        getWeakCategories(),
        getUserStage(),
      ]);
      const rec = recommendSession({
        availableMinutes: minutes,
        currentStatus: status,
        focusPreference: focus,
        daysSinceLastSession: daysBetween(recent[0]?.started_at),
        recentSessions: recent,
        recentModules: modules,
        averageScores: averages ?? {},
        weakCategories: weak,
        currentStage: stage,
      });
      if (alive) setPreview(`${rec.sessionName}：${rec.focusGoal}`);
    }
    buildPreview();
    return () => {
      alive = false;
    };
  }, [minutes, status, focus]);

  async function generate() {
    const [recent, modules, averages, weak, stage] = await Promise.all([
      getRecentSessions(8),
      getRecentModuleIds(7),
      getAverageScores(),
      getWeakCategories(),
      getUserStage(),
    ]);
    const recommendation = recommendSession({
      availableMinutes: minutes,
      currentStatus: status,
      focusPreference: focus,
      daysSinceLastSession: daysBetween(recent[0]?.started_at),
      recentSessions: recent,
      recentModules: modules,
      averageScores: averages ?? {},
      weakCategories: weak,
      currentStage: stage,
    });
    await saveSessionDraft({
      id: createId('session'),
      startedAt: nowIso(),
      recommendation,
      availableMinutes: minutes,
      currentStatus: status,
      focusPreference: focus,
    });
    router.push('/session/run');
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <SectionTitle title="生成本次训练" subtitle="告诉 App 你现在有多久、状态如何。安全规则会优先处理。" />

      <Card>
        <Text style={styles.label}>可用时间</Text>
        <View style={styles.wrap}>
          {minutesOptions.map((item) => (
            <Pill key={item} label={`${item} 分钟`} active={minutes === item} onPress={() => setMinutes(item)} />
          ))}
        </View>
      </Card>

      <Card>
        <Text style={styles.label}>当前状态</Text>
        <View style={styles.wrap}>
          {statusOptions.map((item) => (
            <Pill key={item.value} label={item.label} active={status === item.value} onPress={() => setStatus(item.value)} />
          ))}
        </View>
      </Card>

      <Card>
        <Text style={styles.label}>今日偏重</Text>
        <View style={styles.wrap}>
          {focusOptions.map((item) => (
            <Pill key={item.value} label={item.label} active={focus === item.value} onPress={() => setFocus(item.value)} />
          ))}
        </View>
      </Card>

      <Card>
        <Text style={styles.label}>预览</Text>
        <Text style={styles.preview}>{preview}</Text>
      </Card>

      <PrimaryButton label="生成本次训练" onPress={generate} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, paddingBottom: 36 },
  label: { color: colors.text, fontSize: 16, fontWeight: '800', marginBottom: 10 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap' },
  preview: { color: colors.accentDark, fontSize: 17, lineHeight: 24, fontWeight: '700' },
});
