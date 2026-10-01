import { query } from '../db/pool.js';

/**
 * Build the analytics payload for one survey.
 * Aggregations run in SQL so large surveys never load raw rows into Node.
 */
export async function getSurveyAnalytics(surveyId) {
  const [summary, trend, questionResults, ratingAgg, recentResponses] = await Promise.all([
    summaryStats(surveyId),
    responseTrend(surveyId),
    questionBreakdown(surveyId),
    ratingStats(surveyId),
    recentResponseSample(surveyId),
  ]);

  return {
    summary,
    trend,
    questions: questionResults,
    rating: ratingAgg,
    recentResponses,
  };
}

async function summaryStats(surveyId) {
  const { recordset } = await query(
    `SELECT
       (SELECT COUNT(*) FROM dbo.Responses r WHERE r.SurveyId = @surveyId) AS TotalResponses,
       (SELECT COUNT(*) FROM dbo.Questions q WHERE q.SurveyId = @surveyId) AS TotalQuestions,
       (SELECT COUNT(*) FROM dbo.Responses r WHERE r.SurveyId = @surveyId
          AND r.SubmittedAt >= DATEADD(DAY, -7, SYSUTCDATETIME())) AS ResponsesLast7Days,
       (SELECT COUNT(*) FROM dbo.Responses r WHERE r.SurveyId = @surveyId
          AND r.SubmittedAt >= DATEADD(DAY, -30, SYSUTCDATETIME())) AS ResponsesLast30Days,
       (SELECT MIN(r.SubmittedAt) FROM dbo.Responses r WHERE r.SurveyId = @surveyId) AS FirstResponseAt,
       (SELECT MAX(r.SubmittedAt) FROM dbo.Responses r WHERE r.SurveyId = @surveyId) AS LastResponseAt,
       -- Total answered question slots across all submissions
       (SELECT COUNT(*) FROM dbo.Answers a
         JOIN dbo.Responses r2 ON r2.ResponseId = a.ResponseId
         WHERE r2.SurveyId = @surveyId) AS TotalAnswered`,
    { surveyId },
  );

  const row = recordset[0];
  const possible = row.TotalResponses * row.TotalQuestions;
  const completionRate = possible
    ? Math.round((row.TotalAnswered / possible) * 10000) / 100
    : 0;

  return {
    totalResponses: row.TotalResponses,
    totalQuestions: row.TotalQuestions,
    responsesLast7Days: row.ResponsesLast7Days,
    responsesLast30Days: row.ResponsesLast30Days,
    firstResponseAt: row.FirstResponseAt,
    lastResponseAt: row.LastResponseAt,
    // Share of question slots that were actually answered
    completionRate,
  };
}

async function responseTrend(surveyId) {
  const { recordset } = await query(
    `SELECT CAST(r.SubmittedAt AS DATE) AS Day, COUNT(*) AS Count
     FROM dbo.Responses r
     WHERE r.SurveyId = @surveyId
       AND r.SubmittedAt >= DATEADD(DAY, -30, SYSUTCDATETIME())
     GROUP BY CAST(r.SubmittedAt AS DATE)
     ORDER BY Day`,
    { surveyId },
  );
  return recordset.map((r) => ({
    date: r.Day instanceof Date ? r.Day.toISOString().slice(0, 10) : r.Day,
    count: r.Count,
  }));
}

/**
 * One row per question with a pre-aggregated result set the client can chart.
 */
