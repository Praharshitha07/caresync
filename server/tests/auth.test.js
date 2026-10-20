import test from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import express from 'express';
import request from 'supertest';
import { createAuthRouter } from '../src/routes/auth.routes.js';
import { createPatientRouter } from '../src/routes/patient.routes.js';
import { createRequireAuthentication } from '../src/middleware/auth.middleware.js';
import { errorHandler } from '../src/middleware/errorHandler.js';

function query(execute) {
  return {
    select() {
      return this;
    },
    populate() {
      return this;
    },
    lean() {
      return this;
    },
    exec: execute,
  };
}

async function createAuthTestApp() {
  const users = [
    {
      _id: 'admin-id',
      email: 'admin@example.test',
      displayName: 'Test Admin',
      role: 'admin',
      isActive: true,
      passwordHash: await bcrypt.hash('correct horse battery staple', 12),
    },
    {
      _id: 'records-id',
      email: 'records@example.test',
      displayName: 'Records Staff',
      role: 'records_staff',
      isActive: true,
      passwordHash: await bcrypt.hash('records secret passphrase', 12),
    },
  ];
  const sessions = [];
  const UserModel = {
    findOne(filter) {
      return query(async () => users.find((user) => user.email === filter.email) || null);
    },
  };
  const SessionModel = {
    async create(session) {
      sessions.push(session);
      return session;
    },
    findOne(filter) {
      return {
        populate() {
          return this;
        },
        async exec() {
          const found = sessions.find(
            (session) =>
              session.tokenHash === filter.tokenHash &&
              session.expiresAt > filter.expiresAt.$gt
          );
          if (!found) return null;
          return { ...found, userId: users.find((user) => user._id === found.userId) };
        },
      };
    },
    async deleteOne(filter) {
      const index = sessions.findIndex((session) => session.tokenHash === filter.tokenHash);
      if (index !== -1) sessions.splice(index, 1);
    },
  };
  const patientModel = {
    findOne() {
      return query(async () => null);
    },
    async create() {
      throw new Error('Patient create must not run for insufficient roles');
    },
  };
  const auditModel = {
    async create(event) {
      return event;
    },
  };
  const authenticate = createRequireAuthentication(SessionModel);
  const app = express();
  app.use(express.json());
  app.use('/api/auth', createAuthRouter({ UserModel, SessionModel, authenticate }));
  app.use(
    '/api/patients',
    createPatientRouter(patientModel, { authenticate, AuditModel: auditModel })
  );
  app.use(errorHandler);
  return { app, sessions };
}

test('authentication verifies credentials, issues a secure session cookie, and redacts secrets', async () => {
  const { app, sessions } = await createAuthTestApp();
  const response = await request(app)
    .post('/api/auth/login')
    .send({ email: ' ADMIN@example.test ', password: 'correct horse battery staple' })
    .expect(200);

  assert.equal(response.body.success, true);
  assert.deepEqual(response.body.data.user, {
    id: 'admin-id',
    email: 'admin@example.test',
    displayName: 'Test Admin',
    role: 'admin',
  });
  assert.equal(response.body.data.user.passwordHash, undefined);
  assert.equal(response.body.data.user.password, undefined);
  assert.equal(sessions.length, 1);
  assert.match(sessions[0].tokenHash, /^[a-f0-9]{64}$/);
  assert.equal(sessions[0].token, undefined);
  assert.match(response.headers['set-cookie'][0], /HttpOnly/i);
  assert.match(response.headers['set-cookie'][0], /SameSite=Strict/i);
  assert.doesNotMatch(response.headers['set-cookie'][0], /password|correct horse/i);
});

test('invalid or unknown credentials return the same generic response', async () => {
  const { app } = await createAuthTestApp();
  const knownUser = await request(app)
    .post('/api/auth/login')
    .send({ email: 'admin@example.test', password: 'incorrect password' })
    .expect(401);
  const unknownUser = await request(app)
    .post('/api/auth/login')
    .send({ email: 'unknown@example.test', password: 'incorrect password' })
    .expect(401);

  assert.deepEqual(knownUser.body, unknownUser.body);
  assert.equal(knownUser.body.message, 'Email or password is incorrect');
});

test('authentication is required, sessions are revocable, and roles restrict patient writes', async () => {
  const { app, sessions } = await createAuthTestApp();
  await request(app).get('/api/auth/session').expect(401);
  await request(app).get('/api/patients').expect(401);

  const login = await request(app)
    .post('/api/auth/login')
    .send({ email: 'records@example.test', password: 'records secret passphrase' })
    .expect(200);
  const cookie = login.headers['set-cookie'][0].split(';')[0];

  const currentSession = await request(app)
    .get('/api/auth/session')
    .set('Cookie', cookie)
    .expect(200);
  assert.equal(currentSession.body.data.user.role, 'records_staff');
  assert.equal(currentSession.body.data.user.passwordHash, undefined);

  await request(app)
    .post('/api/patients')
    .set('Cookie', cookie)
    .set('Origin', 'https://untrusted.example')
    .send({ firstName: 'Origin must be rejected first' })
    .expect(403);

  await request(app)
    .post('/api/patients')
    .set('Cookie', cookie)
    .send({ firstName: 'Not permitted' })
    .expect(403);

  await request(app)
    .get('/api/patients/CS-0001')
    .set('Cookie', cookie)
    .expect(404);

  await request(app).post('/api/auth/logout').set('Cookie', cookie).expect(200);
  assert.equal(sessions.length, 0);
  await request(app)
    .get('/api/auth/session')
    .set('Cookie', cookie)
    .expect(401);
});

test('login rejects malformed input and does not allow client-selected roles', async () => {
  const { app } = await createAuthTestApp();
  const response = await request(app)
    .post('/api/auth/login')
    .send({
      email: 'admin@example.test',
      password: 'correct horse battery staple',
      role: 'admin',
    })
    .expect(400);
  assert.equal(response.body.message, 'Request validation failed');
});
