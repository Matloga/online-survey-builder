import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import * as auth from '../controllers/auth.controller.js';

const router = Router();

router.post('/register', validate(auth.registerSchema), auth.register);
router.post('/login', validate(auth.loginSchema), auth.login);
router.get('/me', requireAuth, auth.me);
router.put('/profile', requireAuth, validate(auth.updateProfileSchema), auth.updateProfile);
router.put('/password', requireAuth, validate(auth.changePasswordSchema), auth.changePassword);
router.post('/logout', requireAuth, (_req, res) => res.json({ message: 'Logged out' }));

export default router;