import mongoose from 'mongoose';

const auditEventSchema = new mongoose.Schema(
  {
    requestId: { type: String, required: true, immutable: true, maxlength: 36 },
    actorId: { type: String, required: true, immutable: true, maxlength: 64 },
    actorRole: { type: String, required: true, immutable: true, maxlength: 40 },
    action: {
      type: String,
      required: true,
      immutable: true,
      enum: [
        'read_list',
        'read_item',
        'create',
        'update',
        'archive',
        'reset_password',
      ],
    },
    resource: {
      type: String,
      required: true,
      immutable: true,
      enum: [
        'patients',
        'medical_records',
        'appointments',
        'users',
        'dashboard',
        'doctors',
      ],
    },
    resourceId: { type: String, immutable: true, maxlength: 64 },
    subjectId: { type: String, immutable: true, maxlength: 32 },
    outcome: {
      type: String,
      required: true,
      immutable: true,
      enum: ['authorization_granted', 'role_denied'],
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    versionKey: false,
    strict: 'throw',
  }
);

auditEventSchema.index({ createdAt: -1, actorId: 1 });
auditEventSchema.index({ resource: 1, resourceId: 1, createdAt: -1 });

const AuditEvent =
  mongoose.models.AuditEvent || mongoose.model('AuditEvent', auditEventSchema);

export default AuditEvent;

export async function ensureAuditEventIndexes() {
  try {
    await AuditEvent.createIndexes();
  } catch (cause) {
    throw new Error('Audit event database indexes could not be initialized.', {
      cause,
    });
  }
}
