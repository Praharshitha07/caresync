import mongoose from 'mongoose';

const medicalRecordSchema = new mongoose.Schema(
  {
    patientId: { type: String, required: true, trim: true, maxlength: 32, index: true },
    visitDate: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    diagnosis: { type: String, required: true, trim: true, maxlength: 2000 },
    treatment: { type: String, required: true, trim: true, maxlength: 5000 },
    prescriptions: { type: String, trim: true, maxlength: 3000, default: '' },
    clinicalNotes: { type: String, trim: true, maxlength: 10000, default: '' },
    attendingPhysician: { type: String, required: true, trim: true, maxlength: 120 },
    department: { type: String, required: true, trim: true, maxlength: 120 },
    followUpDate: { type: String, match: /^\d{4}-\d{2}-\d{2}$/, default: '' },
    severity: {
      type: String,
      enum: ['Low', 'Moderate', 'High', 'Critical'],
      default: 'Moderate',
    },
    archivedAt: { type: Date, default: null, select: false },
  },
  { timestamps: true, versionKey: false }
);

medicalRecordSchema.index({ archivedAt: 1, patientId: 1, visitDate: -1 });

const MedicalRecord =
  mongoose.models.MedicalRecord ||
  mongoose.model('MedicalRecord', medicalRecordSchema);

export default MedicalRecord;

export async function ensureMedicalRecordIndexes() {
  try {
    await MedicalRecord.createIndexes();
  } catch (cause) {
    throw new Error('Medical record database indexes could not be initialized.', {
      cause,
    });
  }
}
