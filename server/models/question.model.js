import { query } from '../db/pool.js';

export function mapQuestion(row) {
  if (!row) return null;
  return {
    id: row.QuestionId,
    surveyId: row.SurveyId,
    type: row.Type,
    text: row.Text,
    required: !!row.Required,
    options: parseJson(row.Options, []),
    settings: parseJson(row.Settings, {}),
    position: row.Position,
  };
}

function parseJson(value, fallback) {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

export async function listBySurvey(surveyId) {
  const { recordset } = await query(
    `SELECT QuestionId, SurveyId, Type, Text, Required, Options, Settings, Position
     FROM dbo.Questions WHERE SurveyId = @surveyId
     ORDER BY Position, QuestionId`,
    { surveyId },
  );
  return recordset.map(mapQuestion);
}

export async function findById(questionId) {
  const { recordset } = await query(
    `SELECT QuestionId, SurveyId, Type, Text, Required, Options, Settings, Position
     FROM dbo.Questions WHERE QuestionId = @questionId`,
    { questionId },
  );
  return mapQuestion(recordset[0]);
}

export async function nextPosition(surveyId) {
  const { recordset } = await query(
    `SELECT COALESCE(MAX(Position), -1) + 1 AS NextPos
     FROM dbo.Questions WHERE SurveyId = @surveyId`,
    { surveyId },
  );
  return recordset[0].NextPos;
}

export async function create(surveyId, data, position) {
  const pos = position ?? (await nextPosition(surveyId));
  const { recordset } = await query(
    `INSERT INTO dbo.Questions (SurveyId, Type, Text, Required, Options, Settings, Position)
     OUTPUT INSERTED.QuestionId
     VALUES (@surveyId, @type, @text, @required, @options, @settings, @position)`,
    {
      surveyId,
      type: data.type,
      text: data.text,
      required: data.required ? 1 : 0,
      options: data.options?.length ? JSON.stringify(data.options) : null,
      settings: data.settings && Object.keys(data.settings).length
        ? JSON.stringify(data.settings)
        : null,
      position: pos,
    },
  );
  return findById(recordset[0].QuestionId);
}

const UPDATABLE = {
  type: 'Type',
  text: 'Text',
  required: 'Required',
  options: 'Options',
  settings: 'Settings',
  position: 'Position',
};

export async function update(questionId, surveyId, data) {
  const sets = [];
  const params = { questionId, surveyId };

  for (const [key, column] of Object.entries(UPDATABLE)) {
    if (data[key] === undefined) continue;
    sets.push(`${column} = @${key}`);
    if (key === 'required') params[key] = data[key] ? 1 : 0;
    else if (key === 'options') {
      params[key] = data[key]?.length ? JSON.stringify(data[key]) : null;
    } else if (key === 'settings') {
      params[key] = data[key] && Object.keys(data[key]).length
        ? JSON.stringify(data[key])
        : null;
    } else params[key] = data[key];
  }

  if (!sets.length) return findById(questionId);

  const result = await query(
    `UPDATE dbo.Questions SET ${sets.join(', ')}
     WHERE QuestionId = @questionId AND SurveyId = @surveyId`,
    params,
  );
  if (result.rowsAffected[0] === 0) return null;
  return findById(questionId);
}

export async function remove(questionId, surveyId) {
  const result = await query(
    'DELETE FROM dbo.Questions WHERE QuestionId = @questionId AND SurveyId = @surveyId',
    { questionId, surveyId },
  );
  const removed = result.rowsAffected[0] > 0;
  if (removed) await resequence(surveyId);
  return removed;
}

/** Persist a whole reorder in one transaction-safe pass. */
export async function reorder(surveyId, orderedIds) {
  if (!orderedIds?.length) return listBySurvey(surveyId);

  const { recordset: existing } = await query(
    'SELECT QuestionId FROM dbo.Questions WHERE SurveyId = @surveyId',
    { surveyId },
  );
  const known = new Set(existing.map((r) => r.QuestionId));
  const valid = orderedIds.filter((id) => known.has(id));

  for (let i = 0; i < valid.length; i += 1) {
    await query(
      'UPDATE dbo.Questions SET Position = @position WHERE QuestionId = @questionId AND SurveyId = @surveyId',
      { questionId: valid[i], surveyId, position: i },
    );
  }
  return listBySurvey(surveyId);
}

async function resequence(surveyId) {
  const questions = await listBySurvey(surveyId);
  for (let i = 0; i < questions.length; i += 1) {
    if (questions[i].position !== i) {
      await query(
        'UPDATE dbo.Questions SET Position = @position WHERE QuestionId = @questionId',
        { questionId: questions[i].id, position: i },
      );
    }
  }
}

/** Total answered count per question, used to compute completion rates. */
export async function answerCounts(surveyId) {
  const { recordset } = await query(
    `SELECT q.QuestionId,
            (SELECT COUNT(*) FROM dbo.Answers a WHERE a.QuestionId = q.QuestionId) AS AnswerCount
     FROM dbo.Questions q WHERE q.SurveyId = @surveyId`,
    { surveyId },
  );
  const counts = {};
  for (const row of recordset) counts[row.QuestionId] = row.AnswerCount;
  return counts;
}