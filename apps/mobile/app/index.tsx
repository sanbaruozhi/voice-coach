import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import {
  AudioWaveform,
  Briefcase,
  CalendarDays,
  CheckCircle2,
  CircleHelp,
  CirclePlay,
  ClipboardList,
  Clock,
  FileText,
  Frown,
  Lightbulb,
  SlidersHorizontal,
  Target,
} from 'lucide-react-native';
import { ActionRow, Card, IconButton, MainScreen, PrimaryButton, SectionTitle } from '../src/components/ui';
import { ProgressSummary } from '../src/components/ProgressSummary';
import {
  getAverageScores,
  getProgressStats,
  getRecentModuleIds,
  getRecentSessions,
  getUserStage,
  getWeakCategories,
} from '../src/db/sessionsRepo';
import { getDefaultRecommendation, recommendSession } from '../src/engine/recommendation';
import { saveSessionDraft } from '../src/state/sessionDraft';
import { AverageScores, CurrentStatus, RecommendationResult, TrainingCategory, TrainingSession } from '../src/types';
import { daysBetween, formatDateTime, formatRelativeDays, secondsToText } from '../src/utils/date';
import { createId } from '../src/utils/ids';
import { nowIso } from '../src/utils/date';
import { colors } from '../src/theme';

type RecommendationContext = {
  recent: TrainingSession[];
  modules: string[];
  averages: AverageScores;
  weak: TrainingCategory[];
  stage: 1 | 2 | 3 | 4;
  progress: any;
  days: number | null;
};

const minutesOptions = [3, 5, 10, 20] as const;

const quickStatusOptions: Array<{
  value: CurrentStatus;
  label: string;
  caption: string;
  icon: 'normal' | 'tired' | 'meeting';
}> = [
  { value: 'normal', label: '正常', caption: '常规训练', icon: 'normal' },
  { value: 'tired', label: '嗓子累', caption: '先恢复', icon: 'tired' },
  { value: 'preMeeting', label: '会议前', caption: '快热身', icon: 'meeting' },
];

const categoryLabels: Record<TrainingCategory, string> = {
  relax: '放松',
  breath: '气息',
  sovt: '轻哼',
  resonance: '共鸣',
  articulation: '咬字',
  tone: '语气',
  scenario: '场景',
};

async function readRecommendationContext(): Promise<RecommendationContext> {
  const [recent, modules, averages, weak, stage, progress] = await Promise.all([
    getRecentSessions(8),
    getRecentModuleIds(7),
    getAverageScores(),
    getWeakCategories(),
    getUserStage(),
    getProgressStats(),
  ]);
  return {
    recent,
    modules,
    averages: averages ?? {},
    weak,
    stage,
    progress,
    days: daysBetween(recent[0]?.started_at),
  };
}

function buildRecommendation(context: RecommendationContext, minutes: 3 | 5 | 10 | 20, status: CurrentStatus) {
  return recommendSession({
    availableMinutes: minutes,
    currentStatus: status,
    focusPreference: 'appDecides',
    daysSinceLastSession: context.days,
    recentSessions: context.recent,
    recentModules: context.modules,
    averageScores: context.averages,
    weakCategories: context.weak,
    currentStage: context.stage,
  });
}

