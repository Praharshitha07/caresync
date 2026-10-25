import mongoose from 'mongoose';

const doctorSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    specialty: { type: String, required: true, trim: true, maxlength: 120 },
    department: { type: String, trim: true, maxlength: 120, default: '' },
    email: { type: String, trim: true, lowercase: true, maxlength: 254, default: '' },
    phone: { type: String, trim: true, maxlength: 40, default: '' },
    professionalIdentifier: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: 40,
      sparse: true,
      unique: true,
    },
    active: { type: Boolean, default: true, index: true },
  },
  { timestamps: true, versionKey: false }
);

const Doctor =
  mongoose.models.Doctor || mongoose.model('Doctor', doctorSchema);

export default Doctor;

export async function ensureDoctorIndexes() {
  try {
    await Doctor.createIndexes();
  } catch (cause) {
    throw new Error('Doctor database indexes could not be initialized.', { cause });
  }
}
