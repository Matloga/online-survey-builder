import { query, withTransaction, sql } from '../db/pool.js';

export function mapAnswer(row) {
  return {
    questionId: row.QuestionId,
    questionText: row.QuestionText,
    questionType: row.Type,
    value: decodeValue(row),
  };
}

function decodeValue(row) {
  if (row.ValueJson) {
    try {
      return JSON.parse(row.ValueJson);
    } catch {
      return row.ValueJson;
    }
  }
  if (row.ValueNumber !== null && row.ValueNumber !== undefined) return row.ValueNumber;
  return row.ValueText;
}

export function mapResponse(row, answers = []) {
  return {
    id: row.ResponseId,
    surveyId: row.SurveyId,
    respondentId: row.RespondentId ?? null,
    respondentEmail: row.RespondentEmail ?? null,
    submittedAt: row.SubmittedAt,
    answers,
  };
}

/**
 * Insert a response and its answers atomically.
 * Relies on the filtered unique indexes for duplicate rejection when a survey
 * disallows multiple submissions.
 */
export async function create(survey, rows, { respondentId, guestKey, userAgent }) {
  return withTransaction(async (tx) => {
    const request = new sql.Request(tx);
    request.input(
      'surveyId',
      sql.Int,
      survey.SurveyId ?? survey.id,
    );
    request.input('respondentId', sql.Int, respondentId ?? null);
    request.input('guestKey', sql.NVarChar(64), guestKey ?? null);
    request.input('userAgent', sql.NVarChar(300), userAgent?.slice(0, 300) ?? null);

    const { recordset } = await request.query(
      `INSERT INTO dbo.Responses (SurveyId, RespondentId, GuestKey, UserAgent)
       OUTPUT INSERTED.ResponseId
       VALUES (@surveyId, @respondentId, @guestKey, @userAgent)`,
    );
    const responseId = recordset[0].ResponseId;

    for (const row of rows) {
      const ar = new sql.Request(tx);
      ar.input('responseId', sql.Int, responseId);
      ar.input('questionId', sql.Int, row.QuestionId);
      ar.input('valueText', sql.NVarChar(sql.MAX), row.ValueText ?? null);
      ar.input('valueNumber', sql.Float, row.ValueNumber ?? null);
      ar.input('valueJson', sql.NVarChar(sql.MAX), row.ValueJson ?? null);
      await ar.query(
        `INSERT INTO dbo.Answers (ResponseId, QuestionId, ValueText, ValueNumber, ValueJson)
         VALUES (@responseId, @questionId, @valueText, @valueNumber, @valueJson)`,
      );
    }

    return responseId;
  });
}

const RESPONSE_SELECT = `
  SELECT r.ResponseId, r.SurveyId, r.RespondentId, r.SubmittedAt, r.UserAgent,
         u.Email AS RespondentEmail
  FROM dbo.Responses r
  LEFT JOIN dbo.Users u ON u.UserId = r.RespondentId`;

export async function listBySurvey(surveyId, { limit = 100, page = 1 } = {}) {
  const take = Math.min(Math.max(Number(limit) || 100, 1), 1000);
  const skip = (Math.max(Number(page) || 1, 1) - 1) * take;

  const { recordset: countRows } = await query(
    'SELECT COUNT(*) AS Total FROM dbo.Responses WHERE SurveyId = @surveyId',
    { surveyId },
  );
  const total = countRows[0].Total;

  const { recordset } = await query(
    `${RESPONSE_SELECT} WHERE r.SurveyId = @surveyId
     ORDER BY r.SubmittedAt DESC, r.ResponseId DESC
     OFFSET @skip ROWS FETCH NEXT @take ROWS ONLY`,
    { surveyId, skip, take },
  );

  if (!recordset.length) {
    return { items: [], total, page: Math.max(Number(page) || 1, 1), pageSize: take };
  }

  const answers = await answersForResponses(recordset.map((r) => r.ResponseId));
  return {
    items: recordset.map((r) => mapResponse(r, answers.get(r.ResponseId) || [])),
    total,
    page: Math.max(Number(page) || 1, 1),
    pageSize: take,
  };
}

/** All responses for a survey, unpaginated. Used by the export service. */
export async function listAllForExport(surveyId) {
  const { recordset } = await query(
    `${RESPONSE_SELECT} WHERE r.SurveyId = @surveyId
     ORDER BY r.SubmittedAt ASC, r.ResponseId ASC`,
    { surveyId },
  );
  if (!recordset.length) return [];
  const answers = await answersForResponses(recordset.map((r) => r.ResponseId));
  return recordset.map((r) => mapResponse(r, answers.get(r.ResponseId) || []));
}

export async function findById(responseId) {
  const { recordset } = await query(`${RESPONSE_SELECT} WHERE r.ResponseId = @responseId`, {
    responseId,
  });
  if (!recordset.length) return null;
  const answers = await answersForResponses([recordset[0].ResponseId]);
  return mapResponse(recordset[0], answers.get(recordset[0].ResponseId) || []);
}

export async function answersForResponses(responseIds) {
  const map = new Map(responseIds.map((id) => [id, []]));
  if (!responseIds.length) return map;

  const ids = responseIds.join(',');
  const { recordset } = await query(
    `SELECT a.ResponseId, a.QuestionId, a.ValueText, a.ValueNumber, a.ValueJson,
            q.Text AS QuestionText, q.Type
     FROM dbo.Answers a
     JOIN dbo.Questions q ON q.QuestionId = a.QuestionId
     WHERE a.ResponseId IN (${ids})
     ORDER BY q.Position, q.QuestionId`,
  );

  for (const row of recordset) {
    map.get(row.ResponseId)?.push(mapAnswer(row));
  }
  return map;
}

export async function remove(responseId, surveyId) {
  const result = await query(
    'DELETE FROM dbo.Responses WHERE ResponseId = @responseId AND SurveyId = @surveyId',
    { responseId, surveyId },
  );
  return result.rowsAffected[0] > 0;
}

export async function hasResponded(surveyId, { respondentId, guestKey }) {
  if (respondentId) {
    const { recordset } = await query(
      'SELECT 1 AS Found FROM dbo.Responses WHERE SurveyId = @surveyId AND RespondentId = @respondentId',
      { surveyId, respondentId },
    );
    return recordset.length > 0;
  }
  if (guestKey) {
    const { recordset } = await query(
      'SELECT 1 AS Found FROM dbo.Responses WHERE SurveyId = @surveyId AND GuestKey = @guestKey',
      { surveyId, guestKey },
    );
    return recordset.length > 0;
  }
  return false;
}