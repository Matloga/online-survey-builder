export const QUESTION_TYPES = [
  { value: 'short-text', label: 'Short Answer', hint: 'One line of text' },
  { value: 'long-text', label: 'Long Answer', hint: 'Paragraph of text' },
  { value: 'multiple-choice', label: 'Multiple Choice', hint: 'Pick one option' },
  { value: 'checkboxes', label: 'Checkboxes', hint: 'Pick several options' },
  { value: 'dropdown', label: 'Dropdown', hint: 'Compact single choice' },
  { value: 'rating', label: 'Rating', hint: 'Scale, 1 to 5 by default' },
  { value: 'yes-no', label: 'Yes / No', hint: 'Binary choice' },
];

export const TYPES_WITH_OPTIONS = new Set([
  'multiple-choice',
  'checkboxes',
  'dropdown',
]);

export const QUESTION_TYPE_LABELS = Object.fromEntries(
  QUESTION_TYPES.map((t) => [t.value, t.label]),
);

export const SURVEY_STATUSES = [
  { value: 'draft', label: 'Draft' },
  { value: 'published', label: 'Live' },
  { value: 'closed', label: 'Closed' },
];

export const CATEGORY_OPTIONS = [
  'General',
  'Customer Feedback',
  'Employee Satisfaction',
  'Education',
  'Market Research',
  'Event Planning',
  'Academic Research',
  'Other',
];

export const RATING_LABELS = {
  1: 'Very poor',
  2: 'Poor',
  3: 'Average',
  4: 'Good',
  5: 'Excellent',
};

export function formatDate(value, opts = {}) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric', ...opts });
}

export function formatDateTime(value) {
  return formatDate(value, { hour: '2-digit', minute: '2-digit' });
}

export function formatNumber(value) {
  return new Intl.NumberFormat().format(value ?? 0);
}

export function relativeTime(value) {
  if (!value) return 'never';
  const diff = Date.now() - new Date(value).getTime();
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(value);
}

export const CHART_COLORS = [
  '#4f46e5',
  '#0ea5e9',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#ec4899',
  '#14b8a6',
];

export function initials(name = '') {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');
}