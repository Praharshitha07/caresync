import { createHash, randomBytes } from 'node:crypto';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import { env } from '../config/env.js';
import AuthSession from '../models/auth-session.model.js';
import User from '../models/user.model.js';
import {
  createRequireAuthentication,
  SESSION_COOKIE_NAME,
  SESSION_COOKIE_OPTIONS,
} from '../middleware/auth.middleware.js';
import { loginSchema } from '../validation/auth.validation.js';

const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const DUMMY_PASSWORD_HASH = bcrypt.hashSync(randomBytes(32).toString('hex'), 12);

function validateLogin(req, res, next) {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: 'Request validation failed',
      errors: parsed.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      })),
    });
  }
  req.validatedBody = parsed.data;
  return next();
}

function toPublicUser(user) {
  return {
    id: String(user._id),
    email: user.email,
    displayName: user.displayName,
    role: user.role,
  };
}

export function createAuthRouter({
  UserModel = User,
  SessionModel = AuthSession,
  authenticate = createRequireAuthentication(SessionModel),
} = {}) {
  const router = Router();
  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: env.NODE_ENV === 'test' ? 100 : 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Too many login attempts. Try again later.' },
  });

  router.post('/login', loginLimiter, validateLogin, async (req, res, next) => {
    try {
      const { email, password } = req.validatedBody;
      const user = await UserModel.findOne({ email })
        .select('+passwordHash')
        .exec();
      const passwordMatches = await bcrypt.compare(
        password,
        user?.passwordHash || DUMMY_PASSWORD_HASH
      );

      if (!user || !user.isActive || !passwordMatches) {
        return res.status(401).json({
          success: false,
          message: 'Email or password is incorrect',
        });
      }

      const token = randomBytes(32).toString('base64url');
      await SessionModel.create({
        userId: user._id,
        tokenHash: createHash('sha256').update(token).digest('hex'),
        expiresAt: new Date(Date.now() + SESSION_TTL_MS),
      });

      res.cookie(SESSION_COOKIE_NAME, token, {
        ...SESSION_COOKIE_OPTIONS,
        maxAge: SESSION_TTL_MS,
      });
      return res.json({ success: true, data: { user: toPublicUser(user) } });
    } catch (error) {
      return next(error);
    }
  });

  router.get('/session', authenticate, (req, res) =>
    res.json({
      success: true,
      data: {
        user: {
          id: req.auth.userId,
          email: req.auth.email,
          displayName: req.auth.displayName,
          role: req.auth.role,
        },
      },
    })
  );

  router.post('/logout', async (req, res, next) => {
    try {
      const token = req.headers.cookie
        ?.split(';')
        .map((cookie) => cookie.trim())
        .find((cookie) => cookie.startsWith(`${SESSION_COOKIE_NAME}=`))
        ?.slice(SESSION_COOKIE_NAME.length + 1);

      if (token && /^[A-Za-z0-9_-]{43}$/.test(token)) {
        const tokenHash = createHash('sha256').update(token).digest('hex');
        await SessionModel.deleteOne({ tokenHash });
      }

      res.clearCookie(SESSION_COOKIE_NAME, SESSION_COOKIE_OPTIONS);
      return res.json({ success: true });
    } catch (error) {
      return next(error);
    }
  });

  return router;
}

export default createAuthRouter();
