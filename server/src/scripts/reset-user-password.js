import readline from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import bcrypt from 'bcryptjs';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import AuthSession from '../models/auth-session.model.js';
import User from '../models/user.model.js';

function readHidden(prompt) {
  if (!stdin.isTTY || typeof stdin.setRawMode !== 'function') {
    return Promise.reject(
      new Error('Password reset requires an interactive terminal.')
    );
  }

  return new Promise((resolve, reject) => {
    let value = '';
    const onData = (chunk) => {
      for (const character of chunk) {
        if (character === '\u0003') {
          cleanup();
          reject(new Error('Password reset cancelled.'));
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

async function resetUserPassword() {
  const prompt = readline.createInterface({ input: stdin, output: stdout });

  try {
    const email = (await prompt.question('Existing staff account email: '))
      .trim()
      .toLowerCase();
    prompt.close();

    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error('A valid staff email address is required.');
    }

    await connectDatabase();
    const user = await User.findOne({ email }).select('_id isActive').exec();
    if (!user) throw new Error('No existing staff account was found.');
    if (!user.isActive) {
      throw new Error(
        'The staff account is inactive. Password was not changed; an authorized administrator must reactivate it first.'
      );
    }

    const password = await readHidden('New password (hidden, minimum 12 characters): ');
    const confirmation = await readHidden('Confirm new password: ');
    if (password !== confirmation) throw new Error('Passwords do not match.');
    if (password.length < 12 || Buffer.byteLength(password, 'utf8') > 72) {
      throw new Error(
        'Password must be at least 12 characters and no more than 72 UTF-8 bytes.'
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const update = await User.updateOne(
      { _id: user._id, isActive: true },
      { $set: { passwordHash } }
    ).exec();

    if (update.matchedCount === 0) {
      throw new Error(
        'The account changed during reset. No password was changed; verify its status and try again.'
      );
    }

    await AuthSession.deleteMany({ userId: user._id });
    console.log('Password reset successfully. The user must sign in again.');
  } finally {
    prompt.close();
    await disconnectDatabase();
  }
}

resetUserPassword().catch((error) => {
  const safeMessages = [
    'Password reset requires an interactive terminal.',
    'Password reset cancelled.',
    'A valid staff email address is required.',
    'No existing staff account was found.',
    'The staff account is inactive. Password was not changed; an authorized administrator must reactivate it first.',
    'Passwords do not match.',
    'Password must be at least 12 characters and no more than 72 UTF-8 bytes.',
    'The account changed during reset. No password was changed; verify its status and try again.',
  ];
  if (safeMessages.includes(error.message)) {
    console.error(`Password reset failed: ${error.message}`);
  } else if (
    error.name === 'ConfigurationError' ||
    error.name === 'DatabaseConnectionError'
  ) {
    console.error(`Password reset failed: ${error.message}`);
  } else {
    console.error(
      `Password reset failed (${error.name || 'Error'}). Check database availability and account configuration.`
    );
  }
  process.exitCode = 1;
});
