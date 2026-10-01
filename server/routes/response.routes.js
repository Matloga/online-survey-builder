import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import * as response from '../controllers/response.controller.js';

const router = Router({ mergeParams: true });

router.use(requireAuth);

router.get('/', response.listResponses);
router.get('/:responseId', response.getResponse);
router.delete('/:responseId', response.deleteResponse);

export default router;