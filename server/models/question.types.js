export const QUESTION_TYPES = [
  'short-text',
  'long-text',
  'multiple-choice',
  'checkboxes',
  'dropdown',
  'rating',
  'yes-no',
];

export const TYPES_WITH_OPTIONS = new Set([
  'multiple-choice',
  'checkboxes',
  'dropdown',
]);

export const SURVEY_STATUSES = ['draft', 'published', 'closed'];

/** Human labels reused by the client's builder and the PDF/Excel exports. */
export const QUESTION_TYPE_LABELS = {
  'short-text': 'Short Answer',
  'long-text': 'Long Answer',
  'multiple-choice': 'Multiple Choice',
  checkboxes: 'Checkboxes',
  dropdown: 'Dropdown',
  rating: 'Rating (1-5)',
  'yes-no': 'Yes / No',
};