export default function HomeScreen() {
  const [recommendation, setRecommendation] = useState<RecommendationResult>(getDefaultRecommendation());
  const [context, setContext] = useState<RecommendationContext | null>(null);
  const [minutes, setMinutes] = useState<3 | 5 | 10 | 20>(5);
  const [status, setStatus] = useState<CurrentStatus>('normal');
  const [stats, setStats] = useState<any>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const next = await readRecommendationContext();
    setContext(next);
    setStats(next.progress);
    setDistance(next.days);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (context) setRecommendation(buildRecommendation(context, minutes, status));
  }, [context, minutes, status]);

  async function startRecommended() {
    const activeContext = context ?? (await readRecommendationContext());
    const activeRecommendation = buildRecommendation(activeContext, minutes, status);
    await saveSessionDraft({
      id: createId('session'),
      startedAt: nowIso(),
      recommendation: activeRecommendation,
      availableMinutes: minutes,
      currentStatus: status,
      focusPreference: 'appDecides',
    });
    router.push('/session/run');
  }

  async function refresh() {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }

  const weakText = context?.weak.length
    ? context.weak.map((item) => categoryLabels[item]).join('、')
    : '暂不判断';

  return (
    <MainScreen
      active="home"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.accent} />}
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.brand}>稳声 Coach</Text>
          <Text style={styles.tagline}>清、稳、准、暖、留</Text>
        </View>
        <IconButton
          label="完整选择"
          onPress={() => router.push('/session/start')}
          icon={<SlidersHorizontal size={23} color={colors.textStrong} strokeWidth={2.35} />}
        />
      </View>

      <Card style={styles.recommendCard}>
        <View style={styles.recommendTop}>
          <View style={styles.waveTile}>
            <AudioWaveform size={42} color={colors.accent} strokeWidth={2.4} />
          </View>
          <View style={styles.recommendText}>
            <Text style={styles.kicker}>为你推荐的训练包</Text>
            <Text style={styles.title}>{recommendation.sessionName}</Text>
            <View style={styles.metaRow}>
              <Clock size={16} color={colors.muted} strokeWidth={2.2} />
              <Text style={styles.metaText}>{minutes} 分钟</Text>
              <View style={styles.statusBadge}>
                <Text style={styles.statusBadgeText}>本地推荐</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.goalBlock}>
          <View style={styles.goalHeader}>
            <Target size={17} color={colors.muted} strokeWidth={2.3} />
            <Text style={styles.goalLabel}>本次唯一目标</Text>
          </View>
          <Text style={styles.goal}>{recommendation.focusGoal}</Text>
        </View>

        <View style={styles.reasonBlock}>
          <Lightbulb size={17} color={colors.muted} strokeWidth={2.2} />
          <Text style={styles.reason}>{recommendation.recommendationReason}</Text>
        </View>
        {recommendation.safetyNotice ? <Text style={styles.notice}>{recommendation.safetyNotice}</Text> : null}
        <PrimaryButton
          label="开始训练"
          onPress={startRecommended}
          icon={<CirclePlay size={21} color="#FFFFFF" strokeWidth={2.5} />}
        />
      </Card>

      <Card>
        <View style={styles.cardHeaderRow}>
          <Text style={styles.cardTitle}>快速开始</Text>
          <Pressable onPress={() => router.push('/session/start')} style={styles.helpLink}>
            <CircleHelp size={16} color={colors.muted} strokeWidth={2.2} />
            <Text style={styles.helpText}>更多选择</Text>
          </Pressable>
        </View>

        <Text style={styles.controlLabel}>选择时长</Text>
        <View style={styles.segmentRow}>
          {minutesOptions.map((item) => (
            <Pressable
              key={item}
              onPress={() => setMinutes(item)}
              style={({ pressed }) => [
                styles.segmentItem,
                minutes === item && styles.segmentItemActive,
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.segmentText, minutes === item && styles.segmentTextActive]}>{item} 分钟</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.controlLabel}>当前状态</Text>
        <View style={styles.statusGrid}>
          {quickStatusOptions.map((item) => {
            const selected = status === item.value;
            return (
              <Pressable
                key={item.value}
                onPress={() => setStatus(item.value)}
                style={({ pressed }) => [styles.statusOption, selected && styles.statusOptionActive, pressed && styles.pressed]}
              >
                {item.icon === 'normal' ? <CheckCircle2 size={21} color={selected ? colors.success : colors.subtle} /> : null}
                {item.icon === 'tired' ? <Frown size={21} color={selected ? colors.warm : colors.subtle} /> : null}
                {item.icon === 'meeting' ? <Briefcase size={21} color={selected ? colors.accent : colors.subtle} /> : null}
                <Text style={[styles.statusText, selected && styles.statusTextActive]}>{item.label}</Text>
                <Text style={styles.statusCaption}>{item.caption}</Text>
              </Pressable>
            );
          })}
        </View>
      </Card>

      <Card>
        <Text style={styles.cardTitle}>更多工具</Text>
        <ActionRow
          title="AI 周复盘"
          subtitle="回顾本周训练与表现"
          tone="blue"
          icon={<ClipboardList size={23} color={colors.accent} strokeWidth={2.3} />}
          onPress={() => router.push('/ai/weekly')}
        />
        <ActionRow
          title="公务训练稿"
          subtitle="生成更贴近工作场景的短稿"
          tone="green"
          icon={<FileText size={23} color={colors.success} strokeWidth={2.3} />}
          onPress={() => router.push('/ai/script')}
        />
      </Card>

      <SectionTitle title="本周与本月进展" subtitle="看趋势就够，不做打卡压力。" />
      <ProgressSummary
        items={[
          { label: '本周', value: `${stats?.count7d ?? 0} 次` },
          { label: '近 30 天', value: `${stats?.count30d ?? 0} 次` },
          { label: '平均时长', value: secondsToText(stats?.avgDurationSec ?? 0) },
        ]}
      />

      <Card>
        <View style={styles.cardHeaderRow}>
          <Text style={styles.cardTitle}>近期薄弱模块</Text>
          <Text style={styles.inlineMeta}>{formatRelativeDays(distance)}</Text>
        </View>
        <Text style={styles.weakValue}>{weakText}</Text>
        <Text style={styles.reason}>
          {stats?.lastSession
            ? `上次训练：${stats.lastSession.session_type}，${formatDateTime(stats.lastSession.started_at)}。`
            : '还没有训练记录。今天先从 5 分钟低压力训练开始。'}
        </Text>
      </Card>
    </MainScreen>
  );
}

