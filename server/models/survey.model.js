import crypto from 'node:crypto';
import { query } from '../db/pool.js';

function newShareToken() {
  return crypto.randomBytes(16).toString('hex');
}

/** Shape a Surveys row for API responses. */
export function mapSurvey(row) {
  if (!row) return null;
  return {
    id: row.SurveyId,
    ownerId: row.OwnerId,
    title: row.Title,
    description: row.Description,
    category: row.Category,
    status: row.Status,
    shareToken: row.ShareToken,
    anonymousResponses: !!row.AnonymousResponses,
    allowMultipleResponses: !!row.AllowMultipleResponses,
    expiresAt: row.ExpiresAt,
    createdAt: row.CreatedAt,
    updatedAt: row.UpdatedAt,
    questionCount: row.QuestionCount ?? undefined,
    responseCount: row.ResponseCount ?? undefined,
    expired: row.ExpiresAt ? new Date(row.ExpiresAt) < new Date() : false,
  };
}

const LIST_SELECT = `
  SELECT s.SurveyId, s.OwnerId, s.Title, s.Description, s.Category, s.Status,
         s.ShareToken, s.AnonymousResponses, s.AllowMultipleResponses,
         s.ExpiresAt, s.CreatedAt, s.UpdatedAt,
         (SELECT COUNT(*) FROM dbo.Questions q WHERE q.SurveyId = s.SurveyId) AS QuestionCount,
         (SELECT COUNT(*) FROM dbo.Responses r WHERE r.SurveyId = s.SurveyId) AS ResponseCount
  FROM dbo.Surveys s`;

export async function createSurvey(ownerId, data) {
  const shareToken = newShareToken();
  const { recordset } = await query(
    `INSERT INTO dbo.Surveys
       (OwnerId, Title, Description, Category, Status, ShareToken,
        AnonymousResponses, AllowMultipleResponses, ExpiresAt)
     OUTPUT INSERTED.SurveyId
     VALUES (@ownerId, @title, @description, @category, @status, @shareToken,
             @anonymous, @multiple, @expiresAt)`,
    {
      ownerId,
      title: data.title,
      description: data.description ?? null,
      category: data.category ?? null,
      status: data.status ?? 'draft',
      shareToken,
      anonymous: data.anonymousResponses ? 1 : 0,
      multiple: data.allowMultipleResponses ? 1 : 0,
      expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
    },
  );
  return recordset[0].SurveyId;
}

export async function findById(surveyId) {
  const { recordset } = await query(`${LIST_SELECT} WHERE s.SurveyId = @surveyId`, {
    surveyId,
  });
  return mapSurvey(recordset[0]);
}

export async function findByShareToken(shareToken) {
  const { recordset } = await query(`${LIST_SELECT} WHERE s.ShareToken = @shareToken`, {
    shareToken,
  });
  return mapSurvey(recordset[0]);
}

export async function findRaw(surveyId) {
  const { recordset } = await query(
    `SELECT SurveyId, OwnerId, Title, Status, AnonymousResponses,
            AllowMultipleResponses, ExpiresAt, ShareToken
     FROM dbo.Surveys WHERE SurveyId = @surveyId`,
    { surveyId },
  );
  return recordset[0] || null;
}

/**
 * Search + filter + paginate a user's surveys.
 * Sort whitelist prevents SQL injection through the sort query param.
 */
