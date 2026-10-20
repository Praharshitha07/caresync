import mongoose from 'mongoose';

const authSessionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    tokenHash: { type: String, required: true, unique: true, select: false },
    expiresAt: { type: Date, required: true, expires: 0 },
  },
  { timestamps: true, versionKey: false }
);

const AuthSession =
  mongoose.models.AuthSession ||
  mongoose.model('AuthSession', authSessionSchema);

export default AuthSession;

export async function ensureAuthSessionIndexes() {
  try {
    await AuthSession.createIndexes();
  } catch (cause) {
    throw new Error('Authentication session indexes could not be initialized.', {
      cause,
    });
  }
}
