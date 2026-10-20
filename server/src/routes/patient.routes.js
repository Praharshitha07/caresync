import { Router } from 'express';
import Patient from '../models/patient.model.js';
import AuthSession from '../models/auth-session.model.js';
import AuditEvent from '../models/audit-event.model.js';
import { createPatientController } from '../controllers/patient.controller.js';
import { createRequireAuthentication } from '../middleware/auth.middleware.js';
import { createAuditedAuthorization } from '../middleware/audit.middleware.js';
import { validateRequest } from '../middleware/validate-request.middleware.js';
import {
  createPatientSchema,
  listPatientsSchema,
  updatePatientSchema,
} from '../validation/patient.validation.js';

const authenticate = createRequireAuthentication(AuthSession);

export function createPatientRouter(
  PatientModel = Patient,
  {
    authenticate: authenticateRequest = authenticate,
    AuditModel = AuditEvent,
  } = {}
) {
  const router = Router();
  const controller = createPatientController(PatientModel);

  router.use(authenticateRequest);

  router.get(
    '/',
    createAuditedAuthorization(AuditModel, {
      roles: ['admin', 'clinician', 'nurse', 'records_staff'],
      action: 'read_list',
      resource: 'patients',
    }),
    validateRequest(listPatientsSchema, 'query', 'validatedQuery'),
    controller.list
  );
  router.post(
    '/',
    createAuditedAuthorization(AuditModel, {
      roles: ['admin', 'clinician', 'nurse'],
      action: 'create',
      resource: 'patients',
    }),
    validateRequest(createPatientSchema, 'body', 'validatedBody'),
    controller.create
  );
  router.get(
    '/:id',
    createAuditedAuthorization(AuditModel, {
      roles: ['admin', 'clinician', 'nurse', 'records_staff'],
      action: 'read_item',
      resource: 'patients',
    }),
    controller.get
  );
  router.patch(
    '/:id',
    createAuditedAuthorization(AuditModel, {
      roles: ['admin', 'clinician', 'nurse'],
      action: 'update',
      resource: 'patients',
    }),
    validateRequest(updatePatientSchema, 'body', 'validatedBody'),
    controller.update
  );
  router.delete(
    '/:id',
    createAuditedAuthorization(AuditModel, {
      roles: ['admin'],
      action: 'archive',
      resource: 'patients',
    }),
    controller.archive
  );

  return router;
}

export default createPatientRouter();
