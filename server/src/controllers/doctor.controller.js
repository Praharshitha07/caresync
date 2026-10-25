import mongoose from 'mongoose';

function httpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function doctorWriteError(error) {
  return error.code === 11000
    ? httpError(409, 'A doctor with this professional identifier already exists')
    : error;
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function toResponse(doctor) {
  return {
    id: String(doctor._id),
    name: doctor.name,
    specialty: doctor.specialty,
    department: doctor.department || '',
    email: doctor.email || '',
    phone: doctor.phone || '',
    professionalIdentifier: doctor.professionalIdentifier || '',
    active: doctor.active,
  };
}

async function ensureUniqueProfile(Doctor, fields, id) {
  const name = fields.name;
  const specialty = fields.specialty;
  if (!name && !specialty) return;

  const current = id
    ? await Doctor.findById(id).select('name specialty').lean().exec()
    : null;
  if (id && !current) throw httpError(404, 'Doctor not found');

  const nextName = name || current.name;
  const nextSpecialty = specialty || current.specialty;
  const duplicateFilter = {
    name: { $regex: `^${escapeRegex(nextName)}$`, $options: 'i' },
    specialty: { $regex: `^${escapeRegex(nextSpecialty)}$`, $options: 'i' },
  };
  if (id) duplicateFilter._id = { $ne: id };
  const duplicate = await Doctor.findOne(duplicateFilter).select('_id').lean().exec();
  if (duplicate) {
    throw httpError(409, 'A doctor with this name and specialty already exists');
  }
}

export function createDoctorController(Doctor) {
  return {
    async list(req, res, next) {
      try {
        const { search, includeInactive } = req.validatedQuery;
        if (includeInactive === 'true' && req.auth.role !== 'admin') {
          throw httpError(403, 'Only administrators may view inactive doctor profiles');
        }
        const filter = {
          professionalIdentifier: { $not: /^DEV-FICTIONAL-/i },
          ...(includeInactive === 'true' ? {} : { active: true }),
        };
        if (search) {
          const pattern = { $regex: escapeRegex(search), $options: 'i' };
          filter.$or = [{ name: pattern }, { specialty: pattern }, { department: pattern }];
        }
        const doctors = await Doctor.find(filter)
          .select('name specialty department email phone professionalIdentifier active')
          .sort({ name: 1 })
          .lean()
          .exec();

        return res.json({ success: true, data: doctors.map(toResponse) });
      } catch (error) {
        return next(error);
      }
    },

    async create(req, res, next) {
      try {
        const fields = req.validatedBody;
        await ensureUniqueProfile(Doctor, fields);
        const doctor = await Doctor.create({ ...fields, active: fields.active ?? true });
        return res.status(201).json({ success: true, data: toResponse(doctor) });
      } catch (error) {
        return next(doctorWriteError(error));
      }
    },

    async update(req, res, next) {
      try {
        if (!mongoose.isValidObjectId(req.params.id)) {
          throw httpError(400, 'Doctor identifier is invalid');
        }
        const fields = req.validatedBody;
        await ensureUniqueProfile(Doctor, fields, req.params.id);
        const doctor = await Doctor.findByIdAndUpdate(
          req.params.id,
          { $set: fields },
          { new: true, runValidators: true }
        ).lean().exec();
        if (!doctor) throw httpError(404, 'Doctor not found');
        return res.json({ success: true, data: toResponse(doctor) });
      } catch (error) {
        return next(doctorWriteError(error));
      }
    },
  };
}