export async function listByOwner(ownerId, filters = {}) {
  const {
    search,
    category,
    status,
    from,
    to,
    sort = 'createdAt',
    order = 'desc',
    page = 1,
    pageSize = 12,
  } = filters;

  const where = ['s.OwnerId = @ownerId'];
  const params = { ownerId };

  if (search) {
    where.push('(s.Title LIKE @search OR s.Description LIKE @search)');
    params.search = `%${search}%`;
  }
  if (category) {
    where.push('s.Category = @category');
    params.category = category;
  }
  if (status) {
    where.push('s.Status = @status');
    params.status = status;
  }
  if (from) {
    where.push('s.CreatedAt >= @from');
    params.from = new Date(from);
  }
  if (to) {
    where.push('s.CreatedAt <= @to');
    params.to = new Date(to);
  }

  const SORTABLE = {
    createdAt: 's.CreatedAt',
    updatedAt: 's.UpdatedAt',
    title: 's.Title',
    status: 's.Status',
    category: 's.Category',
    responses: 'ResponseCount',
  };
  const sortColumn = SORTABLE[sort] || SORTABLE.createdAt;
  const direction = String(order).toLowerCase() === 'asc' ? 'ASC' : 'DESC';

  const take = Math.min(Math.max(Number(pageSize) || 12, 1), 100);
  const skip = (Math.max(Number(page) || 1, 1) - 1) * take;

  const whereSql = where.join(' AND ');
  const countSql = `
    SELECT COUNT(*) AS Total
    FROM dbo.Surveys s
    WHERE ${whereSql}`;

  const { recordset: countRows } = await query(countSql, params);
  const total = countRows[0].Total;

  const listSql = `
    SELECT * FROM (
      ${LIST_SELECT}
      WHERE ${whereSql}
      ORDER BY ${sortColumn} ${direction}, s.SurveyId DESC
      OFFSET @skip ROWS FETCH NEXT @take ROWS ONLY
    ) AS page
    ORDER BY ${sortColumn} ${direction}, SurveyId DESC`;

  const { recordset } = await query(listSql, { ...params, skip, take });

  return {
    items: recordset.map(mapSurvey),
    total,
    page: Math.max(Number(page) || 1, 1),
    pageSize: take,
    totalPages: Math.max(Math.ceil(total / take), 1),
  };
}

export async function listCategories(ownerId) {
  const { recordset } = await query(
    `SELECT DISTINCT Category FROM dbo.Surveys
     WHERE OwnerId = @ownerId AND Category IS NOT NULL
     ORDER BY Category`,
    { ownerId },
  );
  return recordset.map((r) => r.Category);
}

const UPDATABLE = {
  title: 'Title',
  description: 'Description',
  category: 'Category',
  status: 'Status',
  anonymousResponses: 'AnonymousResponses',
  allowMultipleResponses: 'AllowMultipleResponses',
  expiresAt: 'ExpiresAt',
};

export async function update(surveyId, ownerId, data) {
  const sets = [];
  const params = { surveyId, ownerId };

  for (const [key, column] of Object.entries(UPDATABLE)) {
    if (data[key] === undefined) continue;
    sets.push(`${column} = @${key}`);
    if (key === 'expiresAt') {
      params[key] = data[key] ? new Date(data[key]) : null;
    } else if (key === 'anonymousResponses' || key === 'allowMultipleResponses') {
      params[key] = data[key] ? 1 : 0;
    } else {
      params[key] = data[key] ?? null;
    }
  }

  if (!sets.length) return findById(surveyId);

  sets.push('UpdatedAt = SYSUTCDATETIME()');
  const result = await query(
    `UPDATE dbo.Surveys SET ${sets.join(', ')}
     WHERE SurveyId = @surveyId AND OwnerId = @ownerId`,
    params,
  );
  if (result.rowsAffected[0] === 0) return null;
  return findById(surveyId);
}

export async function remove(surveyId, ownerId) {
  const result = await query(
    'DELETE FROM dbo.Surveys WHERE SurveyId = @surveyId AND OwnerId = @ownerId',
    { surveyId, ownerId },
  );
  return result.rowsAffected[0] > 0;
}

/** Throws when publishing a survey that has no questions. */
export async function questionCount(surveyId) {
  const { recordset } = await query(
    'SELECT COUNT(*) AS Total FROM dbo.Questions WHERE SurveyId = @surveyId',
    { surveyId },
  );
  return recordset[0].Total;
}

export async function duplicate(surveyId, ownerId) {
  const original = await findById(surveyId);
  if (!original) return null;

  const newId = await createSurvey(ownerId, {
    title: `${original.title} (Copy)`,
    description: original.description,
    category: original.category,
    status: 'draft',
    anonymousResponses: original.anonymousResponses,
    allowMultipleResponses: original.allowMultipleResponses,
    expiresAt: original.expiresAt,
  });

  await query(
    `INSERT INTO dbo.Questions (SurveyId, Type, Text, Required, Options, Settings, Position)
     SELECT @newId, Type, Text, Required, Options, Settings, Position
     FROM dbo.Questions WHERE SurveyId = @surveyId
     ORDER BY Position`,
    { newId, surveyId },
  );

  return findById(newId);
}