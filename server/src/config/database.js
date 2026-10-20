import mongoose from 'mongoose';
import { env, isValidMongoUri } from './env.js';

// Human-readable mapping of Mongoose readyState values
const CONNECTION_STATES = {
  0: 'disconnected',
  1: 'connected',
  2: 'connecting',
  3: 'disconnecting',
};

function createConnectionError(cause) {
  const error = new Error(
    'MongoDB connection failed. Check MONGODB_URI, network access, and database credentials.',
    { cause }
  );
  error.name = 'DatabaseConnectionError';
  return error;
}

/**
 * Connect to MongoDB.
 *
 * Safeguards:
 * - Rejects startup immediately if MONGODB_URI is missing or invalid.
 * - Reuses existing connection if already established (no per-request connections).
 * - Avoids deprecated Mongoose options.
 * - Never logs credentials or secrets.
 * - Fast server selection timeout to fail quickly if the database is unavailable.
 */
export async function connectDatabase(customUri) {
  const uri =
    customUri === undefined
      ? env.MONGODB_URI
      : customUri;

  if (!uri || uri.trim().length === 0) {
    const error = new Error(
      'MONGODB_URI configuration is missing. The server cannot start without a valid database connection string.'
    );
    error.name = 'ConfigurationError';
    throw error;
  }

  if (!isValidMongoUri(uri)) {
    const error = new Error(
      'Invalid MONGODB_URI format. Use a valid mongodb:// or mongodb+srv:// connection URI.'
    );
    error.name = 'ConfigurationError';
    throw error;
  }

  // If already connected, return the existing connection.
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  // Avoid multiple concurrent connection attempts.
  if (mongoose.connection.readyState === 2) {
    try {
      await mongoose.connection.asPromise();
      return mongoose.connection;
    } catch (error) {
      throw createConnectionError(error);
    }
  }

  try {
    const connection = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      autoIndex: env.NODE_ENV !== 'production',
    });

    console.log('📦 MongoDB connected successfully.');
    return connection;
  } catch (error) {
    throw createConnectionError(error);
  }
}

/**
 * Disconnect from MongoDB gracefully
 */
export async function disconnectDatabase() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
    console.log('📦 MongoDB connection closed gracefully.');
  }
}

/**
 * Query current Mongoose connection status without exposing secrets
 */
export function getDatabaseStatus() {
  const readyState = mongoose.connection.readyState;
  const status = CONNECTION_STATES[readyState] || 'unknown';

  return {
    isConnected: readyState === 1,
    status,
    readyState,
  };
}

// Global Connection Event Listeners (safe logging only)
mongoose.connection.on('disconnected', () => {
  if (env.NODE_ENV !== 'test') {
    console.warn('⚠️ MongoDB connection disconnected.');
  }
});

mongoose.connection.on('error', (err) => {
  if (env.NODE_ENV !== 'test') {
    const details = [err.name, err.code].filter(Boolean).join(', ');
    console.error(
      `⚠️ MongoDB connection error encountered${details ? ` (${details})` : ''}.`
    );
  }
});
