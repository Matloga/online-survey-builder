import { asyncHandler, badRequest } from '../middleware/error.js';
import * as questionModel from '../models/question.model.js';
import * as responseModel from '../models/response.model.js';
import { getSurveyAnalytics } from '../services/analytics.service.js';
import { responsesToCsv, responsesToExcel, responsesToPdf } from '../services/export.service.js';
import { ownedSurvey } from './survey.controller.js';

const FORMATS = new Set(['csv', 'excel', 'pdf']);

const EXTENSIONS = { csv: 'csv', excel: 'xlsx', pdf: 'pdf' };
const MIME = {
  csv: 'text/csv; charset=utf-8',
  excel: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pdf: 'application/pdf',
};

export const exportResponses = asyncHandler(async (req, res) => {
  const format = String(req.query.format || 'csv').toLowerCase();
  if (!FORMATS.has(format)) {
    throw badRequest(`Unsupported export format: ${format}`);
  }

  const survey = await ownedSurvey(req);
  const [questions, responses] = await Promise.all([
    questionModel.listBySurvey(survey.id),
    responseModel.listAllForExport(survey.id),
  ]);

  if (!responses.length) {
    throw badRequest('There are no responses to export yet');
  }

  const filename = `survey-${survey.id}-responses.${EXTENSIONS[format]}`;
  res.setHeader('Content-Type', MIME[format]);
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

  if (format === 'csv') {
    return res.send(responsesToCsv(survey, questions, responses));
  }

  if (format === 'excel') {
    const buffer = await responsesToExcel(survey, questions, responses);
    return res.send(Buffer.from(buffer));
  }

  const analytics = await getSurveyAnalytics(survey.id);
  const doc = responsesToPdf(survey, questions, responses, analytics);
  doc.pipe(res);
  return undefined;
});