async function questionBreakdown(surveyId) {
  const { recordset: questions } = await query(
    `SELECT QuestionId, Type, Text, Required
     FROM dbo.Questions WHERE SurveyId = @surveyId
     ORDER BY Position, QuestionId`,
    { surveyId },
  );

  const results = [];
  for (const q of questions) {
    const answered = await answerCount(surveyId, q.QuestionId);

    if (['multiple-choice', 'checkboxes', 'dropdown', 'yes-no'].includes(q.Type)) {
      results.push({
        questionId: q.QuestionId,
        text: q.Text,
        type: q.Type,
        required: !!q.Required,
        answered,
        breakdown: await choiceBreakdown(surveyId, q),
      });
    } else if (q.Type === 'rating') {
      const { recordset } = await query(
        `SELECT a.ValueNumber AS Value, COUNT(*) AS Count
         FROM dbo.Answers a
         WHERE a.QuestionId = @questionId AND a.ValueNumber IS NOT NULL
         GROUP BY a.ValueNumber ORDER BY a.ValueNumber`,
        { questionId: q.QuestionId },
      );
      results.push({
        questionId: q.QuestionId,
        text: q.Text,
        type: q.Type,
        required: !!q.Required,
        answered,
        average: averageOf(recordset),
        breakdown: recordset.map((r) => ({ label: String(r.Value), count: r.Count })),
      });
    } else {
      const { recordset } = await query(
        `SELECT TOP (5) a.ValueText AS Value, COUNT(*) AS Count
         FROM dbo.Answers a
         WHERE a.QuestionId = @questionId AND a.ValueText IS NOT NULL
         GROUP BY a.ValueText
         ORDER BY COUNT(*) DESC`,
        { questionId: q.QuestionId },
      );
      results.push({
        questionId: q.QuestionId,
        text: q.Text,
        type: q.Type,
        required: !!q.Required,
        answered,
        breakdown: recordset.map((r) => ({
          label: truncate(r.Value, 60),
          count: r.Count,
        })),
      });
    }
  }
  return results;
}

async function answerCount(surveyId, questionId) {
  const { recordset } = await query(
    `SELECT COUNT(*) AS Total
     FROM dbo.Answers a
     JOIN dbo.Responses r ON r.ResponseId = a.ResponseId
     WHERE r.SurveyId = @surveyId AND a.QuestionId = @questionId`,
    { surveyId, questionId },
  );
  return recordset[0].Total;
}

/**
 * Choice questions: multiple-choice/dropdown/yes-no are single-valued,
 * checkboxes are JSON arrays that need unnesting via OPENJSON.
 */
async function choiceBreakdown(surveyId, question) {
  if (question.Type === 'checkboxes') {
    const { recordset } = await query(
      `SELECT CAST(j.value AS NVARCHAR(400)) AS Label, COUNT(*) AS Count
       FROM dbo.Answers a
       JOIN dbo.Responses r ON r.ResponseId = a.ResponseId
       CROSS APPLY OPENJSON(ISNULL(a.ValueJson, '[]')) WITH (value NVARCHAR(400) '$.value') AS j
       WHERE r.SurveyId = @surveyId AND a.QuestionId = @questionId
       GROUP BY CAST(j.value AS NVARCHAR(400))
       ORDER BY COUNT(*) DESC`,
      { surveyId, questionId: question.QuestionId },
    );
    return recordset.map((r) => ({ label: r.Label, count: r.Count }));
  }

  const { recordset } = await query(
    `SELECT a.ValueText AS Label, COUNT(*) AS Count
     FROM dbo.Answers a
     JOIN dbo.Responses r ON r.ResponseId = a.ResponseId
     WHERE r.SurveyId = @surveyId AND a.QuestionId = @questionId
       AND a.ValueText IS NOT NULL
     GROUP BY a.ValueText
     ORDER BY COUNT(*) DESC, a.ValueText`,
    { surveyId, questionId: question.QuestionId },
  );
  return recordset.map((r) => ({ label: r.Label, count: r.Count }));
}

async function ratingStats(surveyId) {
  const { recordset } = await query(
    `SELECT AVG(a.ValueNumber) AS AvgRating, COUNT(*) AS RatingCount
     FROM dbo.Answers a
     JOIN dbo.Responses r ON r.ResponseId = a.ResponseId
     JOIN dbo.Questions q ON q.QuestionId = a.QuestionId
     WHERE r.SurveyId = @surveyId AND q.Type = 'rating' AND a.ValueNumber IS NOT NULL`,
    { surveyId },
  );
  const row = recordset[0];
  return {
    average: row.RatingCount ? Math.round(row.AvgRating * 100) / 100 : null,
    count: row.RatingCount,
  };
}

