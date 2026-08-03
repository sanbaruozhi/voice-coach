import { useAudioRecorder, useAudioRecorderState, RecordingPresets, requestRecordingPermissionsAsync } from 'expo-audio';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { Mic } from 'lucide-react-native';
import { RecordingCard } from '../../src/components/RecordingCard';
import { Card, MainScreen, PrimaryButton } from '../../src/components/ui';
import { persistRecording } from '../../src/audio/recorder';
import { addRecording, getRecordings, RecordingRow } from '../../src/db/recordingsRepo';
import { secondsToText } from '../../src/utils/date';
import { colors } from '../../src/theme';

export default function RecordingsScreen() {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder);
  const [recordings, setRecordings] = useState<RecordingRow[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    getRecordings().then(setRecordings);
  }, []);

  useFocusEffect(load);

  async function start() {
    const permission = await requestRecordingPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('需要麦克风权限', '录音默认只保存在本机。');
      return;
    }
    await recorder.prepareToRecordAsync();
    recorder.record();
  }

  async function stop() {
    setBusy(true);
    try {
      await recorder.stop();
      const uri = recorder.uri;
      if (!uri) throw new Error('no uri');
      const persisted = await persistRecording(uri);
      await addRecording({
        fileUri: persisted,
        durationSec: Math.max(1, Math.round((recorderState.durationMillis ?? 0) / 1000)),
      });
      load();
    } catch {
      Alert.alert('录音保存失败', '请重新录一次。');
    } finally {
      setBusy(false);
    }
  }

  return (
    <MainScreen active="recordings">
      <View style={styles.header}>
        <Text style={styles.title}>录音复盘</Text>
        <Text style={styles.subtitle}>默认只在本机保存。AI 分析前会再次确认。</Text>
      </View>

      <Card style={styles.recordCard}>
        <View style={styles.recordRow}>
          <View>
            <Text style={styles.recordTitle}>{recorderState.isRecording ? '正在录音' : '准备录音'}</Text>
            <Text style={styles.body}>{secondsToText(Math.round((recorderState.durationMillis ?? 0) / 1000))}</Text>
          </View>
          <View style={[styles.micTile, recorderState.isRecording && styles.micTileActive]}>
            <Mic size={30} color={recorderState.isRecording ? '#FFFFFF' : colors.accent} strokeWidth={2.3} />
          </View>
        </View>
        {recorderState.isRecording ? (
          <PrimaryButton label={busy ? '保存中...' : '停止录音'} onPress={stop} disabled={busy} />
        ) : (
          <PrimaryButton label="开始录音" onPress={start} />
        )}
      </Card>

      <Text style={styles.sectionHeading}>最近录音</Text>
      {recordings.map((item) => (
        <RecordingCard key={item.id} recording={item} onPress={() => router.push(`/recordings/detail?id=${item.id}`)} />
      ))}

      {!recordings.length ? (
        <Card>
          <Text style={styles.body}>还没有录音。建议先录 45-90 秒固定训练稿，再做 AI 分析。</Text>
        </Card>
      ) : null}
    </MainScreen>
  );
}

const styles = StyleSheet.create({
  header: {
    marginBottom: 14,
  },
  title: {
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
  recordCard: {
    padding: 18,
  },
  recordRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  recordTitle: { color: colors.textStrong, fontSize: 22, fontWeight: '900' },
  body: { color: colors.muted, fontSize: 15, lineHeight: 22, marginTop: 6 },
  micTile: {
    width: 62,
    height: 62,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentSoft,
  },
  micTileActive: {
    backgroundColor: colors.danger,
  },
  sectionHeading: {
    color: colors.textStrong,
    fontSize: 20,
    fontWeight: '900',
    marginTop: 8,
    marginBottom: 10,
  },
});
