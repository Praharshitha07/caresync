import mongoose from 'mongoose';

const appointmentSchema = new mongoose.Schema(
  {
    patientId: { type: String, required: true, trim: true, maxlength: 32, index: true },
    date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    time: { type: String, required: true, trim: true, maxlength: 40 },
    reason: { type: String, required: true, trim: true, maxlength: 1000 },
    type: { type: String, required: true, trim: true, maxlength: 120 },
    assignedDoctor: { type: String, required: true, trim: true, maxlength: 120 },
    room: { type: String, trim: true, maxlength: 80, default: '' },
    status: {
      type: String,
      enum: ['Scheduled', 'Confirmed', 'In Progress', 'Completed', 'Cancelled'],
      default: 'Scheduled',
    },
    archivedAt: { type: Date, default: null, select: false },
  },
  { timestamps: true, versionKey: false }
);

appointmentSchema.index({ archivedAt: 1, date: 1, time: 1 });

const Appointment =
  mongoose.models.Appointment ||
  mongoose.model('Appointment', appointmentSchema);

export default Appointment;

export async function ensureAppointmentIndexes() {
  try {
    await Appointment.createIndexes();
  } catch (cause) {
    throw new Error('Appointment database indexes could not be initialized.', {
      cause,
    });
  }
}
