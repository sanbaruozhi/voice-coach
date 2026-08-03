import { getDb, clearTables } from './database';
import { createId } from '../utils/ids';
import { nowIso } from '../utils/date';

export type AiReportRow = {
  id: string;
  source_type: string;
  source_id: string;
  report_type: string;
  created_at: string;
  summary: string;
  findings_json: string;
  next_advice: string;
  raw_response_json: string;
};

export async function saveAiReport(input: {
  sourceType: string;
  sourceId: string;
  reportType: string;
  summary: string;
  findings: unknown;
  nextAdvice: string;
  raw: unknown;
}) {
  const db = await getDb();
  const id = createId('air');
  await db.runAsync(
    `INSERT INTO ai_reports
    (id, source_type, source_id, report_type, created_at, summary, findings_json, next_advice, raw_response_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    input.sourceType,
    input.sourceId,
    input.reportType,
    nowIso(),
    input.summary,
    JSON.stringify(input.findings),
    input.nextAdvice,
    JSON.stringify(input.raw)
  );
  return id;
}

export async function getAiReport(sourceType: string, sourceId: string) {
  const db = await getDb();
  return db.getFirstAsync<AiReportRow>(
    'SELECT * FROM ai_reports WHERE source_type = ? AND source_id = ? ORDER BY created_at DESC LIMIT 1',
    sourceType,
    sourceId
  );
}

export async function deleteAiReport(sourceType: string, sourceId: string) {
  const db = await getDb();
  await db.runAsync('DELETE FROM ai_reports WHERE source_type = ? AND source_id = ?', sourceType, sourceId);
}

export async function clearAiReports() {
  await clearTables(['ai_reports']);
}
