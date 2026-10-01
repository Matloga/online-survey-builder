import { TYPES_WITH_OPTIONS } from './question.types.js';

export class ValidationError extends Error {
  constructor(message, fieldErrors = {}) {
    super(message);
    this.name = 'ValidationError';
    this.fieldErrors = fieldErrors;
    this.statusCode = 400;
  }
}

/**
 * Validate one answer against its question definition.
 * Returns the typed column values to persist, or throws.
 */
function validateAnswer(question, rawValue) {
  const id = question.id;
  const type = question.type;

  const isBlank =
    rawValue === undefined ||
    rawValue === null ||
    (typeof rawValue === 'string' && rawValue.trim() === '') ||
    (Array.isArray(rawValue) && rawValue.length === 0);

  if (isBlank) {
    if (question.required) {
      throw new ValidationError(`Question "${question.text}" is required`, {
        [`question_${id}`]: 'This question is required',
      });
    }
    return null;
  }

  switch (type) {
    case 'short-text': {
      const value = String(rawValue).trim();
      if (value.length > 1000) {
        throw new ValidationError(`Answer to "${question.text}" is too long`, {
          [`question_${id}`]: 'Maximum 1000 characters',
        });
      }
      return { ValueText: value };
    }

    case 'long-text': {
      const value = String(rawValue).trim();
      if (value.length > 5000) {
        throw new ValidationError(`Answer to "${question.text}" is too long`, {
          [`question_${id}`]: 'Maximum 5000 characters',
        });
      }
      return { ValueText: value };
    }

    case 'multiple-choice':
    case 'dropdown': {
      const value = String(rawValue);
      const allowed = question.options || [];
      if (allowed.length && !allowed.includes(value)) {
        throw new ValidationError(`"${value}" is not a valid option for "${question.text}"`, {
          [`question_${id}`]: 'Choose one of the available options',
        });
      }
      return { ValueText: value };
    }

    case 'checkboxes': {
      const values = Array.isArray(rawValue) ? rawValue.map(String) : [String(rawValue)];
      const allowed = question.options || [];
      if (allowed.length) {
        const invalid = values.filter((v) => !allowed.includes(v));
        if (invalid.length) {
          throw new ValidationError(`"${invalid[0]}" is not a valid option for "${question.text}"`, {
            [`question_${id}`]: 'Choose only from the available options',
          });
        }
      }
      return { ValueJson: JSON.stringify(values) };
    }

    case 'rating': {
      const num = Number(rawValue);
      const min = question.settings?.min ?? 1;
      const max = question.settings?.max ?? 5;
      if (!Number.isFinite(num) || num < min || num > max) {
        throw new ValidationError(`Rating for "${question.text}" must be between ${min} and ${max}`, {
          [`question_${id}`]: `Enter a rating from ${min} to ${max}`,
        });
      }
      return { ValueNumber: num };
    }

    case 'yes-no': {
      const value = String(rawValue).toLowerCase();
      if (value !== 'yes' && value !== 'no') {
        throw new ValidationError(`Answer to "${question.text}" must be Yes or No`, {
          [`question_${id}`]: 'Choose Yes or No',
        });
      }
      return { ValueText: value };
    }

    default:
      throw new ValidationError(`Unsupported question type: ${type}`);
  }
}

/**
 * Validate a whole submission.
 * @param questions question definitions from the DB
 * @param answers   [{ questionId, value }]
 * @returns flat rows ready for the Answers table
 */
export function validateSubmission(questions, answers) {
  const fieldErrors = {};
  const byId = new Map(questions.map((q) => [q.id, q]));

  const submitted = new Map();
  for (const a of answers || []) {
    if (!byId.has(Number(a.questionId))) {
      fieldErrors[`question_${a.questionId}`] = 'Unknown question';
      continue;
    }
    submitted.set(Number(a.questionId), a.value);
  }

  const rows = [];
  for (const question of questions) {
    let value;
    try {
      value = validateAnswer(question, submitted.get(question.id));
    } catch (err) {
      if (err instanceof ValidationError) {
        Object.assign(fieldErrors, err.fieldErrors);
        continue;
      }
      throw err;
    }

    if (value) {
      rows.push({ QuestionId: question.id, ...value });
    } else if (TYPES_WITH_OPTIONS.has(question.type)) {
      // no-op: optional question left blank is simply not stored
    }
  }

  if (Object.keys(fieldErrors).length) {
    throw new ValidationError('Some answers are invalid', fieldErrors);
  }

  return rows;
}