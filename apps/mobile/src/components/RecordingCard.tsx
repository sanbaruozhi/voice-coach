import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ChevronRight, Mic } from 'lucide-react-native';
import { RecordingRow } from '../db/recordingsRepo';
import { formatDateTime, secondsToText } from '../utils/date';
import { Card } from './ui';
import { colors } from '../theme';

export function RecordingCard({ recording, onPress }: { recording: RecordingRow; onPress: () => void }) {
  return (
    <Pressable onPress={onPress}>
      <Card>
        <View style={styles.row}>
          <View style={styles.iconTile}>
            <Mic size={22} color={colors.accent} strokeWidth={2.3} />
          </View>
          <View style={styles.copy}>
            <Text style={styles.title}>{formatDateTime(recording.created_at)}</Text>
            <Text style={styles.meta}>{secondsToText(recording.duration_sec)}</Text>
          </View>
          <Text style={styles.badge}>{recording.ai_summary ? '已 AI 分析' : '本地录音'}</Text>
          <ChevronRight size={19} color={colors.subtle} strokeWidth={2.4} />
        </View>
        {recording.ai_summary ? <Text style={styles.summary}>{recording.ai_summary}</Text> : null}
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconTile: {
    width: 44,
    height: 44,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentSoft,
    marginRight: 12,
  },
  copy: {
    flex: 1,
    paddingRight: 10,
  },
  title: {
    color: colors.textStrong,
    fontSize: 16,
    fontWeight: '800',
  },
  meta: {
    color: colors.muted,
    marginTop: 3,
  },
  badge: {
    color: colors.accentDark,
    backgroundColor: colors.accentSoft,
    overflow: 'hidden',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
    fontSize: 12,
    fontWeight: '800',
    marginRight: 6,
  },
  summary: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 10,
  },
});
