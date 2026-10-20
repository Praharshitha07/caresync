import { Router } from 'express';
import MedicalRecord from '../models/medical-record.model.js';
import Patient from '../models/patient.model.js';
import AuthSession from '../models/auth-session.model.js';
import AuditEvent from '../models/audit-event.model.js';
import { createMedicalRecordController } from '../controllers/medical-record.controller.js';
import { createRequireAuthentication } from '../middleware/auth.middleware.js';
import { createAuditedAuthorization } from '../middleware/audit.middleware.js';
import { validateRequest } from '../middleware/validate-request.middleware.js';
import {
  createMedicalRecordSchema,
  listMedicalRecordsSchema,
  updateMedicalRecordSchema,
} from '../validation/clinical.validation.js';

const READ_ROLES = ['admin', 'clinician', 'nurse', 'records_staff'];
const WRITE_ROLES = ['admin', 'clinician', 'nurse'];

export function createMedicalRecordRouter({
  MedicalRecordModel = MedicalRecord,
  PatientModel = Patient,
  SessionModel = AuthSession,
  AuditModel = AuditEvent,
  authenticate = createRequireAuthentication(SessionModel),
} = {}) {
  const router = Router();
  const controller = createMedicalRecordController(
    MedicalRecordModel,
    PatientModel
  );

  router.get(
    '/',
    authenticate,
    createAuditedAuthorization(AuditModel, {
      roles: READ_ROLES,
      action: 'read_list',
      resource: 'medical_records',
    }),
    validateRequest(listMedicalRecordsSchema, 'query', 'validatedQuery'),
    controller.list
  );
  router.post(
    '/',
    authenticate,
    createAuditedAuthorization(AuditModel, {
      roles: WRITE_ROLES,
      action: 'create',
      resource: 'medical_records',
    }),
    validateRequest(createMedicalRecordSchema, 'body', 'validatedBody'),
    controller.create
  );
  router.get(
    '/:id',
    authenticate,
    createAuditedAuthorization(AuditModel, {
      roles: READ_ROLES,
      action: 'read_item',
      resource: 'medical_records',
    }),
    controller.get
  );
  router.patch(
    '/:id',
    authenticate,
    createAuditedAuthorization(AuditModel, {
      roles: WRITE_ROLES,
      action: 'update',
      resource: 'medical_records',
    }),
    validateRequest(updateMedicalRecordSchema, 'body', 'validatedBody'),
    controller.update
  );
  router.delete(
    '/:id',
    authenticate,
    createAuditedAuthorization(AuditModel, {
      roles: ['admin'],
      action: 'archive',
      resource: 'medical_records',
    }),
    controller.archive
  );

  return router;
}

export default createMedicalRecordRouter();
