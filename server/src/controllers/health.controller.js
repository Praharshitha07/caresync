import { env } from '../config/env.js';
import { getDatabaseStatus } from '../config/database.js';

/**
 * Basic Process Health Check Controller
 * Verifies that the Express API service process is running.
 */
export function getHealthStatus(req, res) {
  res.status(200).json({
    success: true,
    message: 'CareSync API service is running',
    environment: env.NODE_ENV,
  });
}

/**
 * Database Connectivity Health Check Controller
 * Verifies that Mongoose has an active, healthy MongoDB connection.
 *
 * Response:
 * - HTTP 200 when connected (readyState === 1)
 * - HTTP 503 when disconnected/connecting/error
 *
 * Security:
 * - Never returns credentials, connection strings, or internal infrastructure secrets.
 */
export function getDatabaseHealthStatus(req, res) {
  const dbStatus = getDatabaseStatus();

  if (dbStatus.isConnected) {
    return res.status(200).json({
      success: true,
      message: 'Database is connected and operational',
      environment: env.NODE_ENV,
      database: {
        status: dbStatus.status,
        readyState: dbStatus.readyState,
      },
    });
  }

  return res.status(503).json({
    success: false,
    message: 'Database is not connected',
    environment: env.NODE_ENV,
    database: {
      status: dbStatus.status,
      readyState: dbStatus.readyState,
    },
  });
}
