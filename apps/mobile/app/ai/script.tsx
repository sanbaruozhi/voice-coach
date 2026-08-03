import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AiInsightCard } from '../../src/components/AiInsightCard';
import { Card, Pill, PrimaryButton, SectionTitle } from '../../src/components/ui';
import { builtInScripts } from '../../src/data/scripts';
import { AI_FALLBACK_MESSAGE, generateScript } from '../../src/engine/aiCoachClient';
import { colors } from '../../src/theme';

const scenarios = ['向领导汇报', '会议补充发言', '提不同意见', '协调同事', '向群众解释', '电话沟通'];
const focuses = ['气息稳定', '共鸣靠前', '句尾落住', '成熟语气', '咬字清楚'];
const tones = ['稳重', '温和', '简洁', '有边界', '更有亲和力'];

export default function AiScriptScreen() {
  const [scenario, setScenario] = useState(scenarios[0]);
  const [focus, setFocus] = useState(focuses[2]);
  const [tone, setTone] = useState(tones[0]);
  const [loading, setLoading] = useState(false);
  const [scripts, setScripts] = useState<any[]>([]);

  async function run() {
    setLoading(true);
    try {
      const result = await generateScript({
        scenario,
        focus,
        tone,
        durationSec: 60,
        userContext: '35岁中国男性公务员，希望成熟、睿智、稳重',
      });
      setScripts(result.scripts);
    } catch {
      Alert.alert('AI 服务不可用', AI_FALLBACK_MESSAGE);
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <SectionTitle title="公务训练稿" subtitle="生成适合朗读和录音的短稿，每次只抓一个训练重点。" />
      <Select title="场景" options={scenarios} value={scenario} onChange={setScenario} />
      <Select title="训练重点" options={focuses} value={focus} onChange={setFocus} />
      <Select title="语气" options={tones} value={tone} onChange={setTone} />
      <PrimaryButton label={loading ? '生成中...' : '生成 3 段训练稿'} onPress={run} disabled={loading} />

      {scripts.map((item, index) => (
        <AiInsightCard key={`${item.title}-${index}`} title={item.title} body={`${item.text}\n\n练习提示：\n${item.practiceTips?.join('\n') ?? ''}`} />
      ))}

      <Card>
        <Text style={styles.title}>内置训练稿</Text>
        {builtInScripts.map((item) => (
          <Text key={item.id} style={styles.body}>
            {item.title}：{item.scenario}
          </Text>
        ))}
      </Card>
    </ScrollView>
  );
}

function Select({ title, options, value, onChange }: { title: string; options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <Card>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.wrap}>
        {options.map((item) => (
          <Pill key={item} label={item} active={item === value} onPress={() => onChange(item)} />
        ))}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, paddingBottom: 36 },
  title: { color: colors.text, fontSize: 16, fontWeight: '800', marginBottom: 8 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap' },
  body: { color: colors.muted, fontSize: 14, lineHeight: 20, marginTop: 4 },
});
