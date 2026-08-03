import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Card, MainScreen } from '../../src/components/ui';
import { ProgressSummary } from '../../src/components/ProgressSummary';
import { getProgressStats, getWeakCategories } from '../../src/db/sessionsRepo';
import { formatDateTime, secondsToText } from '../../src/utils/date';
import { colors } from '../../src/theme';

export default function ProgressScreen() {
  const [stats, setStats] = useState<any>(null);
  const [weak, setWeak] = useState<string[]>([]);

  useFocusEffect(
    useCallback(() => {
      getProgressStats().then(setStats);
      getWeakCategories().then(setWeak);
    }, [])
  );

  const most = stats?.categoryRows?.[0];

  return (
    <MainScreen active="progress">
      <View style={styles.header}>
        <Text style={styles.pageTitle}>进展</Text>
        <Text style={styles.subtitle}>只看恢复和趋势，不制造打卡压力。</Text>
      </View>
      <ProgressSummary
        items={[
          { label: '近 7 天', value: `${stats?.count7d ?? 0} 次` },
          { label: '近 30 天', value: `${stats?.count30d ?? 0} 次` },
          { label: '平均训练时长', value: secondsToText(stats?.avgDurationSec ?? 0) },
        ]}
      />

      <Card>
        <Text style={styles.title}>模块分布</Text>
        {stats?.categoryRows?.length ? (
          stats.categoryRows.map((row: any) => (
            <View key={row.category} style={styles.row}>
              <Text style={styles.rowLabel}>{row.category}</Text>
              <Text style={styles.rowValue}>
                {row.count} 次 / 平均 {Number(row.avgScore ?? 0).toFixed(1)}
              </Text>
            </View>
          ))
        ) : (
          <Text style={styles.body}>还没有足够记录。完成 2-3 次训练后，这里会更有参考价值。</Text>
        )}
      </Card>

      <Card>
        <Text style={styles.title}>训练判断</Text>
        <View style={styles.insightRow}>
          <Text style={styles.insightLabel}>最近最多</Text>
          <Text style={styles.insightValue}>{most ? `${most.category} · ${most.count} 次` : '暂无'}</Text>
        </View>
        <View style={styles.insightRow}>
          <Text style={styles.insightLabel}>薄弱模块</Text>
          <Text style={styles.insightValue}>{weak.length ? weak.join('、') : '暂不判断'}</Text>
        </View>
        <View style={styles.insightRow}>
          <Text style={styles.insightLabel}>最近一次</Text>
          <Text style={styles.insightValue}>{formatDateTime(stats?.lastSession?.started_at)}</Text>
        </View>
        <Text style={styles.body}>断训后不补课，只做恢复手感。建议优先放松、气息、轻哼，再回到短句。</Text>
      </Card>

      <Card>
        <Text style={styles.title}>本周建议</Text>
        <Text style={styles.body}>
          本周保持 2-4 次短训练即可。嗓子累时只做恢复包；状态正常时，每次只抓一个目标：气息、共鸣或句尾。
        </Text>
      </Card>
    </MainScreen>
  );
}

const styles = StyleSheet.create({
  header: {
    marginBottom: 14,
  },
  pageTitle: {
    color: colors.textStrong,
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '900',
  },
  subtitle: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 4,
    fontWeight: '700',
  },
  title: { color: colors.textStrong, fontSize: 18, fontWeight: '900', marginTop: 4, marginBottom: 8 },
  body: { color: colors.muted, fontSize: 15, lineHeight: 22, marginBottom: 6 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: colors.border },
  rowLabel: { color: colors.text, fontSize: 15, fontWeight: '700' },
  rowValue: { color: colors.muted, fontSize: 14 },
  insightRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  insightLabel: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: '800',
  },
  insightValue: {
    color: colors.textStrong,
    fontSize: 14,
    fontWeight: '900',
    marginLeft: 12,
    flex: 1,
    textAlign: 'right',
  },
});
