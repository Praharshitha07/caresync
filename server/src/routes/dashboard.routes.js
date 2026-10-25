import { Router } from 'express';
import Patient from '../models/patient.model.js';
import Appointment from '../models/appointment.model.js';
import Doctor from '../models/doctor.model.js';
import AuthSession from '../models/auth-session.model.js';
import AuditEvent from '../models/audit-event.model.js';
import { createDashboardController } from '../controllers/dashboard.controller.js';
import {
  createRequireAuthentication,
  createRequireDoctorProfile,
} from '../middleware/auth.middleware.js';
import { createAuditedAuthorization } from '../middleware/audit.middleware.js';

const READ_ROLES = ['admin', 'doctor', 'clinician', 'nurse', 'records_staff'];

export function createDashboardRouter({
  PatientModel = Patient,
  AppointmentModel = Appointment,
  DoctorModel = Doctor,
  SessionModel = AuthSession,
  AuditModel = AuditEvent,
  authenticate = createRequireAuthentication(SessionModel),
} = {}) {
  const router = Router();
  const controller = createDashboardController({
    Patient: PatientModel,
    Appointment: AppointmentModel,
    Doctor: DoctorModel,
  });
  router.use(authenticate, createRequireDoctorProfile(DoctorModel));

  router.get(
    '/',
    createAuditedAuthorization(AuditModel, {
      roles: READ_ROLES,
      action: 'read_list',
      resource: 'dashboard',
    }),
    controller.getSummary
  );

  return router;
}

export default createDashboardRouter();
