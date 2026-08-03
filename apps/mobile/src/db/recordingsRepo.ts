import * as FileSystem from 'expo-file-system/legacy';
import { clearTables, getDb } from './database';
import { createId } from '../utils/ids';
import { nowIso } from '../utils/date';

export type RecordingRow = {
  id: string;
  session_id?: string | null;
  file_uri: string;
  script_id?: string | null;
  duration_sec: number;
  created_at: string;
  ai_summary?: string | null;
};

export async function addRecording(input: { fileUri: string; durationSec: number; sessionId?: string | null; scriptId?: string | null }) {
  const db = await getDb();
  const id = createId('rec');
  await db.runAsync(
    'INSERT INTO recordings (id, session_id, file_uri, script_id, duration_sec, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    id,
    input.sessionId ?? null,
    input.fileUri,
    input.scriptId ?? null,
    input.durationSec,
    nowIso()
  );
  return id;
}

export async function getRecordings() {
  const db = await getDb();
  return db.getAllAsync<RecordingRow>(
    `SELECT r.*, ar.summary as ai_summary
     FROM recordings r
     LEFT JOIN ai_reports ar ON ar.source_id = r.id AND ar.source_type = 'recording'
     ORDER BY r.created_at DESC`
  );
}

export async function getRecording(id: string) {
  const db = await getDb();
  return db.getFirstAsync<RecordingRow>('SELECT * FROM recordings WHERE id = ?', id);
}

export async function deleteRecording(id: string) {
  const db = await getDb();
  const row = await getRecording(id);
  if (row?.file_uri) {
    await FileSystem.deleteAsync(row.file_uri, { idempotent: true }).catch(() => undefined);
  }
  await db.runAsync('DELETE FROM ai_reports WHERE source_type = ? AND source_id = ?', 'recording', id);
  await db.runAsync('DELETE FROM recordings WHERE id = ?', id);
}

export async function clearRecordings() {
  const rows = await getRecordings();
  for (const row of rows) {
    await FileSystem.deleteAsync(row.file_uri, { idempotent: true }).catch(() => undefined);
  }
  await clearTables(['recordings']);
}
