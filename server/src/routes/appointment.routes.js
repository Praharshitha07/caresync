import { Router } from 'express';
import Appointment from '../models/appointment.model.js';
import Patient from '../models/patient.model.js';
import Doctor from '../models/doctor.model.js';
import AuthSession from '../models/auth-session.model.js';
import AuditEvent from '../models/audit-event.model.js';
import { createAppointmentController } from '../controllers/appointment.controller.js';
import {
  createRequireAuthentication,
  createRequireDoctorProfile,
} from '../middleware/auth.middleware.js';
import { createAuditedAuthorization } from '../middleware/audit.middleware.js';
import { validateRequest } from '../middleware/validate-request.middleware.js';
import {
  createAppointmentSchema,
  listAppointmentsSchema,
  updateAppointmentSchema,
} from '../validation/clinical.validation.js';

const READ_ROLES = ['admin', 'doctor', 'clinician', 'nurse', 'records_staff', 'receptionist'];
const SCHEDULE_ROLES = ['admin', 'doctor', 'clinician', 'nurse', 'records_staff', 'receptionist'];
const UPDATE_ROLES = ['admin', 'doctor', 'clinician', 'nurse'];

export function createAppointmentRouter({
  AppointmentModel = Appointment,
  PatientModel = Patient,
  DoctorModel = Doctor,
  SessionModel = AuthSession,
  AuditModel = AuditEvent,
  authenticate = createRequireAuthentication(SessionModel),
} = {}) {
  const router = Router();
  const controller = createAppointmentController(
    AppointmentModel,
    PatientModel,
    DoctorModel
  );
  router.use(authenticate, createRequireDoctorProfile(DoctorModel));

  router.get(
    '/',
    createAuditedAuthorization(AuditModel, {
      roles: READ_ROLES,
      action: 'read_list',
      resource: 'appointments',
    }),
    validateRequest(listAppointmentsSchema, 'query', 'validatedQuery'),
    controller.list
  );
  router.post(
    '/',
    createAuditedAuthorization(AuditModel, {
      roles: SCHEDULE_ROLES,
      action: 'create',
      resource: 'appointments',
    }),
    validateRequest(createAppointmentSchema, 'body', 'validatedBody'),
    controller.create
  );
  router.get(
    '/:id',
    createAuditedAuthorization(AuditModel, {
      roles: READ_ROLES,
      action: 'read_item',
      resource: 'appointments',
    }),
    controller.get
  );
  router.patch(
    '/:id',
    createAuditedAuthorization(AuditModel, {
      roles: UPDATE_ROLES,
      action: 'update',
      resource: 'appointments',
    }),
    validateRequest(updateAppointmentSchema, 'body', 'validatedBody'),
    controller.update
  );
  router.delete(
    '/:id',
    createAuditedAuthorization(AuditModel, {
      roles: ['admin'],
      action: 'archive',
      resource: 'appointments',
    }),
    controller.archive
  );

  return router;
}

export default createAppointmentRouter();
