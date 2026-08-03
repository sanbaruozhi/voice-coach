export function nowIso() {
  return new Date().toISOString();
}

export function daysBetween(dateIso?: string | null) {
  if (!dateIso) return null;
  const then = new Date(dateIso).getTime();
  if (Number.isNaN(then)) return null;
  return Math.max(0, Math.floor((Date.now() - then) / 86400000));
}

export function formatRelativeDays(days: number | null) {
  if (days === null) return '还没有训练记录';
  if (days === 0) return '今天练过';
  if (days === 1) return '距离上次 1 天';
  return `距离上次 ${days} 天`;
}

export function formatDateTime(dateIso?: string | null) {
  if (!dateIso) return '暂无';
  const date = new Date(dateIso);
  return `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, '0')}:${String(
    date.getMinutes()
  ).padStart(2, '0')}`;
}

export function secondsToText(seconds?: number | null) {
  const value = Math.max(0, Math.floor(seconds ?? 0));
  const min = Math.floor(value / 60);
  const sec = value % 60;
  if (min === 0) return `${sec} 秒`;
  return `${min} 分 ${sec} 秒`;
}
