import { moduleById } from '../data/trainingModules';
import { TrainingCategory, TrainingSession } from '../types';
import { nowIso } from '../utils/date';

type Store = {
  users: Array<Record<string, any>>;
  training_sessions: Array<Record<string, any>>;
  session_modules: Array<Record<string, any>>;
  session_scores: Array<Record<string, any>>;
  recordings: Array<Record<string, any>>;
  module_progress: Array<Record<string, any>>;
  ai_reports: Array<Record<string, any>>;
  app_settings: Array<Record<string, any>>;
};

const STORE_KEY = 'voice-coach-web-db';

const emptyStore = (): Store => ({
  users: [],
  training_sessions: [],
  session_modules: [],
  session_scores: [],
  recordings: [],
  module_progress: [],
  ai_reports: [],
  app_settings: [],
});

function readStore(): Store {
  if (typeof window === 'undefined') return emptyStore();
  const raw = window.localStorage.getItem(STORE_KEY);
  if (!raw) return emptyStore();
  return { ...emptyStore(), ...JSON.parse(raw) };
}

function writeStore(store: Store) {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(STORE_KEY, JSON.stringify(store));
  }
}

function sortByStartedAtDesc<T extends { started_at?: string }>(rows: T[]) {
  return [...rows].sort((a, b) => String(b.started_at ?? '').localeCompare(String(a.started_at ?? '')));
}

function sortByCreatedAtDesc<T extends { created_at?: string }>(rows: T[]) {
  return [...rows].sort((a, b) => String(b.created_at ?? '').localeCompare(String(a.created_at ?? '')));
}

