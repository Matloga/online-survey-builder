import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import * as question from '../controllers/question.controller.js';

const router = Router({ mergeParams: true });

router.use(requireAuth);

router.get('/', question.list);
router.post('/', validate(question.createQuestionSchema), question.create);
router.put('/reorder', validate(question.reorderSchema), question.reorder);
router.patch('/:questionId', validate(question.updateQuestionSchema), question.update);
router.delete('/:questionId', question.remove);

export default router;