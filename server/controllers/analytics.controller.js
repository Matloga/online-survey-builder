import { asyncHandler } from '../middleware/error.js';
import { getSurveyAnalytics } from '../services/analytics.service.js';
import { ownedSurvey } from './survey.controller.js';

export const surveyAnalytics = asyncHandler(async (req, res) => {
  const survey = await ownedSurvey(req);
  res.json(await getSurveyAnalytics(survey.id));
});