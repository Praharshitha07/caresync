import { createHash } from 'node:crypto';
import { env } from '../config/env.js';
import Doctor from '../models/doctor.model.js';

export const SESSION_COOKIE_NAME = 'caresync_session';

export function getSessionCookieOptions(nodeEnvironment = env.NODE_ENV) {
  const isProduction = nodeEnvironment === 'production';
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'strict',
    path: '/api',
  };
}

function readSessionToken(req) {
  const cookies = req.headers.cookie?.split(';') || [];
  for (const cookie of cookies) {
    const separator = cookie.indexOf('=');
    if (separator === -1) continue;
    if (cookie.slice(0, separator).trim() === SESSION_COOKIE_NAME) {
      return cookie.slice(separator + 1).trim();
    }
  }
  return null;
}

function unauthorized(res) {
  res.clearCookie(SESSION_COOKIE_NAME, getSessionCookieOptions());
  return res.status(401).json({
    success: false,
    message: 'Authentication is required',
  });
}

export function createRequireAuthentication(SessionModel) {
  return async function requireAuthentication(req, res, next) {
    const token = readSessionToken(req);
    if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) {
      return unauthorized(res);
    }

    try {
      const tokenHash = createHash('sha256').update(token).digest('hex');
      const session = await SessionModel.findOne({
        tokenHash,
        expiresAt: { $gt: new Date() },
      })
        .populate('userId', 'email displayName role isActive doctor')
        .exec();

      if (!session?.userId?.isActive) return unauthorized(res);

      req.auth = {
        userId: String(session.userId._id),
        email: session.userId.email,
        displayName: session.userId.displayName,
        role: session.userId.role,
        doctorId: session.userId.doctor ? String(session.userId.doctor) : '',
      };

      if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
        const origin = req.get('origin');
        if (origin) {
          const allowedOrigins = env.CLIENT_URL.split(',').map((value) => value.trim());
          if (env.NODE_ENV === 'development') {
            allowedOrigins.push('http://localhost:3000', 'http://localhost:5173');
          }
          if (!allowedOrigins.includes(origin)) {
            return res.status(403).json({
              success: false,
              message: 'Request origin is not authorized',
            });
          }
        }
      }

      return next();
    } catch (error) {
      return next(error);
    }
  };
}

export function requireRoles(...roles) {
  return (req, res, next) => {
    if (!req.auth || !roles.includes(req.auth.role)) {
      return res.status(403).json({
        success: false,
        message: 'Your role is not authorized for this operation',
      });
    }

    return next();
  };
}

export function createRequireDoctorProfile(DoctorModel = Doctor) {
  return async function requireDoctorProfile(req, res, next) {
    if (req.auth?.role !== 'doctor') return next();
    if (!req.auth.doctorId) {
      return res.status(403).json({
        success: false,
        message: 'This doctor account is not linked to an active doctor profile',
      });
    }
    try {
      const doctor = await DoctorModel.findOne({
        _id: req.auth.doctorId,
        active: true,
      })
        .select('_id')
        .lean()
        .exec();
      if (!doctor) {
        return res.status(403).json({
          success: false,
          message: 'This doctor account is not linked to an active doctor profile',
        });
      }
      return next();
    } catch (error) {
      return next(error);
    }
  };
}
