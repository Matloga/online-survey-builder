import { z } from 'zod';
import { asyncHandler, notFound, badRequest, forbidden, conflict } from '../middleware/error.js';
import { guestKeyFor } from '../db/env.js';
import * as surveyModel from '../models/survey.model.js';
import * as questionModel from '../models/question.model.js';
import * as responseModel from '../models/response.model.js';
import { validateSubmission } from '../services/validateSubmission.js';
import { ownedSurvey } from './survey.controller.js';

export const submitSchema = z.object({
  answers: z
    .array(
      z.object({
        questionId: z.coerce.number().int().positive(),
        value: z.union([z.string(), z.number(), z.array(z.string()), z.null()]).optional(),
      }),
    )
    .min(1, 'Please answer at least one question'),
});

function clientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length) {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

/** Resolve a survey from the share token and confirm it accepts submissions. */
async function openSurvey(req) {
  const survey = await surveyModel.findByShareToken(req.params.token);
  if (!survey) throw notFound('This survey link is not valid');

  if (survey.status !== 'published') {
    throw forbidden('This survey is not currently accepting responses');
  }
  if (survey.expiresAt && new Date(survey.expiresAt) <= new Date()) {
    throw badRequest('This survey has expired and is no longer accepting responses');
  }
  return survey;
}

/** Public: fetch the survey definition for the response form. */
export const getPublicSurvey = asyncHandler(async (req, res) => {
  const survey = await openSurvey(req);
  const questions = await questionModel.listBySurvey(survey.id);

  if (!questions.length) {
    throw badRequest('This survey has no questions yet');
  }

  const alreadySubmitted = await responseModel.hasResponded(survey.id, {
    respondentId: req.user ? Number(req.user.sub) : null,
    guestKey: guestKeyFor(survey.id, clientIp(req), req.headers['user-agent']),
  });

  res.json({
    survey: {
      title: survey.title,
      description: survey.description,
      category: survey.category,
      expiresAt: survey.expiresAt,
      anonymousResponses: survey.anonymousResponses,
      allowMultipleResponses: survey.allowMultipleResponses,
    },
    questions,
    alreadySubmitted,
  });
});

/** Public: accept a submission. */
export const submitResponse = asyncHandler(async (req, res) => {
  const survey = await openSurvey(req);

  // Anonymous surveys never persist who submitted
  const respondentId = survey.anonymousResponses
    ? null
    : req.user
      ? Number(req.user.sub)
      : null;

  // Guests are deduplicated by a hash of survey + ip + user agent
  const guestKey =
    respondentId || survey.allowMultipleResponses
      ? null
      : guestKeyFor(survey.id, clientIp(req), req.headers['user-agent']);

  if (!survey.allowMultipleResponses) {
    const duplicate = await responseModel.hasResponded(survey.id, { respondentId, guestKey });
    if (duplicate) {
      throw conflict('You have already submitted a response for this survey');
    }
  }

  const questions = await questionModel.listBySurvey(survey.id);
  if (!questions.length) throw badRequest('This survey has no questions yet');

  const rows = validateSubmission(questions, req.body.answers);

  const responseId = await responseModel.create(survey, rows, {
    respondentId,
    guestKey,
    userAgent: req.headers['user-agent'],
  });

  res.status(201).json({
    message: 'Thank you, your response has been recorded',
    responseId,
  });
});

// ---------------- Owner-facing response management ----------------

export const listResponses = asyncHandler(async (req, res) => {
  const survey = await ownedSurvey(req);
  const page = Number(req.query.page) || 1;
  const pageSize = Math.min(Number(req.query.pageSize) || 25, 200);
  res.json(await responseModel.listBySurvey(survey.id, { page, pageSize }));
});

export const getResponse = asyncHandler(async (req, res) => {
  const survey = await ownedSurvey(req);
  const response = await responseModel.findById(Number(req.params.responseId));
  if (!response || response.surveyId !== survey.id) throw notFound('Response not found');
  res.json({ response });
});

export const deleteResponse = asyncHandler(async (req, res) => {
  const survey = await ownedSurvey(req);
  const deleted = await responseModel.remove(Number(req.params.responseId), survey.id);
  if (!deleted) throw notFound('Response not found');
  res.status(204).end();
});

export { openSurvey, clientIp };