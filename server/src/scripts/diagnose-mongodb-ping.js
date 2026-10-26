import mongoose from 'mongoose';
import { env, isValidMongoUri } from '../config/env.js';

function collectErrorDetails(error) {
  const details = [];
  const pending = [error];
  const seen = new Set();

  while (pending.length > 0 && details.length < 12) {
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

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function redactValue(message, value) {
  if (!value) return message;
  return message.replace(new RegExp(escapeRegExp(value), 'gi'), '[REDACTED]');
}

function safeErrorMessage(error) {
  let message = String(error.message || 'No error message provided')
    .replace(/mongodb(?:\+srv)?:\/\/[^\s"'<>]+/gi, '[MongoDB URI redacted]')
    .replace(/\bBearer\s+\S+/gi, 'Bearer [REDACTED]')
    .replace(
      /\b(username|user|password|passwd|token|secret|api[_-]?key|access[_-]?token|client[_-]?secret|authorization)\b(\s*[:=]\s*)(?:"[^"]*"|'[^']*'|[^\s,;]+)/gi,
      '$1$2[REDACTED]'
    )
    .replace(
      /\beyJ[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}\b/g,
      '[JWT redacted]'
    )
    .replace(/[\r\n\t]+/g, ' ');

  try {
    const uri = new URL(env.MONGODB_URI);
    for (const credential of [uri.username, uri.password]) {
      if (credential) {
        message = redactValue(message, credential);
        message = redactValue(message, decodeURIComponent(credential));
      }
    }
  } catch {
    // URI validation is handled before connecting; no URI value is logged.
  }

  return message.slice(0, 500);
}

function safeErrorField(value, fallback) {
  const field = String(value || fallback);
  return /^[A-Za-z0-9_.-]{1,100}$/.test(field) ? field : fallback;
}

async function diagnoseMongoPing() {
  if (!env.MONGODB_URI || !isValidMongoUri(env.MONGODB_URI)) {
    console.error('[MongoDB diagnostic] MONGODB_URI is missing or invalid.');
    process.exitCode = 1;
    return;
  }

  try {
    await mongoose.connect(env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
      tls: true,
      tlsAllowInvalidCertificates: false,
    });

    await mongoose.connection.db.admin().command({ ping: 1 });
    console.log('[MongoDB diagnostic] Ping succeeded.');
  } catch (error) {
    console.error('[MongoDB diagnostic] Ping failed.');
    for (const detail of collectErrorDetails(error)) {
      const name = safeErrorField(detail.name, 'Error');
      const code = detail.code
        ? ` code=${safeErrorField(detail.code, 'unavailable')}`
        : '';
      console.error(
        `[MongoDB diagnostic] ${name}${code}: ${safeErrorMessage(detail)}`
      );
    }
    process.exitCode = 1;
  } finally {
    try {
      await mongoose.disconnect();
    } catch (error) {
      console.error(
        `[MongoDB diagnostic] Disconnect ${safeErrorField(error.name, 'Error')}: ${safeErrorMessage(error)}`
      );
      process.exitCode = 1;
    }
  }
}

await diagnoseMongoPing();
