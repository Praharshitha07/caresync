import mongoose from 'mongoose';
import { isSeededDemoDoctor } from '../utils/doctor-profile.js';

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function toPatientResponse(
  patient,
  {
    summary = false,
    receptionist = false,
    includeDemographics = false,
    doctorName = '',
  } = {}
) {
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
  if (receptionist) {
    return {
      id: patientId,
      patientId,
      firstName: patient.firstName,
      lastName: patient.lastName,
      name: `${patient.firstName} ${patient.lastName}`,
      phone: patient.phone,
      email: patient.email || '',
      ...(includeDemographics && {
        dob: patient.dob,
        gender: patient.gender,
        address: patient.address || '',
        emergencyContact: patient.emergencyContact || {},
      }),
      doctorName: doctorName || patient.primaryPhysician || '',
      registrationDate,
      formattedRegDate: new Date(`${registrationDate}T00:00:00.000Z`).toLocaleDateString(
        'en-US',
        { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }
      ),
      status: patient.status,
      createdAt: patient.createdAt,
      updatedAt: patient.updatedAt,
    };
  }

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
    doctorId: patient.doctor ? String(patient.doctor) : '',
    doctorName: doctorName || patient.primaryPhysician || '',
    primaryPhysician: doctorName || patient.primaryPhysician || '',
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

async function doctorForId(Doctor, id) {
  if (!id) return null;
  return Doctor.findOne({ _id: id })
    .select('name active professionalIdentifier')
    .lean()
    .exec();
}

async function toPatientResponses(
  patients,
  Doctor,
  { summary = false, receptionist = false } = {}
) {
  const doctorIds = [...new Set(patients.map(({ doctor }) => doctor && String(doctor)).filter(Boolean))];
  const doctors = doctorIds.length
    ? await Doctor.find({ _id: { $in: doctorIds } }).select('name').lean().exec()
    : [];
  const names = new Map(doctors.map((doctor) => [String(doctor._id), doctor.name]));
  return patients.map((patient) =>
    toPatientResponse(patient, {
      summary,
      receptionist,
      doctorName: names.get(String(patient.doctor)) || '',
    })
  );
}

export function createPatientController(Patient, Doctor) {
  return {
    async list(req, res, next) {
      try {
        const { page, limit, search, status, registered, sort, order } = req.validatedQuery;
        const filter = { archivedAt: null };
        if (req.auth.role === 'doctor') filter.doctor = req.auth.doctorId;
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
            .select('patientId firstName lastName dob gender phone email status doctor primaryPhysician createdAt updatedAt')
            .sort(sortOptions)
            .skip((page - 1) * limit)
            .limit(limit)
            .lean()
            .exec(),
          Patient.countDocuments(filter),
          Patient.countDocuments({
            archivedAt: null,
            ...(req.auth.role === 'doctor' ? { doctor: req.auth.doctorId } : {}),
          }),
          Patient.countDocuments({
            archivedAt: null,
            ...(req.auth.role === 'doctor' ? { doctor: req.auth.doctorId } : {}),
            createdAt: { $gte: recentSince },
          }),
        ]);

        return res.json({
          success: true,
          data: await toPatientResponses(patients, Doctor, {
            summary: true,
            receptionist: req.auth.role === 'receptionist',
          }),
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
        const patient = await Patient.findOne({
          ...patientFilter(req.params.id),
          ...(req.auth.role === 'doctor' ? { doctor: req.auth.doctorId } : {}),
        }).lean().exec();
        if (!patient) throw httpError(404, 'Patient not found');
        const doctor = await doctorForId(Doctor, patient.doctor);
        return res.json({
          success: true,
          data: toPatientResponse(patient, {
            receptionist: req.auth.role === 'receptionist',
            includeDemographics: req.auth.role === 'receptionist',
            doctorName: doctor?.name || '',
          }),
        });
      } catch (error) {
        return next(error);
      }
    },

    async create(req, res, next) {
      try {
        const { doctorId, ...fields } = req.validatedBody;
        if (req.auth.role === 'doctor' && doctorId !== req.auth.doctorId) {
          throw httpError(403, 'Doctors may register patients only to their linked profile');
        }
        const doctor = await doctorForId(Doctor, doctorId);
        if (!doctor || !doctor.active || isSeededDemoDoctor(doctor)) {
          throw httpError(400, 'Selected doctor is not active');
        }
        const patient = await Patient.create({ ...fields, doctor: doctorId });
        return res.status(201).json({
          success: true,
          data: toPatientResponse(patient, {
            doctorName: doctor.name,
            receptionist: req.auth.role === 'receptionist',
          }),
        });
      } catch (error) {
        return next(error);
      }
    },

    async update(req, res, next) {
      try {
        const { doctorId, ...fields } = req.validatedBody;
        if (req.auth.role === 'receptionist' && doctorId) {
          throw httpError(403, 'Receptionists cannot change a patient’s doctor assignment');
        }
        if (req.auth.role === 'doctor' && doctorId && doctorId !== req.auth.doctorId) {
          throw httpError(403, 'Doctors may assign patients only to their linked profile');
        }
        const filter = {
          ...patientFilter(req.params.id),
          ...(req.auth.role === 'doctor' ? { doctor: req.auth.doctorId } : {}),
        };
        const currentPatient = await Patient.findOne(filter)
          .select('doctor')
          .lean()
          .exec();
        if (!currentPatient) throw httpError(404, 'Patient not found');

        let doctorName = '';
        if (doctorId) {
          const doctor = await doctorForId(Doctor, doctorId);
          const keepingExistingAssignment =
            String(currentPatient.doctor || '') === String(doctorId);
          if (!keepingExistingAssignment
            && (!doctor || !doctor.active || isSeededDemoDoctor(doctor))) {
            throw httpError(400, 'Selected doctor is not active');
          }
          doctorName = doctor?.name || '';
          if (!keepingExistingAssignment) fields.doctor = doctorId;
        }
        const patient = await Patient.findOneAndUpdate(
          filter,
          { $set: fields },
          { new: true, runValidators: true }
        )
          .lean()
          .exec();
        if (!patient) throw httpError(404, 'Patient not found');
        if (!doctorName && patient.doctor) {
          const doctor = await doctorForId(Doctor, patient.doctor);
          doctorName = doctor?.name || '';
        }
        return res.json({
          success: true,
          data: toPatientResponse(patient, {
            receptionist: req.auth.role === 'receptionist',
            includeDemographics: req.auth.role === 'receptionist',
            doctorName,
          }),
        });
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
