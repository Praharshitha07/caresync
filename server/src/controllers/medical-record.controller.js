import Patient from '../models/patient.model.js';
import Doctor from '../models/doctor.model.js';

function httpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function toResponse(record, patientName = '') {
  return {
    id: String(record._id),
    patientId: record.patientId,
    patientName,
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
  PatientModel = Patient,
  DoctorModel = Doctor
) {
  return {
    async list(req, res, next) {
      try {
        const { page, limit, patientId, from, to, search } = req.validatedQuery;
        const filter = { archivedAt: null };
        if (patientId) filter.patientId = patientId;
        if (req.auth.role === 'doctor') {
          const assignedPatients = await PatientModel.find({
            doctor: req.auth.doctorId,
            archivedAt: null,
          })
            .select('patientId')
            .lean()
            .exec();
          const assignedIds = assignedPatients.map(({ patientId: id }) => id);
          filter.patientId = patientId && assignedIds.includes(patientId)
            ? patientId
            : { $in: assignedIds };
        }
        if (from || to) {
          filter.visitDate = {};
          if (from) filter.visitDate.$gte = from;
          if (to) filter.visitDate.$lte = to;
        }
        let matchingPatientIds = [];
        if (search) {
          const expression = { $regex: escapeRegex(search), $options: 'i' };
          const nameTerms = search.split(/\s+/).filter(Boolean).map((term) => ({
            $or: [
              { firstName: { $regex: escapeRegex(term), $options: 'i' } },
              { lastName: { $regex: escapeRegex(term), $options: 'i' } },
            ],
          }));
          const matchingPatients = await PatientModel.find({
            ...(req.auth.role === 'doctor' ? { doctor: req.auth.doctorId } : {}),
            $and: nameTerms,
          })
            .select('patientId')
            .lean()
            .exec();
          matchingPatientIds = matchingPatients.map(({ patientId: id }) => id);
          filter.$or = [
            { patientId: expression },
            { diagnosis: expression },
            { attendingPhysician: expression },
            ...(matchingPatientIds.length
              ? [{ patientId: { $in: matchingPatientIds } }]
              : []),
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

        const patientIds = [...new Set(records.map(({ patientId: id }) => id))];
        const patients = patientIds.length
          ? await PatientModel.find({ patientId: { $in: patientIds } })
              .select('patientId firstName lastName')
              .lean()
              .exec()
          : [];
        const patientNames = new Map(
          patients.map((patient) => [
            patient.patientId,
            `${patient.firstName} ${patient.lastName}`,
          ])
        );

        return res.json({
          success: true,
          data: records.map((record) =>
            toResponse(record, patientNames.get(record.patientId) || '')
          ),
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
        if (req.auth.role === 'doctor') {
          const patient = await PatientModel.findOne({
            patientId: record.patientId,
            doctor: req.auth.doctorId,
            archivedAt: null,
          })
            .select('patientId')
            .lean()
            .exec();
          if (!patient) throw httpError(404, 'Medical record not found');
        }
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
          ...(req.auth.role === 'doctor' ? { doctor: req.auth.doctorId } : {}),
        })
          .select('patientId')
          .lean()
          .exec();
        if (!patient) throw httpError(404, 'Active patient not found');

        const fields = { ...req.validatedBody };
        if (req.auth.role === 'doctor') {
          const doctor = await DoctorModel.findOne({
            _id: req.auth.doctorId,
            active: true,
          })
            .select('name')
            .lean()
            .exec();
          if (!doctor) throw httpError(403, 'An active linked doctor profile is required');
          fields.attendingPhysician = doctor.name;
        }

        const record = await MedicalRecord.create({
          ...fields,
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
        if (req.auth.role === 'doctor' && updates.attendingPhysician) {
          const doctor = await DoctorModel.findOne({
            _id: req.auth.doctorId,
            active: true,
          })
            .select('name')
            .lean()
            .exec();
          if (!doctor) throw httpError(403, 'An active linked doctor profile is required');
          updates.attendingPhysician = doctor.name;
        }
        const existingRecord = req.auth.role === 'doctor'
          ? await MedicalRecord.findOne(activeRecordFilter(req.params.id)).lean().exec()
          : null;
        if (req.auth.role === 'doctor') {
          if (!existingRecord) throw httpError(404, 'Medical record not found');
          const patient = await PatientModel.findOne({
            patientId: existingRecord.patientId,
            doctor: req.auth.doctorId,
            archivedAt: null,
          })
            .select('patientId')
            .lean()
            .exec();
          if (!patient) throw httpError(404, 'Medical record not found');
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

        const record = await MedicalRecord.findOneAndUpdate(
          {
            ...activeRecordFilter(req.params.id),
            ...(existingRecord ? { patientId: existingRecord.patientId } : {}),
          },
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
