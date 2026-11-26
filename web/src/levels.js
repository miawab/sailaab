// The 4 risk levels. Colour is never used alone: every level also has an icon and a word.
export const LEVELS = {
  safe:    { color: '#16A34A', soft: '#E8F7EE', label: 'Safe',    ur: 'محفوظ',     icon: 'safe' },
  watch:   { color: '#EAB308', soft: '#FEF8E1', label: 'Watch',   ur: 'نظر رکھیں', icon: 'watch' },
  warning: { color: '#F97316', soft: '#FFF1E7', label: 'Warning', ur: 'خطرہ',      icon: 'warning' },
  danger:  { color: '#DC2626', soft: '#FDECEC', label: 'Danger',  ur: 'شدید خطرہ', icon: 'danger' },
};
export const NO_DATA = '#94A3B8';

// MapLibre expression: property `level` -> colour.
export const levelColorExpr = (prop = 'level') => [
  'match', ['coalesce', ['get', prop], 'none'],
  'safe', LEVELS.safe.color,
  'watch', LEVELS.watch.color,
  'warning', LEVELS.warning.color,
  'danger', LEVELS.danger.color,
  NO_DATA,
];

export const LANGS = [
  { key: 'ur', label: 'اردو', dir: 'rtl', font: 'nastaliq' },
  { key: 'sd', label: 'سنڌي', dir: 'rtl', font: 'naskh' },
  { key: 'pa', label: 'پنجابی', dir: 'rtl', font: 'nastaliq' },
  { key: 'en', label: 'EN', dir: 'ltr', font: 'latin' },
];

export function daysUntil(dateStr, today) {
  if (!dateStr) return null;
  return Math.round((new Date(dateStr) - new Date(today)) / 86400000);
}

export function fmtDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}
