import { randomBytes } from 'node:crypto';
import mongoose from 'mongoose';

const emergencyContactSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, maxlength: 120 },
    relationship: { type: String, trim: true, maxlength: 80 },
    phone: { type: String, trim: true, maxlength: 40 },
  },
  { _id: false }
);

const patientSchema = new mongoose.Schema(
  {
    patientId: {
      type: String,
      required: true,
      immutable: true,
      default: () => `CS-${randomBytes(6).toString('hex').toUpperCase()}`,
    },
    firstName: { type: String, required: true, trim: true, maxlength: 80 },
    lastName: { type: String, required: true, trim: true, maxlength: 80 },
    dob: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    gender: {
      type: String,
      required: true,
      enum: ['Female', 'Male', 'Other', 'Undisclosed'],
    },
    phone: { type: String, required: true, trim: true, maxlength: 40 },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      maxlength: 254,
      default: '',
    },
    address: { type: String, trim: true, maxlength: 300, default: '' },
    emergencyContact: {
      type: emergencyContactSchema,
      default: () => ({}),
    },
    status: {
      type: String,
      enum: ['Outpatient', 'Admitted', 'Observation', 'Discharged'],
      default: 'Outpatient',
    },
    primaryPhysician: { type: String, trim: true, maxlength: 120, default: '' },
    room: { type: String, trim: true, maxlength: 80, default: '' },
    bloodType: {
      type: String,
      enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Unknown'],
      default: 'Unknown',
    },
    allergies: { type: String, trim: true, maxlength: 1000, default: '' },
    archivedAt: { type: Date, default: null, select: false },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

patientSchema.index({ patientId: 1 }, { unique: true });
patientSchema.index({ archivedAt: 1, createdAt: -1 });
patientSchema.index({ archivedAt: 1, firstName: 1, lastName: 1 });

const Patient =
  mongoose.models.Patient || mongoose.model('Patient', patientSchema);

export default Patient;

export async function ensurePatientIndexes() {
  try {
    await Patient.createIndexes();
  } catch (cause) {
    throw new Error('Patient database indexes could not be initialized.', { cause });
  }
}
