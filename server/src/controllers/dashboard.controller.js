import { toPatientResponse } from './patient.controller.js';

const UPCOMING_STATUSES = ['Scheduled', 'Confirmed'];
const TODAY_STATUSES = ['Scheduled', 'Confirmed', 'In Progress'];

export function createDashboardController({ Patient, Appointment, Doctor }) {
  return {
    async getSummary(req, res, next) {
      try {
        const now = new Date();
        const today = now.toISOString().slice(0, 10);
        const recentSince = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const activePatients = {
          archivedAt: null,
          ...(req.auth.role === 'doctor' ? { doctor: req.auth.doctorId } : {}),
        };
        const activeAppointments = {
          archivedAt: null,
          ...(req.auth.role === 'doctor' ? { doctor: req.auth.doctorId } : {}),
        };
        const [totalPatients, todayAppointments, upcomingAppointments, recentlyAddedPatients, patients, appointments] =
          await Promise.all([
            Patient.countDocuments(activePatients),
            Appointment.countDocuments({
              ...activeAppointments,
              date: today,
              status: { $in: TODAY_STATUSES },
            }),
            Appointment.countDocuments({
              ...activeAppointments,
              date: { $gte: today },
              status: { $in: UPCOMING_STATUSES },
            }),
            Patient.countDocuments({
              ...activePatients,
              createdAt: { $gte: recentSince },
            }),
            Patient.find(activePatients)
              .select('patientId firstName lastName dob gender phone email status doctor primaryPhysician createdAt updatedAt')
              .sort({ createdAt: -1 })
              .limit(5)
              .lean()
              .exec(),
            Appointment.find({
              ...activeAppointments,
              date: { $gte: today },
              status: { $in: UPCOMING_STATUSES },
            })
              .sort({ date: 1, time: 1 })
              .limit(5)
              .lean()
              .exec(),
          ]);

        const doctorIds = [...new Set(patients.map(({ doctor }) => doctor && String(doctor)).filter(Boolean))];
        const doctors = doctorIds.length
          ? await Doctor.find({ _id: { $in: doctorIds } }).select('name').lean().exec()
          : [];
        const doctorNames = new Map(doctors.map((doctor) => [String(doctor._id), doctor.name]));

        const patientIds = [...new Set(appointments.map(({ patientId }) => patientId))];
        const appointmentPatients = patientIds.length
          ? await Patient.find({ patientId: { $in: patientIds }, archivedAt: null })
              .select('patientId firstName lastName')
              .lean()
              .exec()
          : [];
        const patientNames = new Map(
          appointmentPatients.map((patient) => [
            patient.patientId,
            `${patient.firstName} ${patient.lastName}`,
          ])
        );

        return res.json({
          success: true,
          data: {
            stats: {
              totalPatients,
              todayAppointments,
              upcomingAppointments,
              recentlyAddedPatients,
            },
            recentPatients: patients.map((patient) =>
              toPatientResponse(patient, {
                summary: true,
                doctorName: doctorNames.get(String(patient.doctor)) || '',
              })
            ),
            upcomingAppointments: appointments.map((appointment) => ({
              id: String(appointment._id),
              patientId: appointment.patientId,
              patientName: patientNames.get(appointment.patientId) || `Patient ${appointment.patientId}`,
              date: appointment.date,
              time: appointment.time,
              reason: appointment.reason,
              type: appointment.type,
              status: appointment.status,
            })),
          },
        });
      } catch (error) {
        return next(error);
      }
    },
  };
}
