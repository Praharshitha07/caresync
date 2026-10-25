import { Router } from 'express';
import User from '../models/user.model.js';
import Doctor from '../models/doctor.model.js';
import AuthSession from '../models/auth-session.model.js';
import AuditEvent from '../models/audit-event.model.js';
import { createStaffController } from '../controllers/staff.controller.js';
import { createRequireAuthentication } from '../middleware/auth.middleware.js';
import { createAuditedAuthorization } from '../middleware/audit.middleware.js';
import { validateRequest } from '../middleware/validate-request.middleware.js';
import {
  createStaffSchema,
  updateStaffStatusParamsSchema,
  updateStaffStatusSchema,
} from '../validation/staff.validation.js';

export function createStaffRouter({
  UserModel = User,
  DoctorModel = Doctor,
  SessionModel = AuthSession,
  AuditModel = AuditEvent,
  authenticate = createRequireAuthentication(SessionModel),
  runTransaction,
} = {}) {
  const router = Router();
  const controller = createStaffController(
    UserModel,
    DoctorModel,
    SessionModel,
    runTransaction
  );
  const requireAdmin = (action) =>
    createAuditedAuthorization(AuditModel, {
      roles: ['admin'],
      action,
      resource: 'users',
    });

  router.get('/', authenticate, requireAdmin('read_list'), controller.list);
  router.post(
    '/',
    authenticate,
    requireAdmin('create'),
    validateRequest(createStaffSchema, 'body', 'validatedBody'),
    controller.create
  );
  router.patch(
    '/:id/status',
    authenticate,
    requireAdmin('update'),
    validateRequest(updateStaffStatusParamsSchema, 'params', 'validatedParams'),
    validateRequest(updateStaffStatusSchema, 'body', 'validatedBody'),
    controller.updateStatus
  );
  return router;
}

export default createStaffRouter();
