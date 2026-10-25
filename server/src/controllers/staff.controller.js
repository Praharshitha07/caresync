import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import User from '../models/user.model.js';
import Doctor from '../models/doctor.model.js';

function httpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function staffResponse(user, doctorName = '') {
  return {
    id: String(user._id),
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    isActive: user.isActive,
    doctor: user.doctor
      ? { id: String(user.doctor), name: doctorName }
      : null,
    createdAt: user.createdAt,
  };
}

async function runInMongoTransaction(operation) {
  const session = await mongoose.startSession();
  try {
    return await session.withTransaction(() => operation(session));
  } finally {
    await session.endSession();
  }
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function createStaffController(
  UserModel = User,
  DoctorModel = Doctor,
  SessionModel,
  runTransaction = runInMongoTransaction
) {
  return {
    async list(req, res, next) {
      try {
        const users = await UserModel.find({})
          .select('_id email displayName role isActive doctor createdAt')
          .sort({ displayName: 1, email: 1 })
          .lean()
          .exec();
        const doctorIds = [...new Set(
          users.map(({ doctor }) => doctor && String(doctor)).filter(Boolean)
        )];
        const doctors = doctorIds.length
          ? await DoctorModel.find({ _id: { $in: doctorIds } })
              .select('name')
              .lean()
              .exec()
          : [];
        const doctorNames = new Map(
          doctors.map((doctor) => [String(doctor._id), doctor.name])
        );
        return res.json({
          success: true,
          data: users.map((user) =>
            staffResponse(user, doctorNames.get(String(user.doctor)) || '')
          ),
        });
      } catch (error) {
        return next(error);
      }
    },

    async create(req, res, next) {
      try {
        const {
          email,
          displayName,
          role,
          doctorProfile,
          password,
        } = req.validatedBody;
        const { user, doctor } = await runTransaction(async (session) => {
          const existingEmail = await UserModel.findOne({ email })
            .session(session)
            .select('_id')
            .lean()
            .exec();
          if (existingEmail) {
            throw httpError(409, 'An account already exists for this email address');
          }

          let linkedDoctor = null;
          if (role === 'doctor') {
            const namePattern = {
              $regex: `^${escapeRegex(displayName)}$`,
              $options: 'i',
            };
            const specialtyPattern = {
              $regex: `^${escapeRegex(doctorProfile.specialty)}$`,
              $options: 'i',
            };
            const duplicateProfile = await DoctorModel.findOne({
              name: namePattern,
              specialty: specialtyPattern,
            })
              .session(session)
              .select('_id')
              .lean()
              .exec();
            if (duplicateProfile) {
              throw httpError(
                409,
                'A doctor profile with this name and specialty already exists'
              );
            }

            [linkedDoctor] = await DoctorModel.create([{
              name: displayName,
              specialty: doctorProfile.specialty,
              department: doctorProfile.department || '',
              email,
              phone: doctorProfile.phone || '',
              ...(doctorProfile.professionalIdentifier
                ? { professionalIdentifier: doctorProfile.professionalIdentifier }
                : {}),
              active: true,
            }], { session });
          }

          const [createdUser] = await UserModel.create([{
            email,
            displayName,
            role,
            isActive: true,
            ...(linkedDoctor ? { doctor: linkedDoctor._id } : {}),
            passwordHash: await bcrypt.hash(password, 12),
          }], { session });
          return { user: createdUser, doctor: linkedDoctor };
        });
        return res.status(201).json({
          success: true,
          data: staffResponse(user, doctor?.name || ''),
        });
      } catch (error) {
        if (error.code === 11000) {
          return next(httpError(409, error.keyPattern?.doctor
            ? 'This doctor profile is already linked to a staff account'
            : error.keyPattern?.professionalIdentifier
              ? 'A doctor with this professional identifier already exists'
              : 'An account already exists for this email address'));
        }
        return next(error);
      }
    },

    async updateStatus(req, res, next) {
      try {
        const { id } = req.validatedParams;
        const { isActive } = req.validatedBody;
        if (!mongoose.isValidObjectId(id)) {
          throw httpError(400, 'Staff account identifier is invalid');
        }
        if (id.toLowerCase() === String(req.auth.userId).toLowerCase() && !isActive) {
          throw httpError(409, 'You cannot deactivate your own staff account');
        }

        const user = await UserModel.findByIdAndUpdate(
          id,
          { $set: { isActive } },
          { new: true }
        )
          .select('_id email displayName role isActive doctor createdAt')
          .lean()
          .exec();
        if (!user) throw httpError(404, 'Staff account was not found');

        if (!isActive && SessionModel) {
          await SessionModel.deleteMany({ userId: user._id });
        }

        let doctorName = '';
        if (user.doctor) {
          const doctor = await DoctorModel.findById(user.doctor)
            .select('name')
            .lean()
            .exec();
          doctorName = doctor?.name || '';
        }
        return res.json({ success: true, data: staffResponse(user, doctorName) });
      } catch (error) {
        return next(error);
      }
    },
  };
}
