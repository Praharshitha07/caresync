import app from './app.js';
import { env } from './config/env.js';
import { connectDatabase, disconnectDatabase } from './config/database.js';
import { ensurePatientIndexes } from './models/patient.model.js';
import { ensureUserIndexes } from './models/user.model.js';
import { ensureAuthSessionIndexes } from './models/auth-session.model.js';
import { ensureMedicalRecordIndexes } from './models/medical-record.model.js';
import { ensureAppointmentIndexes } from './models/appointment.model.js';
import { ensureAuditEventIndexes } from './models/audit-event.model.js';

let server = null;
let isShuttingDown = false;

function collectErrorDetails(error) {
  const details = [];
  const pending = [error];
  const seen = new Set();

  while (pending.length && details.length < 12) {
    const current = pending.shift();
    if (!current || typeof current !== 'object' || seen.has(current)) continue;
    seen.add(current);
    details.push(current);

    if (current.cause) pending.push(current.cause);
    if (Array.isArray(current.errors)) pending.push(...current.errors);
    if (current.reason?.servers instanceof Map) {
      for (const server of current.reason.servers.values()) {
        if (server.error) pending.push(server.error);
      }
    }
  }

  return details;
}

function safeErrorMessage(error) {
  return String(error.message || 'No error message provided')
    .replace(/mongodb(?:\+srv)?:\/\/[^\s"'<>]+/gi, '[MongoDB URI redacted]')
    .replace(/[\r\n\t]+/g, ' ')
    .slice(0, 500);
}

/**
 * Graceful Termination Handler
 * - Prevents multiple duplicate shutdown calls.
 * - Stops accepting new HTTP requests.
 * - Closes the Mongoose connection to MongoDB.
 * - Exits the process cleanly.
 */
async function handleShutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log(`\n🛑 Received ${signal}. Initiating graceful shutdown...`);

  // Force close after 10 seconds if graceful closure hangs
  const forceTimeout = setTimeout(() => {
    console.error('⚠️ Forcing server shutdown after timeout.');
    process.exit(1);
  }, 10000);
  forceTimeout.unref();

  try {
    if (server) {
      await new Promise((resolve) => {
        server.close(() => {
          console.log('🔌 HTTP server stopped accepting connections.');
          resolve();
        });
      });
    }

    await disconnectDatabase();
    console.log('✅ Graceful shutdown completed.');
    process.exit(0);
  } catch (err) {
    console.error(`❌ Error during shutdown (${err.name || 'Error'}).`);
    process.exit(1);
  }
}

/**
 * Server Lifecycle Manager
 *
 * Order of Initialization:
 * 1. Environment configuration validated via Zod (in env.js)
 * 2. MongoDB connects successfully (rejects startup on failure)
 * 3. Express server begins listening for traffic
 */
async function startServer() {
  try {
    console.log('===============================================');
    console.log('🏥 CareSync Express Backend — Phase 7 Initialization');
    console.log(`🌐 Environment: ${env.NODE_ENV}`);

    // Step 2: Connect to MongoDB BEFORE accepting any traffic
    console.log('⏳ Connecting to MongoDB...');
    await connectDatabase();
    await Promise.all([
      ensurePatientIndexes(),
      ensureUserIndexes(),
      ensureAuthSessionIndexes(),
      ensureMedicalRecordIndexes(),
      ensureAppointmentIndexes(),
      ensureAuditEventIndexes(),
    ]);

    // Step 3: Start HTTP listener only after database is connected
    server = app.listen(env.PORT, () => {
      console.log(`📡 Server listening on port: ${env.PORT}`);
      console.log(`🩺 System Health:   http://localhost:${env.PORT}/api/health`);
      console.log(`🩺 Database Health: http://localhost:${env.PORT}/api/health/db`);
      console.log('===============================================');
    });

    process.on('SIGTERM', () => handleShutdown('SIGTERM'));
    process.on('SIGINT', () => handleShutdown('SIGINT'));

    return server;
  } catch (error) {
    console.error('❌ Server startup aborted.');
    if (env.NODE_ENV === 'development') {
      for (const detail of collectErrorDetails(error)) {
        const code = detail.code ? ` code=${detail.code}` : '';
        console.error(
          `[Database diagnostic] ${detail.name || 'Error'}${code}: ${safeErrorMessage(detail)}`
        );
      }
    } else {
      console.error('Database connection or startup configuration failed.');
    }
    // Non-zero exit status ensures orchestrators and container systems recognize failure
    process.exit(1);
  }
}

// Start the server
startServer();