const styles = StyleSheet.create({
  header: {
    minHeight: 74,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  brand: {
    color: colors.textStrong,
    fontSize: 33,
    lineHeight: 39,
    fontWeight: '900',
    letterSpacing: 0,
  },
  tagline: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 19,
    marginTop: 3,
    fontWeight: '700',
  },
  recommendCard: {
    padding: 18,
  },
  recommendTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  waveTile: {
    width: 86,
    height: 86,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentSoft,
    marginRight: 14,
  },
  recommendText: {
    flex: 1,
  },
  kicker: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: '700',
  },
  title: {
    color: colors.textStrong,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '900',
    marginTop: 5,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
  metaText: {
    color: colors.muted,
    fontSize: 14,
    marginLeft: 5,
    fontWeight: '700',
  },
  statusBadge: {
    backgroundColor: colors.successSoft,
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 4,
    marginLeft: 10,
  },
  statusBadgeText: {
    color: colors.success,
    fontSize: 12,
    fontWeight: '800',
  },
  goalBlock: {
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
    marginTop: 16,
    paddingVertical: 14,
  },
  goalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  goalLabel: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: '800',
    marginLeft: 6,
  },
  goal: {
    color: colors.textStrong,
    fontSize: 22,
    lineHeight: 29,
    fontWeight: '900',
    marginTop: 7,
  },
  reasonBlock: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 14,
  },
  reason: {
    flex: 1,
    color: colors.muted,
    fontSize: 15,
    lineHeight: 23,
    marginLeft: 8,
  },
  notice: {
    color: colors.warm,
    backgroundColor: colors.warmSoft,
    borderRadius: 8,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 12,
    padding: 10,
    fontWeight: '700',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  cardTitle: {
    color: colors.textStrong,
    fontSize: 19,
    fontWeight: '900',
  },
  helpLink: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  helpText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '700',
    marginLeft: 4,
  },
  controlLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 9,
  },
  segmentRow: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.surfaceMuted,
    overflow: 'hidden',
    marginBottom: 16,
  },
  segmentItem: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: 1,
    borderRightColor: colors.border,
  },
  segmentItemActive: {
    backgroundColor: colors.accent,
    borderRightColor: colors.accent,
  },
  segmentText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  segmentTextActive: {
    color: '#FFFFFF',
  },
  statusGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  statusOption: {
    flex: 1,
    minHeight: 76,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 4,
  },
  statusOptionActive: {
    backgroundColor: '#F8FBFF',
    borderColor: colors.accent,
  },
  statusText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '900',
    marginTop: 5,
  },
  statusTextActive: {
    color: colors.textStrong,
  },
  statusCaption: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  weakValue: {
    color: colors.textStrong,
    fontSize: 22,
    lineHeight: 29,
    fontWeight: '900',
    marginBottom: 4,
  },
  inlineMeta: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.82,
  },
});
