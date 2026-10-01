import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import * as survey from '../controllers/survey.controller.js';

const router = Router();

router.use(requireAuth);

router.get('/overview', survey.overview);
router.get('/categories', survey.categories);

router.get('/', validate(survey.listSurveysSchema, 'query'), survey.list);
router.post('/', validate(survey.createSurveySchema), survey.create);

router.get('/:id', survey.getOne);
router.patch('/:id', validate(survey.updateSurveySchema), survey.update);
router.delete('/:id', survey.remove);
router.post('/:id/duplicate', survey.duplicate);
router.post('/:id/status/:status', survey.setStatus);
router.post('/:id/share-token', survey.rotateShareToken);

export default router;