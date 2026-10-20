import Patient from '../models/patient.model.js';

function httpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function toResponse(record) {
  return {
    id: String(record._id),
    patientId: record.patientId,
    visitDate: record.visitDate,
    diagnosis: record.diagnosis,
    treatment: record.treatment,
    prescriptions: record.prescriptions || '',
    clinicalNotes: record.clinicalNotes || '',
    attendingPhysician: record.attendingPhysician,
    department: record.department,
    followUpDate: record.followUpDate || '',
    severity: record.severity,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function activeRecordFilter(id) {
  return { _id: id, archivedAt: null };
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function createMedicalRecordController(
  MedicalRecord,
  PatientModel = Patient
) {
  return {
    async list(req, res, next) {
      try {
        const { page, limit, patientId, from, to, search } = req.validatedQuery;
        const filter = { archivedAt: null };
        if (patientId) filter.patientId = patientId;
        if (from || to) {
          filter.visitDate = {};
          if (from) filter.visitDate.$gte = from;
          if (to) filter.visitDate.$lte = to;
        }
        if (search) {
          const expression = { $regex: escapeRegex(search), $options: 'i' };
          filter.$or = [
            { patientId: expression },
            { diagnosis: expression },
            { attendingPhysician: expression },
          ];
        }

        const [records, total] = await Promise.all([
          MedicalRecord.find(filter)
            .sort({ visitDate: -1, createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .lean()
            .exec(),
          MedicalRecord.countDocuments(filter),
        ]);

        return res.json({
          success: true,
          data: records.map(toResponse),
          pagination: { page, limit, total, pages: Math.ceil(total / limit) },
        });
      } catch (error) {
        return next(error);
      }
    },

    async get(req, res, next) {
      try {
        const record = await MedicalRecord.findOne(
          activeRecordFilter(req.params.id)
        )
          .lean()
          .exec();
        if (!record) throw httpError(404, 'Medical record not found');
        return res.json({ success: true, data: toResponse(record) });
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

        const record = await MedicalRecord.create({
          ...req.validatedBody,
          archivedAt: null,
        });
        return res.status(201).json({ success: true, data: toResponse(record) });
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

        const record = await MedicalRecord.findOneAndUpdate(
          activeRecordFilter(req.params.id),
          { $set: updates },
          { new: true, runValidators: true }
        )
          .lean()
          .exec();
        if (!record) throw httpError(404, 'Medical record not found');
        return res.json({ success: true, data: toResponse(record) });
      } catch (error) {
        return next(error);
      }
    },

    async archive(req, res, next) {
      try {
        const record = await MedicalRecord.findOneAndUpdate(
          activeRecordFilter(req.params.id),
          { $set: { archivedAt: new Date() } },
          { new: true }
        )
          .select('patientId')
          .lean()
          .exec();
        if (!record) throw httpError(404, 'Medical record not found');
        return res.json({ success: true, data: { id: String(record._id), archived: true } });
      } catch (error) {
        return next(error);
      }
    },
  };
}
