import { useEffect, useState } from 'react';
import { Alert, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { Card, MainScreen, PrimaryButton } from '../../src/components/ui';
import { clearAiReports } from '../../src/db/aiReportsRepo';
import { clearRecordings } from '../../src/db/recordingsRepo';
import { clearTrainingRecords, exportTrainingJson } from '../../src/db/sessionsRepo';
import { checkAiServiceHealth, readAiServiceBaseUrl, setAiServiceBaseUrl } from '../../src/engine/aiCoachClient';
import { privacyBullets } from '../../src/utils/privacy';
import { colors } from '../../src/theme';

export default function SettingsScreen() {
  const [baseUrl, setBaseUrl] = useState('http://localhost:8787');
  const [status, setStatus] = useState('');

  useEffect(() => {
    readAiServiceBaseUrl().then(setBaseUrl);
  }, []);

  async function saveUrl() {
    await setAiServiceBaseUrl(baseUrl);
    Alert.alert('已保存', 'AI 服务端地址已更新。');
  }

  async function testHealth() {
    try {
      const result = await checkAiServiceHealth();
      setStatus(`${result.service} / ${result.provider ?? ''} / ${result.textModel ?? ''}`);
    } catch {
      setStatus('AI 服务暂时不可用，本地训练推荐仍可正常使用。');
    }
  }

  async function exportJson() {
    const json = await exportTrainingJson();
    await Share.share({ message: json });
  }

  function confirmDanger(title: string, message: string, action: () => Promise<void>) {
    Alert.alert(title, message, [
      { text: '取消', style: 'cancel' },
      {
        text: '确认删除',
        style: 'destructive',
        onPress: () => action().then(() => Alert.alert('已删除')),
      },
    ]);
  }

  return (
    <MainScreen active="settings">
      <View style={styles.header}>
        <Text style={styles.pageTitle}>设置</Text>
        <Text style={styles.subtitle}>本地优先，AI 只在你主动调用时使用。</Text>
      </View>

      <Card>
        <Text style={styles.label}>AI 服务端地址</Text>
        <TextInput value={baseUrl} onChangeText={setBaseUrl} style={styles.input} autoCapitalize="none" />
        <PrimaryButton label="保存地址" onPress={saveUrl} />
        <PrimaryButton label="测试 AI 服务端连接" variant="secondary" onPress={testHealth} />
        {status ? <Text style={styles.status}>{status}</Text> : null}
      </Card>

      <Card>
        <Text style={styles.label}>隐私说明</Text>
        {privacyBullets.map((item) => (
          <Text key={item} style={styles.body}>
            {item}
          </Text>
        ))}
      </Card>

      <Card>
        <Text style={styles.label}>数据管理</Text>
        <PrimaryButton label="导出训练记录 JSON" variant="secondary" onPress={exportJson} />
        <PrimaryButton
          label="删除全部训练记录"
          variant="danger"
          onPress={() => confirmDanger('删除全部训练记录？', '这个操作不会删除录音，但训练历史会被清空。', clearTrainingRecords)}
        />
        <PrimaryButton
          label="删除全部录音"
          variant="danger"
          onPress={() => confirmDanger('删除全部录音？', '本机保存的录音文件会被清空。', clearRecordings)}
        />
        <PrimaryButton
          label="删除全部 AI 报告"
          variant="danger"
          onPress={() => confirmDanger('删除全部 AI 报告？', '已生成的 AI 分析和复盘会被清空。', clearAiReports)}
        />
      </Card>

      <Card>
        <Text style={styles.label}>App 版本</Text>
        <Text style={styles.body}>稳声 Coach MVP 0.1.0</Text>
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
  label: { color: colors.textStrong, fontSize: 16, fontWeight: '900', marginBottom: 8 },
  input: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    color: colors.text,
    marginBottom: 10,
  },
  status: { color: colors.muted, fontSize: 14, lineHeight: 20, marginTop: 8 },
  body: { color: colors.muted, fontSize: 15, lineHeight: 22, marginBottom: 4 },
});
