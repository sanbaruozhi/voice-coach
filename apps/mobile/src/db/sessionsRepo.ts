import { moduleById } from '../data/trainingModules';
import { SessionDraft, ScoreInputValues, TrainingCategory, TrainingSession } from '../types';
import { createId } from '../utils/ids';
import { nowIso } from '../utils/date';
import { getDb, clearTables } from './database';

export async function getUserStage() {
  const db = await getDb();
  const row = await db.getFirstAsync<{ current_stage: number }>('SELECT current_stage FROM users LIMIT 1');
  return ((row?.current_stage ?? 1) as 1 | 2 | 3 | 4) || 1;
}

export async function saveCompletedSession(input: {
  draft: SessionDraft;
  scores: ScoreInputValues;
  notes: string;
  throatAfter: string;
}) {
  const db = await getDb();
  const completedAt = nowIso();
  await db.runAsync(
    `INSERT INTO training_sessions
    (id, started_at, completed_at, planned_duration_min, actual_duration_sec, session_type, completed,
     throat_status_before, throat_status_after, recommendation_reason, focus_goal, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    input.draft.id,
    input.draft.startedAt,
    completedAt,
    input.draft.availableMinutes,
    input.draft.actualDurationSec ?? input.draft.availableMinutes * 60,
    input.draft.recommendation.sessionName,
    1,
    input.draft.currentStatus,
    input.throatAfter,
    input.draft.recommendation.recommendationReason,
    input.draft.recommendation.focusGoal,
    input.notes
  );

  for (const [index, moduleId] of input.draft.recommendation.moduleIds.entries()) {
    const module = moduleById[moduleId];
    await db.runAsync(
      'INSERT INTO session_modules (id, session_id, module_id, order_index, planned_duration_sec, completed) VALUES (?, ?, ?, ?, ?, ?)',
      createId('sm'),
      input.draft.id,
      moduleId,
      index,
      module?.durationSec ?? 60,
      1
    );
  }

  await db.runAsync(
    `INSERT INTO session_scores
    (session_id, throat_ease, voice_stability, resonance_forward, sentence_ending, naturalness, difficulty)
    VALUES (?, ?, ?, ?, ?, ?, ?)`,
    input.draft.id,
    input.scores.throatEase,
    input.scores.voiceStability,
    input.scores.resonanceForward,
    input.scores.sentenceEnding,
    input.scores.naturalness,
    input.scores.difficulty
  );
}

export async function getRecentSessions(limit = 10) {
  const db = await getDb();
  return db.getAllAsync<TrainingSession>(
    'SELECT * FROM training_sessions ORDER BY started_at DESC LIMIT ?',
    limit
  );
}

export async function getRecentModuleIds(days = 7) {
  const db = await getDb();
  const rows = await db.getAllAsync<{ module_id: string }>(
    `SELECT sm.module_id
     FROM session_modules sm
     JOIN training_sessions ts ON ts.id = sm.session_id
     WHERE ts.started_at >= datetime('now', ?)
     ORDER BY ts.started_at DESC`,
    `-${days} days`
  );
  return rows.map((row) => row.module_id);
}

export async function getAverageScores() {
  const db = await getDb();
  return db.getFirstAsync<{
    throatEase: number;
    voiceStability: number;
    resonanceForward: number;
    sentenceEnding: number;
    naturalness: number;
    difficulty: number;
  }>(
    `SELECT
      AVG(throat_ease) as throatEase,
      AVG(voice_stability) as voiceStability,
      AVG(resonance_forward) as resonanceForward,
      AVG(sentence_ending) as sentenceEnding,
      AVG(naturalness) as naturalness,
      AVG(difficulty) as difficulty
    FROM session_scores`
  );
}

export async function getWeakCategories(): Promise<TrainingCategory[]> {
  const scores = await getAverageScores();
  const weak: TrainingCategory[] = [];
  if ((scores?.resonanceForward ?? 5) < 3.5) weak.push('resonance');
  if ((scores?.sentenceEnding ?? 5) < 3.5) weak.push('tone');
  if ((scores?.voiceStability ?? 5) < 3.5) weak.push('breath');
  if ((scores?.naturalness ?? 5) < 3.5) weak.push('articulation');
  return weak;
}

export async function getProgressStats() {
  const db = await getDb();
  const seven = await db.getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) as count FROM training_sessions WHERE started_at >= datetime('now', '-7 days')"
  );
  const thirty = await db.getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) as count FROM training_sessions WHERE started_at >= datetime('now', '-30 days')"
  );
  const avg = await db.getFirstAsync<{ avgSec: number }>('SELECT AVG(actual_duration_sec) as avgSec FROM training_sessions');
  const last = await db.getFirstAsync<TrainingSession>('SELECT * FROM training_sessions ORDER BY started_at DESC LIMIT 1');
  const categoryRows = await db.getAllAsync<{ category: TrainingCategory; count: number; avgScore: number }>(
    `SELECT tm.category as category, COUNT(*) as count, AVG(ss.voice_stability + ss.resonance_forward + ss.sentence_ending + ss.naturalness) / 4.0 as avgScore
     FROM session_modules sm
     JOIN training_sessions ts ON ts.id = sm.session_id
     LEFT JOIN session_scores ss ON ss.session_id = ts.id
     JOIN (
       SELECT 'relax-shoulder-neck' as id, 'relax' as category UNION SELECT 'relax-jaw','relax' UNION SELECT 'relax-tongue-root','relax'
       UNION SELECT 'relax-yawn-sigh','relax' UNION SELECT 'relax-posture-reset','relax'
       UNION SELECT 'breath-low-inhale','breath' UNION SELECT 'breath-s-flow','breath' UNION SELECT 'breath-f-flow','breath'
       UNION SELECT 'breath-one-sentence','breath' UNION SELECT 'breath-pre-meeting','breath'
       UNION SELECT 'sovt-straw-bubbles','sovt' UNION SELECT 'sovt-straw-hum','sovt' UNION SELECT 'sovt-lip-trill','sovt'
       UNION SELECT 'sovt-closed-hum','sovt' UNION SELECT 'sovt-soft-onset','sovt'
       UNION SELECT 'resonance-closed-ng','resonance' UNION SELECT 'resonance-ng-ma','resonance' UNION SELECT 'resonance-m-n-ng','resonance'
       UNION SELECT 'resonance-open','resonance' UNION SELECT 'resonance-official-short','resonance'
       UNION SELECT 'articulation-initial','articulation' UNION SELECT 'articulation-vowel','articulation' UNION SELECT 'articulation-ending','articulation'
       UNION SELECT 'articulation-keyword','articulation'
       UNION SELECT 'tone-before-pause','tone' UNION SELECT 'tone-conclusion-slow','tone' UNION SELECT 'tone-ending-land','tone'
       UNION SELECT 'tone-keyword-weight','tone' UNION SELECT 'tone-warm-reminder','tone' UNION SELECT 'tone-official-report','scenario'
     ) tm ON tm.id = sm.module_id
     GROUP BY tm.category
     ORDER BY count DESC`
  );
  return {
    count7d: seven?.count ?? 0,
    count30d: thirty?.count ?? 0,
    avgDurationSec: Math.round(avg?.avgSec ?? 0),
    lastSession: last ?? null,
    categoryRows,
  };
}

export async function exportTrainingJson() {
  const db = await getDb();
  const sessions = await db.getAllAsync('SELECT * FROM training_sessions ORDER BY started_at DESC');
  const modules = await db.getAllAsync('SELECT * FROM session_modules ORDER BY order_index ASC');
  const scores = await db.getAllAsync('SELECT * FROM session_scores');
  return JSON.stringify({ exportedAt: nowIso(), sessions, modules, scores }, null, 2);
}

export async function clearTrainingRecords() {
  await clearTables(['session_scores', 'session_modules', 'training_sessions', 'module_progress']);
}
