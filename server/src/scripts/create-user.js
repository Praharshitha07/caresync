import readline from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import bcrypt from 'bcryptjs';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import User, { USER_ROLES, ensureUserIndexes } from '../models/user.model.js';
import Doctor from '../models/doctor.model.js';

function parseArguments(args) {
  const options = Object.fromEntries(
    args
      .filter((argument) => argument.startsWith('--'))
      .map((argument) => {
        const separator = argument.indexOf('=');
        return separator > 2
          ? [argument.slice(2, separator), argument.slice(separator + 1)]
          : [argument.slice(2), ''];
      })
  );

  if (
    !options.email ||
    !options.role ||
    !USER_ROLES.includes(options.role) ||
    (options.role === 'doctor' && !/^[a-f\d]{24}$/i.test(options.doctorId || '')) ||
    (options.role !== 'doctor' && options.doctorId)
  ) {
    throw new Error(
      `Usage: npm run users:create -- --email=staff@hospital.org --role=${USER_ROLES.join('|')} [--doctorId=24-character-id for doctor role]`
    );
  }

  const email = options.email.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('A valid staff email address is required.');
  }

  return { email, role: options.role, doctorId: options.doctorId };
}

function readHidden(prompt) {
  if (!stdin.isTTY || typeof stdin.setRawMode !== 'function') {
    return Promise.reject(new Error('Account provisioning requires an interactive terminal.'));
  }

  return new Promise((resolve, reject) => {
    let value = '';
    const onData = (chunk) => {
      for (const character of chunk) {
        if (character === '\u0003') {
          cleanup();
          reject(new Error('Account provisioning cancelled.'));
          return;
        }
        if (character === '\r' || character === '\n') {
          cleanup();
          stdout.write('\n');
          resolve(value);
          return;
        }
        if (character === '\u007f' || character === '\b') {
          value = value.slice(0, -1);
        } else if (character >= ' ') {
          value += character;
        }
      }
    };
    const cleanup = () => {
      stdin.off('data', onData);
      stdin.setRawMode(false);
      stdin.pause();
    };

    stdout.write(prompt);
    stdin.setRawMode(true);
    stdin.setEncoding('utf8');
    stdin.resume();
    stdin.on('data', onData);
  });
}

async function createUser() {
  const { email, role, doctorId } = parseArguments(process.argv.slice(2));
  const prompt = readline.createInterface({ input: stdin, output: stdout });

  try {
    await connectDatabase();
    await ensureUserIndexes();
    const existing = await User.findOne({ email }).select('_id').exec();
    if (existing) throw new Error('An account already exists for that email address.');
    let doctor = null;
    if (role === 'doctor') {
      doctor = await Doctor.findOne({ _id: doctorId, active: true })
        .select('_id')
        .lean()
        .exec();
      if (!doctor) throw new Error('The doctor profile must exist and be active.');
      const linkedAccount = await User.findOne({ doctor: doctorId }).select('_id').exec();
      if (linkedAccount) throw new Error('That doctor profile already has a linked account.');
    }

    const displayName = (await prompt.question('Staff display name: ')).trim();
    prompt.close();
    if (!displayName || displayName.length > 120) {
      throw new Error('Display name must be between 1 and 120 characters.');
    }

    const password = await readHidden('Password (hidden, minimum 12 characters): ');
    const confirmation = await readHidden('Confirm password: ');
    if (password !== confirmation) throw new Error('Passwords do not match.');
    if (password.length < 12 || Buffer.byteLength(password, 'utf8') > 72) {
      throw new Error('Password must be at least 12 characters and no more than 72 UTF-8 bytes.');
    }

    await User.create({
      email,
      displayName,
      role,
      ...(doctor ? { doctor: doctor._id } : {}),
      passwordHash: await bcrypt.hash(password, 12),
    });
    console.log(`Created ${role} account.`);
  } finally {
    prompt.close();
    await disconnectDatabase();
  }
}

createUser().catch((error) => {
  if (error.code === 11000) {
    console.error('Account provisioning failed: an account already exists for that email address.');
  } else if (error.name === 'ConfigurationError' || error.name === 'DatabaseConnectionError') {
    console.error(`Account provisioning failed: ${error.message}`);
  } else if (
    [
      'Account provisioning requires an interactive terminal.',
      'Account provisioning cancelled.',
      'An account already exists for that email address.',
      'The doctor profile must exist and be active.',
      'That doctor profile already has a linked account.',
      'Display name must be between 1 and 120 characters.',
      'Passwords do not match.',
      'Password must be at least 12 characters and no more than 72 UTF-8 bytes.',
    ].includes(error.message) ||
    error.message.startsWith('Usage:')
  ) {
    console.error(`Account provisioning failed: ${error.message}`);
  } else {
    console.error(`Account provisioning failed (${error.name || 'Error'}). Check database availability and account configuration.`);
  }
  process.exitCode = 1;
});
