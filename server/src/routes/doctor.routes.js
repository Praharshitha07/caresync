import { Router } from 'express';
import Doctor from '../models/doctor.model.js';
import AuthSession from '../models/auth-session.model.js';
import AuditEvent from '../models/audit-event.model.js';
import { createDoctorController } from '../controllers/doctor.controller.js';
import {
  createRequireAuthentication,
  createRequireDoctorProfile,
} from '../middleware/auth.middleware.js';
import { createAuditedAuthorization } from '../middleware/audit.middleware.js';
import { validateRequest } from '../middleware/validate-request.middleware.js';
import {
  createDoctorSchema,
  listDoctorsSchema,
  updateDoctorSchema,
} from '../validation/doctor.validation.js';

const READ_ROLES = ['admin', 'doctor', 'clinician', 'nurse', 'records_staff', 'receptionist'];

export function createDoctorRouter({
  DoctorModel = Doctor,
  SessionModel = AuthSession,
  AuditModel = AuditEvent,
  authenticate = createRequireAuthentication(SessionModel),
} = {}) {
  const router = Router();
  const controller = createDoctorController(DoctorModel);
  router.use(authenticate, createRequireDoctorProfile(DoctorModel));

  router.get(
    '/',
    createAuditedAuthorization(AuditModel, {
      roles: READ_ROLES,
      action: 'read_list',
      resource: 'doctors',
    }),
    validateRequest(listDoctorsSchema, 'query', 'validatedQuery'),
    controller.list
  );
  router.post(
    '/',
    createAuditedAuthorization(AuditModel, {
      roles: ['admin'],
      action: 'create',
      resource: 'doctors',
    }),
    validateRequest(createDoctorSchema, 'body', 'validatedBody'),
    controller.create
  );
  router.patch(
    '/:id',
    createAuditedAuthorization(AuditModel, {
      roles: ['admin'],
      action: 'update',
      resource: 'doctors',
    }),
    validateRequest(updateDoctorSchema, 'body', 'validatedBody'),
    controller.update
  );

  return router;
}

export default createDoctorRouter();
