import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { surveyAnalytics } from '../controllers/analytics.controller.js';
import { exportResponses } from '../controllers/export.controller.js';

const router = Router({ mergeParams: true });

router.use(requireAuth);

router.get('/analytics', surveyAnalytics);
router.get('/export', exportResponses);

export default router;