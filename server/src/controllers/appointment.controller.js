import Patient from '../models/patient.model.js';

function httpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function toResponse(appointment, patientName = `Patient ${appointment.patientId}`) {
  return {
    id: String(appointment._id),
    patientId: appointment.patientId,
    patientName,
    date: appointment.date,
    time: appointment.time,
    reason: appointment.reason,
    type: appointment.type,
    assignedDoctor: appointment.assignedDoctor,
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
  PatientModel = Patient
) {
  return {
    async list(req, res, next) {
      try {
        const { page, limit, patientId, status, from, to, search } = req.validatedQuery;
        const filter = { archivedAt: null };
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

        return res.json({
          success: true,
          data: appointments.map((appointment) =>
            toResponse(appointment, namesByPatientId.get(appointment.patientId))
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
          activeAppointmentFilter(req.params.id)
        )
          .lean()
          .exec();
        if (!appointment) throw httpError(404, 'Appointment not found');
        return res.json({ success: true, data: toResponse(appointment) });
      } catch (error) {
        return next(error);
      }
    },

    async create(req, res, next) {
      try {
        const patient = await PatientModel.findOne({
          patientId: req.validatedBody.patientId,
          archivedAt: null,
        })
          .select('patientId')
          .lean()
          .exec();
        if (!patient) throw httpError(404, 'Active patient not found');

        const appointment = await Appointment.create({
          ...req.validatedBody,
          status: 'Scheduled',
          archivedAt: null,
        });
        return res
          .status(201)
          .json({ success: true, data: toResponse(appointment) });
      } catch (error) {
        return next(error);
      }
    },

    async update(req, res, next) {
      try {
        const updates = req.validatedBody;
        if (updates.patientId) {
          const patient = await PatientModel.findOne({
            patientId: updates.patientId,
            archivedAt: null,
          })
            .select('patientId')
            .lean()
            .exec();
          if (!patient) throw httpError(404, 'Active patient not found');
        }

        const appointment = await Appointment.findOneAndUpdate(
          activeAppointmentFilter(req.params.id),
          { $set: updates },
          { new: true, runValidators: true }
        )
          .lean()
          .exec();
        if (!appointment) throw httpError(404, 'Appointment not found');
        return res.json({ success: true, data: toResponse(appointment) });
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
