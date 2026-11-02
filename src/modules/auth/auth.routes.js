import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { env } from '#config/env.js';
import { validate } from '#shared/middlewares/validate.middleware.js';
import { authController as c } from './auth.controller.js';
import { authenticate } from './auth.middleware.js';
import { changePasswordSchema, loginSchema } from './auth.validation.js';

// Slows down password guessing: few login attempts per IP per window.
const loginLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  limit: env.LOGIN_RATE_LIMIT_MAX,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  skip: () => env.isTest,
  message: { success: false, message: 'Too many login attempts. Please wait and try again.' },
});

const router = Router();

router.post('/login', loginLimiter, validate({ body: loginSchema }), c.login);
router.get('/me', authenticate, c.me);
// Allowed for read-only users too, so it sits outside the read-only guard.
router.post(
  '/change-password',
  authenticate,
  validate({ body: changePasswordSchema }),
  c.changePassword,
);

export default router;
