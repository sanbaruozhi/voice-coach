import * as SQLite from 'expo-sqlite';
import { schemaSql } from './schema';
import { nowIso } from '../utils/date';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export function getDb() {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync('voice-coach.db');
  }
  return dbPromise;
}

export async function initDatabase() {
  const db = await getDb();
  await db.execAsync(schemaSql);
  const existing = await db.getFirstAsync<{ id: string }>('SELECT id FROM users LIMIT 1');
  if (!existing) {
    const now = nowIso();
    await db.runAsync(
      'INSERT INTO users (id, current_stage, main_goal, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
      'local-user',
      1,
      '稳、松、清、暖、实',
      now,
      now
    );
  }
}

export async function clearTables(tables: string[]) {
  const db = await getDb();
  for (const table of tables) {
    await db.runAsync(`DELETE FROM ${table}`);
  }
}
