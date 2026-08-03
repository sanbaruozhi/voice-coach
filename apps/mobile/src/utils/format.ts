export function clampScore(value: number) {
  return Math.max(1, Math.min(5, Math.round(value)));
}

export function percent(value: number, total: number) {
  if (!total) return '0%';
  return `${Math.round((value / total) * 100)}%`;
}
