export function countdown(target, now) {
  const seconds = Math.max(0, Math.ceil((new Date(target).getTime() - now) / 1000));
  return [
    Math.floor(seconds / 86400),
    Math.floor(seconds / 3600) % 24,
    Math.floor(seconds / 60) % 60,
    seconds % 60,
  ];
}
export function progress(objective, now) {
  const start = new Date(objective.created_at).getTime();
  const end = new Date(objective.target_date).getTime();
  if (end <= start) return now >= end ? 100 : 0;
  return Math.max(0, Math.min(100, ((now - start) / (end - start)) * 100));
}
export function dayKey(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function localInput(date) {
  const d = new Date(date);
  return `${dayKey(d)}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
}
export const dateLabel = (date, options = {}) =>
  new Date(date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', ...options });
export const timeLabel = (date) =>
  new Date(date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
