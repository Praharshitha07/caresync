import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { z } from 'zod';

const serverDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const environmentFilePath = resolve(serverDirectory, '.env');

// Runtime environment variables take precedence over values loaded from server/.env.
dotenv.config({ path: environmentFilePath, override: false });

export function isValidMongoUri(value) {
  if (typeof value !== 'string' || value.trim() !== value || /\s/.test(value)) {
    return false;
  }

  try {
    const uri = new URL(value);
    if (
      !['mongodb:', 'mongodb+srv:'].includes(uri.protocol) ||
      !uri.hostname ||
      uri.hash
    ) {
      return false;
    }
    if (uri.protocol === 'mongodb+srv:' && uri.port) return false;
    return Boolean(uri.username) === Boolean(uri.password);
  } catch {
    return false;
  }
}

const envSchema = z.object({
  PORT: z
    .string()
    .default('5000')
    .transform((val) => parseInt(val, 10))
    .refine((port) => !isNaN(port) && port > 0 && port <= 65535, {
      message: 'PORT must be a valid integer between 1 and 65535',
    }),
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  CLIENT_URL: z
    .string()
    .default('http://localhost:5173')
    .refine(
      (val) => {
        return val.trim().length > 0;
      },
      { message: 'CLIENT_URL must be specified' }
    ),
  MONGODB_URI: z
    .string()
    .optional()
    .refine((value) => value === undefined || isValidMongoUri(value), {
      message: 'MONGODB_URI must be a valid mongodb:// or mongodb+srv:// URI',
    }),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid backend environment configuration:');
  parsed.error.issues.forEach((issue) => {
    console.error(`   - ${issue.path.join('.')}: ${issue.message}`);
  });
  process.exit(1);
}

export const env = parsed.data;