function average(values: number[]) {
  const valid = values.filter((value) => Number.isFinite(value));
  if (!valid.length) return null;
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

function recentCutoff(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
}

function upsertSetting(store: Store, key: string, value: string) {
  const existing = store.app_settings.find((item) => item.key === key);
  if (existing) existing.value = value;
  else store.app_settings.push({ key, value });
}

const db = {
  async execAsync() {},

  async runAsync(sql: string, ...params: any[]) {
    const store = readStore();
    const normalized = sql.replace(/\s+/g, ' ').trim().toLowerCase();

    if (normalized.startsWith('insert into users')) {
      store.users.push({
        id: params[0],
        current_stage: params[1],
        main_goal: params[2],
        created_at: params[3],
        updated_at: params[4],
      });
    } else if (normalized.startsWith('insert into app_settings')) {
      upsertSetting(store, params[0], params[1]);
    } else if (normalized.startsWith('insert into training_sessions')) {
      store.training_sessions.push({
        id: params[0],
        started_at: params[1],
        completed_at: params[2],
        planned_duration_min: params[3],
        actual_duration_sec: params[4],
        session_type: params[5],
        completed: params[6],
        throat_status_before: params[7],
        throat_status_after: params[8],
        recommendation_reason: params[9],
        focus_goal: params[10],
        notes: params[11],
      });
    } else if (normalized.startsWith('insert into session_modules')) {
      store.session_modules.push({
        id: params[0],
        session_id: params[1],
        module_id: params[2],
        order_index: params[3],
        planned_duration_sec: params[4],
        completed: params[5],
      });
    } else if (normalized.startsWith('insert into session_scores')) {
      store.session_scores.push({
        session_id: params[0],
        throat_ease: params[1],
        voice_stability: params[2],
        resonance_forward: params[3],
        sentence_ending: params[4],
        naturalness: params[5],
        difficulty: params[6],
      });
    } else if (normalized.startsWith('insert into recordings')) {
      store.recordings.push({
        id: params[0],
        session_id: params[1],
        file_uri: params[2],
        script_id: params[3],
        duration_sec: params[4],
        created_at: params[5],
      });
    } else if (normalized.startsWith('insert into ai_reports')) {
      store.ai_reports.push({
        id: params[0],
        source_type: params[1],
        source_id: params[2],
        report_type: params[3],
        created_at: params[4],
        summary: params[5],
        findings_json: params[6],
        next_advice: params[7],
        raw_response_json: params[8],
      });
    } else if (normalized.startsWith('delete from ai_reports')) {
      store.ai_reports = store.ai_reports.filter((item) => item.source_type !== params[0] || item.source_id !== params[1]);
    } else if (normalized.startsWith('delete from recordings')) {
      store.recordings = store.recordings.filter((item) => item.id !== params[0]);
    } else if (normalized.startsWith('delete from ')) {
      const table = normalized.replace('delete from ', '').split(' ')[0] as keyof Store;
      if (Array.isArray(store[table])) {
        (store[table] as any[]) = [];
      }
    }

    writeStore(store);
  },

  async getFirstAsync<T>(sql: string, ...params: any[]): Promise<T | null> {
    const rows = await this.getAllAsync<T>(sql, ...params);
    return rows[0] ?? null;
  },

  async getAllAsync<T>(sql: string, ...params: any[]): Promise<T[]> {
    const store = readStore();
    const normalized = sql.replace(/\s+/g, ' ').trim().toLowerCase();

    if (normalized.includes('from users')) {
      return store.users.slice(0, 1) as T[];
    }
    if (normalized.includes('from app_settings')) {
      return store.app_settings.filter((item) => item.key === params[0]) as T[];
    }
    if (normalized.includes('from recordings r left join ai_reports')) {
      return sortByCreatedAtDesc<Record<string, any>>(
        store.recordings.map((recording) => ({
          ...recording,
          ai_summary: sortByCreatedAtDesc(store.ai_reports.filter((report) => report.source_type === 'recording' && report.source_id === recording.id))[0]
            ?.summary,
        }))
      ) as T[];
    }
    if (normalized.includes('from recordings where id')) {
      return store.recordings.filter((item) => item.id === params[0]) as T[];
    }
    if (normalized.includes('from ai_reports')) {
      return sortByCreatedAtDesc(store.ai_reports.filter((item) => item.source_type === params[0] && item.source_id === params[1])) as T[];
    }
    if (normalized.includes('from training_sessions order by started_at desc limit')) {
      return sortByStartedAtDesc(store.training_sessions as TrainingSession[]).slice(0, Number(params[0] ?? 10)) as T[];
    }
    if (normalized.includes('from session_modules sm join training_sessions')) {
      const cutoff = recentCutoff(Number(String(params[0] ?? '-7 days').match(/\d+/)?.[0] ?? 7));
      const recentSessionIds = new Set(store.training_sessions.filter((item) => item.started_at >= cutoff).map((item) => item.id));
      return store.session_modules.filter((item) => recentSessionIds.has(item.session_id)).map((item) => ({ module_id: item.module_id })) as T[];
    }
    if (normalized.includes('avg(throat_ease)')) {
      return [
        {
          throatEase: average(store.session_scores.map((item) => Number(item.throat_ease))),
          voiceStability: average(store.session_scores.map((item) => Number(item.voice_stability))),
          resonanceForward: average(store.session_scores.map((item) => Number(item.resonance_forward))),
          sentenceEnding: average(store.session_scores.map((item) => Number(item.sentence_ending))),
          naturalness: average(store.session_scores.map((item) => Number(item.naturalness))),
          difficulty: average(store.session_scores.map((item) => Number(item.difficulty))),
        },
      ] as T[];
    }
    if (normalized.includes("count(*) as count from training_sessions where started_at >= datetime('now', '-7 days')")) {
      return [{ count: store.training_sessions.filter((item) => item.started_at >= recentCutoff(7)).length }] as T[];
    }
    if (normalized.includes("count(*) as count from training_sessions where started_at >= datetime('now', '-30 days')")) {
      return [{ count: store.training_sessions.filter((item) => item.started_at >= recentCutoff(30)).length }] as T[];
    }
    if (normalized.includes('avg(actual_duration_sec)')) {
      return [{ avgSec: average(store.training_sessions.map((item) => Number(item.actual_duration_sec))) ?? 0 }] as T[];
    }
    if (normalized.includes('select * from training_sessions order by started_at desc limit 1')) {
      return sortByStartedAtDesc(store.training_sessions as TrainingSession[]).slice(0, 1) as T[];
    }
    if (normalized.includes('tm.category as category')) {
      const counts = new Map<TrainingCategory, { category: TrainingCategory; count: number; avgScore: number }>();
      for (const item of store.session_modules) {
        const category = moduleById[item.module_id]?.category;
        if (!category) continue;
        const current = counts.get(category) ?? { category, count: 0, avgScore: 0 };
        current.count += 1;
        counts.set(category, current);
      }
      return [...counts.values()].sort((a, b) => b.count - a.count) as T[];
    }
    if (normalized === 'select * from training_sessions order by started_at desc') {
      return sortByStartedAtDesc(store.training_sessions as TrainingSession[]) as T[];
    }
    if (normalized === 'select * from session_modules order by order_index asc') {
      return [...store.session_modules].sort((a, b) => Number(a.order_index) - Number(b.order_index)) as T[];
    }
    if (normalized === 'select * from session_scores') {
      return store.session_scores as T[];
    }

    return [] as T[];
  },
};

export function getDb() {
  return Promise.resolve(db);
}

export async function initDatabase() {
  const store = readStore();
  if (!store.users.length) {
    const now = nowIso();
    store.users.push({
      id: 'local-user',
      current_stage: 1,
      main_goal: '稳、松、清、暖、实',
      created_at: now,
      updated_at: now,
    });
    writeStore(store);
  }
}

export async function clearTables(tables: string[]) {
  const store = readStore();
  for (const table of tables) {
    if (table in store) {
      (store as any)[table] = [];
    }
  }
  writeStore(store);
}
