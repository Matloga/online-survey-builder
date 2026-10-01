import { Router } from 'express';
import authRoutes from './auth.routes.js';
import surveyRoutes from './survey.routes.js';
import questionRoutes from './question.routes.js';
import responseRoutes from './response.routes.js';
import analyticsRoutes from './analytics.routes.js';
import publicRoutes from './public.routes.js';

const router = Router();

router.get('/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// Public survey links
router.use('/public/surveys', publicRoutes);

// Authenticated owner resources
router.use('/auth', authRoutes);
router.use('/surveys', surveyRoutes);
router.use('/surveys/:surveyId/questions', questionRoutes);
router.use('/surveys/:surveyId/responses', responseRoutes);
router.use('/surveys/:surveyId', analyticsRoutes);

export default router;