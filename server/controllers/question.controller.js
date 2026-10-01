import { z } from 'zod';
import { asyncHandler, notFound, badRequest } from '../middleware/error.js';
import * as questionModel from '../models/question.model.js';
import { QUESTION_TYPES, TYPES_WITH_OPTIONS } from '../models/question.types.js';
import { ownedSurvey } from './survey.controller.js';

const optionList = z.array(z.string().trim().min(1).max(200)).min(2, 'Provide at least 2 options').max(50);

const baseQuestion = {
  text: z.string().trim().min(1, 'Question text is required').max(500),
  required: z.boolean().optional().default(false),
  settings: z
    .object({
      min: z.number().int().min(0).optional(),
      max: z.number().int().max(10).optional(),
      placeholder: z.string().max(200).optional(),
    })
    .optional(),
  position: z.number().int().min(0).optional(),
};

export const createQuestionSchema = z
  .object({
    type: z.enum(QUESTION_TYPES),
    options: optionList.optional(),
    ...baseQuestion,
  })
  .superRefine((value, ctx) => {
    // Option-bearing types must carry options; the others must not
    if (TYPES_WITH_OPTIONS.has(value.type) && !value.options?.length) {
      ctx.addIssue({
        code: 'custom',
        path: ['options'],
        message: `This question type needs at least 2 options`,
      });
    }
    if (value.type === 'rating' && value.settings) {
      const min = value.settings.min ?? 1;
      const max = value.settings.max ?? 5;
      if (max <= min) {
        ctx.addIssue({
          code: 'custom',
          path: ['settings', 'max'],
          message: 'Maximum rating must be greater than the minimum',
        });
      }
    }
  });

export const updateQuestionSchema = z
  .object({
    type: z.enum(QUESTION_TYPES).optional(),
    text: baseQuestion.text.optional(),
    required: z.boolean().optional(),
    options: z.array(z.string().trim().min(1).max(200)).max(50).optional(),
    settings: baseQuestion.settings,
    position: z.number().int().min(0).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'No fields to update' });

export const reorderSchema = z.object({
  questionIds: z.array(z.number().int().positive()).min(1, 'Provide the full ordering'),
});

/** Editing questions is only allowed while the survey is still a draft. */
async function editableSurvey(req) {
  const survey = await ownedSurvey(req);
  if (survey.status === 'published') {
    throw badRequest('This survey is live. Close it before editing questions.', {
      status: 'Close the survey to edit its questions',
    });
  }
  return survey;
}

export const list = asyncHandler(async (req, res) => {
  const survey = await ownedSurvey(req);
  res.json({ questions: await questionModel.listBySurvey(survey.id) });
});

export const create = asyncHandler(async (req, res) => {
  const survey = await editableSurvey(req);
  const question = await questionModel.create(survey.id, req.body);
  res.status(201).json({ question });
});

export const update = asyncHandler(async (req, res) => {
  const survey = await editableSurvey(req);
  const questionId = Number(req.params.questionId);

  const updated = await questionModel.update(questionId, survey.id, req.body);
  if (!updated) throw notFound('Question not found');

  // Changing type can invalidate stored options
  if (updated.options?.length && !TYPES_WITH_OPTIONS.has(updated.type)) {
    await questionModel.update(questionId, survey.id, { options: [] });
    updated.options = [];
  }

  res.json({ question: updated });
});

export const remove = asyncHandler(async (req, res) => {
  const survey = await editableSurvey(req);
  const deleted = await questionModel.remove(Number(req.params.questionId), survey.id);
  if (!deleted) throw notFound('Question not found');
  res.status(204).end();
});

export const reorder = asyncHandler(async (req, res) => {
  const survey = await editableSurvey(req);
  res.json({ questions: await questionModel.reorder(survey.id, req.body.questionIds) });
});