import crypto from 'node:crypto';
import { z } from 'zod';
import { asyncHandler, notFound, forbidden, badRequest } from '../middleware/error.js';
import { query } from '../db/pool.js';
import * as surveyModel from '../models/survey.model.js';
import * as questionModel from '../models/question.model.js';
import { SURVEY_STATUSES } from '../models/question.types.js';
import { getOwnerOverview } from '../services/analytics.service.js';

const isoDate = z
  .string()
  .refine((v) => !Number.isNaN(Date.parse(v)), 'Enter a valid date');

export const createSurveySchema = z.object({
  title: z.string().trim().min(3, 'Title must be at least 3 characters').max(200),
  description: z.string().trim().max(2000).optional().or(z.literal('')),
  category: z.string().trim().max(80).optional().or(z.literal('')),
  status: z.enum(SURVEY_STATUSES).optional(),
  anonymousResponses: z.boolean().optional(),
  allowMultipleResponses: z.boolean().optional(),
  expiresAt: isoDate.optional().nullable(),
});

export const updateSurveySchema = createSurveySchema.partial();

export const listSurveysSchema = z.object({
  search: z.string().trim().max(200).optional(),
  category: z.string().trim().max(80).optional(),
  status: z.enum(SURVEY_STATUSES).optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
  sort: z.enum(['createdAt', 'updatedAt', 'title', 'status', 'category', 'responses']).optional(),
  order: z.enum(['asc', 'desc']).optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
});

/** Load a survey the current user owns, or throw. */
async function ownedSurvey(req) {
  const surveyId = Number(req.params.id);
  const survey = await surveyModel.findById(surveyId);
  if (!survey) throw notFound('Survey not found');
  if (survey.ownerId !== Number(req.user.sub) && req.user.role !== 'admin') {
    throw forbidden();
  }
  return survey;
}

export const create = asyncHandler(async (req, res) => {
  const ownerId = Number(req.user.sub);
  const id = await surveyModel.createSurvey(ownerId, req.body);
  res.status(201).json({ survey: await surveyModel.findById(id) });
});

export const list = asyncHandler(async (req, res) => {
  const result = await surveyModel.listByOwner(Number(req.user.sub), req.validatedQuery);
  res.json(result);
});

export const overview = asyncHandler(async (req, res) => {
  res.json(await getOwnerOverview(Number(req.user.sub)));
});

export const categories = asyncHandler(async (req, res) => {
  res.json({ categories: await surveyModel.listCategories(Number(req.user.sub)) });
});

export const getOne = asyncHandler(async (req, res) => {
  const survey = await ownedSurvey(req);
  const questions = await questionModel.listBySurvey(survey.id);
  res.json({ survey, questions });
});

export const update = asyncHandler(async (req, res) => {
  const survey = await ownedSurvey(req);
  const updated = await surveyModel.update(survey.id, Number(req.user.sub), req.body);
  if (!updated) throw notFound('Survey not found');
  res.json({ survey: updated });
});

export const remove = asyncHandler(async (req, res) => {
  const survey = await ownedSurvey(req);
  const deleted = await surveyModel.remove(survey.id, Number(req.user.sub));
  if (!deleted) throw notFound('Survey not found');
  res.status(204).end();
});

export const duplicate = asyncHandler(async (req, res) => {
  const survey = await ownedSurvey(req);
  const copy = await surveyModel.duplicate(survey.id, Number(req.user.sub));
  if (!copy) throw notFound('Survey not found');
  res.status(201).json({ survey: copy });
});

/**
 * Status transitions. Publishing requires at least one question and an
 * expiration date that has not already passed.
 */
export const setStatus = asyncHandler(async (req, res) => {
  const survey = await ownedSurvey(req);
  const { status } = req.params;
  const next = status === 'reopen' ? 'published' : status;

  if (!SURVEY_STATUSES.includes(next)) {
    throw badRequest('Unknown status');
  }

  if (next === 'published') {
    const count = await surveyModel.questionCount(survey.id);
    if (count === 0) {
      throw badRequest('Add at least one question before publishing', {
        questions: 'A survey needs at least one question',
      });
    }
    if (survey.expiresAt && new Date(survey.expiresAt) <= new Date()) {
      throw badRequest('This survey has already expired. Update the expiration date first.', {
        expiresAt: 'Expiration date is in the past',
      });
    }
  }

  res.json({ survey: await surveyModel.update(survey.id, Number(req.user.sub), { status: next }) });
});

export const rotateShareToken = asyncHandler(async (req, res) => {
  const survey = await ownedSurvey(req);
  const token = crypto.randomBytes(16).toString('hex');
  await query('UPDATE dbo.Surveys SET ShareToken = @token, UpdatedAt = SYSUTCDATETIME() WHERE SurveyId = @surveyId', {
    token,
    surveyId: survey.id,
  });
  res.json({ survey: await surveyModel.findById(survey.id) });
});

export { ownedSurvey };