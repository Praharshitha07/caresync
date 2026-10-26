import { stdin, stdout } from 'node:process';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import User from '../models/user.model.js';

const ACCOUNT_EMAIL = 'praharshithamalladi@gmail.com';

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

async function resetPassword() {
  try {
    await connectDatabase();
    console.log(
      `Connected database: ${mongoose.connection.name}; collection: ${User.collection.collectionName}.`
    );

    const matches = await User.find({ email: ACCOUNT_EMAIL })
      .select('_id isActive')
      .limit(2)
      .exec();

    if (matches.length !== 1) {
      throw new Error(
        matches.length === 0
          ? 'No matching account exists in the connected database.'
          : 'More than one matching account exists; no changes were made.'
      );
    }

    const [user] = matches;
    if (!user.isActive) {
      throw new Error('The matching account is inactive; no changes were made.');
    }

    const password = await readHidden(
      'New password (hidden, minimum 12 characters): '
    );
    const confirmation = await readHidden('Confirm new password: ');
    if (password !== confirmation) {
      throw new Error('Passwords do not match; no changes were made.');
    }
    if (password.length < 12 || Buffer.byteLength(password, 'utf8') > 72) {
      throw new Error(
        'Password must be at least 12 characters and no more than 72 UTF-8 bytes; no changes were made.'
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const update = await User.updateOne(
      { _id: user._id, email: ACCOUNT_EMAIL, isActive: true },
      { $set: { passwordHash } }
    ).exec();

    if (update.matchedCount !== 1 || update.modifiedCount !== 1) {
      throw new Error(
        'The account was not updated exactly once; verify its status before retrying.'
      );
    }

    const updatedUser = await User.findOne({ _id: user._id })
      .select('+passwordHash')
      .exec();
    if (
      !updatedUser ||
      !(await bcrypt.compare(password, updatedUser.passwordHash))
    ) {
      throw new Error(
        'Password update could not be verified. Contact the system administrator.'
      );
    }

    console.log('Password reset and verified successfully.');
  } finally {
    await disconnectDatabase();
  }
}

resetPassword().catch((error) => {
  const safeMessages = [
    'Password reset requires an interactive terminal.',
    'Password reset cancelled.',
    'No matching account exists in the connected database.',
    'More than one matching account exists; no changes were made.',
    'The matching account is inactive; no changes were made.',
    'Passwords do not match; no changes were made.',
    'Password must be at least 12 characters and no more than 72 UTF-8 bytes; no changes were made.',
    'The account was not updated exactly once; verify its status before retrying.',
    'Password update could not be verified. Contact the system administrator.',
  ];

  if (safeMessages.includes(error.message)) {
    console.error(`Password reset failed: ${error.message}`);
  } else {
    console.error(
      `Password reset failed (${/^[A-Za-z0-9_.-]{1,100}$/.test(error.name || '') ? error.name : 'Error'}). Check the database configuration and availability.`
    );
  }
  process.exitCode = 1;
});
