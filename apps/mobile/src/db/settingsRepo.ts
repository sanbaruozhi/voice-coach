import { getDb } from './database';

export const AI_BASE_URL_KEY = 'ai_service_base_url';

export async function readSetting(key: string) {
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM app_settings WHERE key = ?', key);
  return row?.value ?? null;
}

export async function writeSetting(key: string, value: string) {
  const db = await getDb();
  await db.runAsync(
    'INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    key,
    value
  );
}

export async function readAiServiceBaseUrl() {
  return (await readSetting(AI_BASE_URL_KEY)) ?? 'http://localhost:8787';
}

export async function readConfiguredAiServiceBaseUrl() {
  return readSetting(AI_BASE_URL_KEY);
}

export async function setAiServiceBaseUrl(value: string) {
  await writeSetting(AI_BASE_URL_KEY, value.trim().replace(/\/$/, ''));
}