async function recentResponseSample(surveyId) {
  const { recordset } = await query(
    `SELECT TOP (5) r.ResponseId, r.SubmittedAt, u.Email AS RespondentEmail,
            (SELECT COUNT(*) FROM dbo.Answers a WHERE a.ResponseId = r.ResponseId) AS AnswerCount
     FROM dbo.Responses r
     LEFT JOIN dbo.Users u ON u.UserId = r.RespondentId
     WHERE r.SurveyId = @surveyId
     ORDER BY r.SubmittedAt DESC, r.ResponseId DESC`,
    { surveyId },
  );
  return recordset.map((r) => ({
    id: r.ResponseId,
    submittedAt: r.SubmittedAt,
    respondentEmail: r.RespondentEmail,
    answerCount: r.AnswerCount,
  }));
}

function averageOf(recordset) {
  if (!recordset.length) return null;
  const sum = recordset.reduce((acc, r) => acc + r.Value * r.Count, 0);
  const count = recordset.reduce((acc, r) => acc + r.Count, 0);
  return count ? Math.round((sum / count) * 100) / 100 : null;
}

function truncate(value, max) {
  const s = String(value);
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

/** Cross-survey rollup for the owner's dashboard. */
export async function getOwnerOverview(ownerId) {
  const { recordset } = await query(
    `SELECT
       COUNT(*) AS TotalSurveys,
       SUM(CASE WHEN s.Status = 'published' THEN 1 ELSE 0 END) AS PublishedSurveys,
       SUM(CASE WHEN s.Status = 'draft' THEN 1 ELSE 0 END) AS DraftSurveys,
       SUM(CASE WHEN s.Status = 'closed' THEN 1 ELSE 0 END) AS ClosedSurveys,
       (SELECT COUNT(*) FROM dbo.Responses r
         JOIN dbo.Surveys s2 ON s2.SurveyId = r.SurveyId
         WHERE s2.OwnerId = @ownerId) AS TotalResponses,
       (SELECT COUNT(*) FROM dbo.Responses r
         JOIN dbo.Surveys s2 ON s2.SurveyId = r.SurveyId
         WHERE s2.OwnerId = @ownerId
           AND r.SubmittedAt >= DATEADD(DAY, -7, SYSUTCDATETIME())) AS ResponsesLast7Days
     FROM dbo.Surveys s
     WHERE s.OwnerId = @ownerId`,
    { ownerId },
  );

  const row = recordset[0];
  const { recordset: byCategory } = await query(
    `SELECT ISNULL(s.Category, 'Uncategorised') AS Category, COUNT(*) AS Count
     FROM dbo.Surveys s WHERE s.OwnerId = @ownerId
     GROUP BY ISNULL(s.Category, 'Uncategorised')
     ORDER BY COUNT(*) DESC`,
    { ownerId },
  );

  const { recordset: trend } = await query(
    `SELECT CAST(r.SubmittedAt AS DATE) AS Day, COUNT(*) AS Count
     FROM dbo.Responses r
     JOIN dbo.Surveys s ON s.SurveyId = r.SurveyId
     WHERE s.OwnerId = @ownerId
       AND r.SubmittedAt >= DATEADD(DAY, -30, SYSUTCDATETIME())
     GROUP BY CAST(r.SubmittedAt AS DATE)
     ORDER BY Day`,
    { ownerId },
  );

  return {
    totalSurveys: row.TotalSurveys || 0,
    publishedSurveys: row.PublishedSurveys || 0,
    draftSurveys: row.DraftSurveys || 0,
    closedSurveys: row.ClosedSurveys || 0,
    totalResponses: row.TotalResponses || 0,
    responsesLast7Days: row.ResponsesLast7Days || 0,
    byCategory: byCategory.map((r) => ({ category: r.Category, count: r.Count })),
    trend: trend.map((r) => ({
      date: r.Day instanceof Date ? r.Day.toISOString().slice(0, 10) : r.Day,
      count: r.Count,
    })),
  };
}