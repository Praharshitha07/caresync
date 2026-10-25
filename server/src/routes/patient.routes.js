import { Router } from 'express';
import Patient from '../models/patient.model.js';
import Doctor from '../models/doctor.model.js';
import AuthSession from '../models/auth-session.model.js';
import AuditEvent from '../models/audit-event.model.js';
import { createPatientController } from '../controllers/patient.controller.js';
import {
  createRequireAuthentication,
  createRequireDoctorProfile,
} from '../middleware/auth.middleware.js';
import { createAuditedAuthorization } from '../middleware/audit.middleware.js';
import { validateRequest } from '../middleware/validate-request.middleware.js';
import {
  createPatientSchema,
  createReceptionistPatientSchema,
  listPatientsSchema,
  updateReceptionistPatientSchema,
  updatePatientSchema,
} from '../validation/patient.validation.js';

const authenticate = createRequireAuthentication(AuthSession);
const READ_ROLES = ['admin', 'doctor', 'clinician', 'nurse', 'records_staff', 'receptionist'];
const CREATE_ROLES = ['admin', 'doctor', 'clinician', 'nurse', 'receptionist'];
const UPDATE_ROLES = ['admin', 'doctor', 'clinician', 'nurse', 'receptionist'];

function validatePatientCreation(req, res, next) {
  const schema = req.auth.role === 'receptionist'
    ? createReceptionistPatientSchema
    : createPatientSchema;
  return validateRequest(schema, 'body', 'validatedBody')(req, res, next);
}

function validatePatientUpdate(req, res, next) {
  const schema = req.auth.role === 'receptionist'
    ? updateReceptionistPatientSchema
    : updatePatientSchema;
  return validateRequest(schema, 'body', 'validatedBody')(req, res, next);
}

export function createPatientRouter(
  PatientModel = Patient,
  {
    authenticate: authenticateRequest = authenticate,
    AuditModel = AuditEvent,
    DoctorModel = Doctor,
  } = {}
) {
  const router = Router();
  const controller = createPatientController(PatientModel, DoctorModel);

  router.use(authenticateRequest, createRequireDoctorProfile(DoctorModel));

  router.get(
    '/',
    createAuditedAuthorization(AuditModel, {
      roles: READ_ROLES,
      action: 'read_list',
      resource: 'patients',
    }),
    validateRequest(listPatientsSchema, 'query', 'validatedQuery'),
    controller.list
  );
  router.post(
    '/',
    createAuditedAuthorization(AuditModel, {
      roles: CREATE_ROLES,
      action: 'create',
      resource: 'patients',
    }),
    validatePatientCreation,
    controller.create
  );
  router.get(
    '/:id',
    createAuditedAuthorization(AuditModel, {
      roles: ['admin', 'doctor', 'clinician', 'nurse', 'records_staff', 'receptionist'],
      action: 'read_item',
      resource: 'patients',
    }),
    controller.get
  );
  router.patch(
    '/:id',
    createAuditedAuthorization(AuditModel, {
      roles: UPDATE_ROLES,
      action: 'update',
      resource: 'patients',
    }),
    validatePatientUpdate,
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
