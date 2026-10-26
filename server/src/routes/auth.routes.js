import { createHash, randomBytes } from 'node:crypto';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import { env } from '../config/env.js';
import AuditEvent from '../models/audit-event.model.js';
import AuthSession from '../models/auth-session.model.js';
import User from '../models/user.model.js';
import { createAuditedAuthorization } from '../middleware/audit.middleware.js';
import {
  createRequireAuthentication,
  getSessionCookieOptions,
  SESSION_COOKIE_NAME,
} from '../middleware/auth.middleware.js';
import { validateRequest } from '../middleware/validate-request.middleware.js';
import {
  changePasswordSchema,
  loginSchema,
  resetPasswordParamsSchema,
  resetPasswordSchema,
} from '../validation/auth.validation.js';

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
    doctorId: user.doctor ? String(user.doctor) : '',
  };
}

export function createAuthRouter({
  UserModel = User,
  SessionModel = AuthSession,
  AuditModel = AuditEvent,
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
  const resetPasswordLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: env.NODE_ENV === 'test' ? 100 : 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Too many password reset attempts. Try again later.' },
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
        ...getSessionCookieOptions(),
        maxAge: SESSION_TTL_MS,
      });
      return res.json({ success: true, data: { user: toPublicUser(user) } });
    } catch (error) {
      return next(error);
    }
  });

  router.patch(
    '/password',
    authenticate,
    resetPasswordLimiter,
    validateRequest(changePasswordSchema, 'body', 'validatedBody'),
    async (req, res, next) => {
      try {
        const { currentPassword, newPassword } = req.validatedBody;
        const user = await UserModel.findOne({
          _id: req.auth.userId,
          isActive: true,
        })
          .select('+passwordHash')
          .exec();

        if (!user) {
          return res.status(401).json({
            success: false,
            message: 'Authentication is required',
          });
        }

        const passwordMatches = await bcrypt.compare(currentPassword, user.passwordHash);
        if (!passwordMatches) {
          return res.status(400).json({
            success: false,
            message: 'Current password is incorrect',
          });
        }

        const passwordHash = await bcrypt.hash(newPassword, 12);
        const update = await UserModel.updateOne(
          {
            _id: user._id,
            isActive: true,
            passwordHash: user.passwordHash,
          },
          { $set: { passwordHash } }
        ).exec();

        if (update.matchedCount === 0) {
          return res.status(409).json({
            success: false,
            message: 'The password changed before this request completed. Sign in again.',
          });
        }

        await SessionModel.deleteMany({ userId: user._id });
        res.clearCookie(SESSION_COOKIE_NAME, getSessionCookieOptions());
        return res.json({
          success: true,
          message: 'Password changed successfully. Sign in again with your new password.',
        });
      } catch (error) {
        return next(error);
      }
    }
  );

  router.patch(
    '/users/:id/password',
    authenticate,
    resetPasswordLimiter,
    createAuditedAuthorization(AuditModel, {
      roles: ['admin'],
      action: 'reset_password',
      resource: 'users',
    }),
    validateRequest(resetPasswordParamsSchema, 'params', 'validatedParams'),
    validateRequest(resetPasswordSchema, 'body', 'validatedBody'),
    async (req, res, next) => {
      try {
        const { id } = req.validatedParams;
        const { newPassword } = req.validatedBody;
        const user = await UserModel.findOne({ _id: id })
          .select('_id isActive')
          .exec();

        if (!user) {
          return res.status(404).json({
            success: false,
            message: 'Staff account was not found',
          });
        }
        if (!user.isActive) {
          return res.status(409).json({
            success: false,
            message: 'Inactive staff accounts cannot have their password reset',
          });
        }

        const passwordHash = await bcrypt.hash(newPassword, 12);
        const update = await UserModel.updateOne(
          { _id: user._id, isActive: true },
          { $set: { passwordHash } }
        ).exec();

        if (update.matchedCount === 0) {
          const currentUser = await UserModel.findOne({ _id: id })
            .select('_id isActive')
            .exec();
          return res.status(currentUser ? 409 : 404).json({
            success: false,
            message: currentUser
              ? 'Inactive staff accounts cannot have their password reset'
              : 'Staff account was not found',
          });
        }

        await SessionModel.deleteMany({ userId: user._id });
        return res.json({
          success: true,
          message: 'Password reset successfully. The user must sign in again.',
        });
      } catch (error) {
        return next(error);
      }
    }
  );

  router.get('/session', authenticate, (req, res) =>
    res.json({
      success: true,
      data: {
        user: {
          id: req.auth.userId,
          email: req.auth.email,
          displayName: req.auth.displayName,
          role: req.auth.role,
          doctorId: req.auth.doctorId,
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

      res.clearCookie(SESSION_COOKIE_NAME, getSessionCookieOptions());
      return res.json({ success: true });
    } catch (error) {
      return next(error);
    }
  });

  return router;
}

export default createAuthRouter();
