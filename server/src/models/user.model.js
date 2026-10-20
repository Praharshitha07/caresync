import mongoose from 'mongoose';

export const USER_ROLES = ['admin', 'clinician', 'nurse', 'records_staff'];

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 254,
    },
    displayName: { type: String, required: true, trim: true, maxlength: 120 },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, required: true, enum: USER_ROLES },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true, versionKey: false }
);

userSchema.index({ email: 1 }, { unique: true });

const User = mongoose.models.User || mongoose.model('User', userSchema);

export default User;

export async function ensureUserIndexes() {
  try {
    await User.createIndexes();
  } catch (cause) {
    throw new Error('User database indexes could not be initialized.', { cause });
  }
}
