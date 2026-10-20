import mongoose from 'mongoose';

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function toPatientResponse(patient, { summary = false } = {}) {
  const patientId = patient.patientId;
  const [year, month, day] = patient.dob.split('-').map(Number);
  const today = new Date();
  let age = today.getFullYear() - year;
  if (
    today.getMonth() + 1 < month ||
    (today.getMonth() + 1 === month && today.getDate() < day)
  ) {
    age -= 1;
  }

  const registrationDate = patient.createdAt.toISOString().slice(0, 10);
  return {
    id: patientId,
    patientId,
    firstName: patient.firstName,
    lastName: patient.lastName,
    name: `${patient.firstName} ${patient.lastName}`,
    dob: patient.dob,
    age,
    gender: patient.gender,
    phone: patient.phone,
    email: patient.email || '',
    ...(!summary && {
      address: patient.address || '',
      emergencyContact: patient.emergencyContact || {},
      room: patient.room || '',
      primaryPhysician: patient.primaryPhysician || '',
      bloodType: patient.bloodType || 'Unknown',
      allergies: patient.allergies || '',
    }),
    registrationDate,
    formattedRegDate: new Date(`${registrationDate}T00:00:00.000Z`).toLocaleDateString(
      'en-US',
      { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }
    ),
    status: patient.status,
    statusVariant:
      patient.status === 'Admitted'
        ? 'success'
        : patient.status === 'Observation'
          ? 'warning'
          : patient.status === 'Discharged'
            ? 'muted'
            : 'neutral',
    createdAt: patient.createdAt,
    updatedAt: patient.updatedAt,
  };
}

function httpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function patientFilter(identifier) {
  if (identifier.startsWith('CS-')) {
    return { patientId: identifier.toUpperCase(), archivedAt: null };
  }
  if (!mongoose.isValidObjectId(identifier)) {
    throw httpError(400, 'Patient identifier is invalid');
  }
  return { _id: identifier, archivedAt: null };
}

export function createPatientController(Patient) {
  return {
    async list(req, res, next) {
      try {
        const { page, limit, search, status, registered, sort, order } = req.validatedQuery;
        const filter = { archivedAt: null };
        if (status) filter.status = status;
        if (registered !== 'all') {
          const days = registered === 'last7' ? 7 : 30;
          filter.createdAt = { $gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000) };
        }
        if (search) {
          const pattern = new RegExp(escapeRegex(search), 'i');
          filter.$and = search
            .split(/\s+/)
            .filter(Boolean)
            .map((term) => {
              const word = new RegExp(escapeRegex(term), 'i');
              return {
                $or: [
                  { patientId: word },
                  { firstName: word },
                  { lastName: word },
                  { phone: word },
                  { email: word },
                ],
              };
            });
        }

        const direction = order === 'asc' ? 1 : -1;
        const sortOptions =
          sort === 'name'
            ? { firstName: direction, lastName: direction }
            : { createdAt: direction };

        const recentSince = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const [patients, total, activeTotal, recentCount] = await Promise.all([
          Patient.find(filter)
            .select('patientId firstName lastName dob gender phone email status createdAt updatedAt')
            .sort(sortOptions)
            .skip((page - 1) * limit)
            .limit(limit)
            .lean()
            .exec(),
          Patient.countDocuments(filter),
          Patient.countDocuments({ archivedAt: null }),
          Patient.countDocuments({ archivedAt: null, createdAt: { $gte: recentSince } }),
        ]);

        return res.json({
          success: true,
          data: patients.map((patient) => toPatientResponse(patient, { summary: true })),
          pagination: {
            page,
            limit,
            total,
            activeTotal,
            pages: Math.ceil(total / limit),
            recentCount,
          },
        });
      } catch (error) {
        return next(error);
      }
    },

    async get(req, res, next) {
      try {
        const patient = await Patient.findOne(patientFilter(req.params.id)).lean().exec();
        if (!patient) throw httpError(404, 'Patient not found');
        return res.json({ success: true, data: toPatientResponse(patient) });
      } catch (error) {
        return next(error);
      }
    },

    async create(req, res, next) {
      try {
        const patient = await Patient.create(req.validatedBody);
        return res.status(201).json({ success: true, data: toPatientResponse(patient) });
      } catch (error) {
        return next(error);
      }
    },

    async update(req, res, next) {
      try {
        const patient = await Patient.findOneAndUpdate(
          patientFilter(req.params.id),
          { $set: req.validatedBody },
          { new: true, runValidators: true }
        )
          .lean()
          .exec();
        if (!patient) throw httpError(404, 'Patient not found');
        return res.json({ success: true, data: toPatientResponse(patient) });
      } catch (error) {
        return next(error);
      }
    },

    async archive(req, res, next) {
      try {
        const patient = await Patient.findOneAndUpdate(
          patientFilter(req.params.id),
          { $set: { archivedAt: new Date() } },
          { new: true }
        )
          .lean()
          .exec();
        if (!patient) throw httpError(404, 'Patient not found');
        return res.json({ success: true, data: { id: patient.patientId, archived: true } });
      } catch (error) {
        return next(error);
      }
    },
  };
}
