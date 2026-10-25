import Patient from '../models/patient.model.js';
import Doctor from '../models/doctor.model.js';
import { isSeededDemoDoctor } from '../utils/doctor-profile.js';

function httpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function toResponse(
  appointment,
  patientName = `Patient ${appointment.patientId}`,
  doctorName = '',
  role = ''
) {
  return {
    id: String(appointment._id),
    patientId: appointment.patientId,
    patientName,
    date: appointment.date,
    time: appointment.time,
    reason: role === 'receptionist' ? 'Scheduled appointment' : appointment.reason,
    type: appointment.type,
    doctorId: appointment.doctor ? String(appointment.doctor) : '',
    assignedDoctor: doctorName || appointment.assignedDoctor,
    room: appointment.room || '',
    status: appointment.status,
    createdAt: appointment.createdAt,
    updatedAt: appointment.updatedAt,
  };
}

function activeAppointmentFilter(id) {
  return { _id: id, archivedAt: null };
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function createAppointmentController(
  Appointment,
  PatientModel = Patient,
  DoctorModel = Doctor
) {
  return {
    async list(req, res, next) {
      try {
        const { page, limit, patientId, status, from, to, search } = req.validatedQuery;
        const filter = { archivedAt: null };
        if (req.auth.role === 'doctor') filter.doctor = req.auth.doctorId;
        if (patientId) filter.patientId = patientId;
        if (status) filter.status = status;
        if (from || to) {
          filter.date = {};
          if (from) filter.date.$gte = from;
          if (to) filter.date.$lte = to;
        }
        if (search) {
          const expression = { $regex: escapeRegex(search), $options: 'i' };
          filter.$or = [
            { patientId: expression },
            { reason: expression },
            { assignedDoctor: expression },
            { type: expression },
          ];
        }

        const [appointments, total] = await Promise.all([
          Appointment.find(filter)
            .sort({ date: 1, time: 1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .lean()
            .exec(),
          Appointment.countDocuments(filter),
        ]);

        const patientIds = [...new Set(appointments.map(({ patientId: id }) => id))];
        const patientNames = patientIds.length
          ? await PatientModel.find({
              patientId: { $in: patientIds },
              archivedAt: null,
            })
              .select('patientId firstName lastName')
              .lean()
              .exec()
          : [];
        const namesByPatientId = new Map(
          patientNames.map((patient) => [
            patient.patientId,
            `${patient.firstName} ${patient.lastName}`,
          ])
        );
        const doctorIds = [...new Set(
          appointments.map(({ doctor }) => doctor && String(doctor)).filter(Boolean)
        )];
        const doctors = doctorIds.length
          ? await DoctorModel.find({ _id: { $in: doctorIds } })
              .select('name')
              .lean()
              .exec()
          : [];
        const namesByDoctorId = new Map(
          doctors.map((doctor) => [String(doctor._id), doctor.name])
        );

        return res.json({
          success: true,
          data: appointments.map((appointment) =>
            toResponse(
              appointment,
              namesByPatientId.get(appointment.patientId),
              namesByDoctorId.get(String(appointment.doctor)),
              req.auth.role
            )
          ),
          pagination: { page, limit, total, pages: Math.ceil(total / limit) },
        });
      } catch (error) {
        return next(error);
      }
    },

    async get(req, res, next) {
      try {
        const appointment = await Appointment.findOne(
          {
            ...activeAppointmentFilter(req.params.id),
            ...(req.auth.role === 'doctor' ? { doctor: req.auth.doctorId } : {}),
          }
        )
          .lean()
          .exec();
        if (!appointment) throw httpError(404, 'Appointment not found');
        const doctor = appointment.doctor
          ? await DoctorModel.findById(appointment.doctor).select('name').lean().exec()
          : null;
        return res.json({
          success: true,
          data: toResponse(appointment, undefined, doctor?.name, req.auth.role),
        });
      } catch (error) {
        return next(error);
      }
    },

    async create(req, res, next) {
      try {
        const patient = await PatientModel.findOne({
          patientId: req.validatedBody.patientId,
          archivedAt: null,
          ...(req.auth.role === 'doctor' ? { doctor: req.auth.doctorId } : {}),
        })
          .select('patientId')
          .lean()
          .exec();
        if (!patient) throw httpError(404, 'Active patient not found');

        const { doctorId, ...fields } = req.validatedBody;
        let doctor = null;
        if (req.auth.role === 'doctor' && doctorId !== req.auth.doctorId) {
          throw httpError(403, 'Doctors may schedule appointments only under their linked profile');
        }
        if (doctorId) {
          doctor = await DoctorModel.findOne({ _id: doctorId, active: true })
            .select('name professionalIdentifier')
            .lean()
            .exec();
          if (!doctor || isSeededDemoDoctor(doctor)) {
            throw httpError(400, 'Selected doctor is not active');
          }
          fields.assignedDoctor = doctor.name;
        }
        const appointment = await Appointment.create({
          ...fields,
          ...(doctorId ? { doctor: doctorId } : {}),
          status: 'Scheduled',
          archivedAt: null,
        });
        return res
          .status(201)
          .json({
            success: true,
            data: toResponse(appointment, undefined, doctor?.name, req.auth.role),
          });
      } catch (error) {
        return next(error);
      }
    },

    async update(req, res, next) {
      try {
        const updates = req.validatedBody;
        const { doctorId, ...fields } = updates;
        if (req.auth.role === 'doctor' && doctorId && doctorId !== req.auth.doctorId) {
          throw httpError(403, 'Doctors may assign appointments only to their linked profile');
        }
        if (updates.patientId) {
          const patient = await PatientModel.findOne({
            patientId: updates.patientId,
            archivedAt: null,
            ...(req.auth.role === 'doctor' ? { doctor: req.auth.doctorId } : {}),
          })
            .select('patientId')
            .lean()
            .exec();
          if (!patient) throw httpError(404, 'Active patient not found');
        }
        let doctor = null;
        if (doctorId) {
          doctor = await DoctorModel.findOne({ _id: doctorId, active: true })
            .select('name professionalIdentifier')
            .lean()
            .exec();
          if (!doctor || isSeededDemoDoctor(doctor)) {
            throw httpError(400, 'Selected doctor is not active');
          }
          fields.doctor = doctorId;
          fields.assignedDoctor = doctor.name;
        }

        const appointment = await Appointment.findOneAndUpdate(
          {
            ...activeAppointmentFilter(req.params.id),
            ...(req.auth.role === 'doctor' ? { doctor: req.auth.doctorId } : {}),
          },
          { $set: fields },
          { new: true, runValidators: true }
        )
          .lean()
          .exec();
        if (!appointment) throw httpError(404, 'Appointment not found');
        if (!doctor && appointment.doctor) {
          doctor = await DoctorModel.findById(appointment.doctor).select('name').lean().exec();
        }
        return res.json({
          success: true,
          data: toResponse(appointment, undefined, doctor?.name, req.auth.role),
        });
      } catch (error) {
        return next(error);
      }
    },

    async archive(req, res, next) {
      try {
        const appointment = await Appointment.findOneAndUpdate(
          activeAppointmentFilter(req.params.id),
          { $set: { archivedAt: new Date(), status: 'Cancelled' } },
          { new: true }
        )
          .lean()
          .exec();
        if (!appointment) throw httpError(404, 'Appointment not found');
        return res.json({
          success: true,
          data: { id: String(appointment._id), archived: true },
        });
      } catch (error) {
        return next(error);
      }
    },
  };
}
