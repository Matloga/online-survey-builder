import { Router } from 'express';
import { optionalAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import * as response from '../controllers/response.controller.js';

const router = Router();

router.get('/:token', optionalAuth, response.getPublicSurvey);
router.post('/:token/responses', optionalAuth, validate(response.submitSchema), response.submitResponse);

export default router;