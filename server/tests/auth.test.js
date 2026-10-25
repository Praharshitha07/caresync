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
      _id: '64b000000000000000000001',
      email: 'admin@example.test',
      displayName: 'Test Admin',
      role: 'admin',
      isActive: true,
      passwordHash: await bcrypt.hash('correct horse battery staple', 12),
    },
    {
      _id: '64b000000000000000000002',
      email: 'records@example.test',
      displayName: 'Records Staff',
      role: 'records_staff',
      isActive: true,
      passwordHash: await bcrypt.hash('records secret passphrase', 12),
    },
    {
      _id: '64b000000000000000000003',
      email: 'inactive@example.test',
      displayName: 'Inactive Staff',
      role: 'nurse',
      isActive: false,
      passwordHash: await bcrypt.hash('inactive account passphrase', 12),
    },
  ];
  const sessions = [];
  const auditEvents = [];
  const UserModel = {
    findOne(filter) {
      return query(
        async () =>
          users.find(
            (user) =>
              (filter.email && user.email === filter.email) ||
              (filter._id && user._id === filter._id)
          ) || null
      );
    },
    updateOne(filter, update) {
      return {
        async exec() {
          const user = users.find(
            (item) => item._id === filter._id && item.isActive === filter.isActive
          );
          if (!user) return { matchedCount: 0 };
          Object.assign(user, update.$set);
          return { matchedCount: 1 };
        },
      };
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
    async deleteMany(filter) {
      for (let index = sessions.length - 1; index >= 0; index -= 1) {
        if (sessions[index].userId === filter.userId) sessions.splice(index, 1);
      }
    },
  };
  const AuditModel = {
    async create(event) {
      auditEvents.push(event);
      return event;
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
  app.use(
    '/api/auth',
    createAuthRouter({ UserModel, SessionModel, AuditModel, authenticate })
  );
  app.use(
    '/api/patients',
    createPatientRouter(patientModel, { authenticate, AuditModel: auditModel })
  );
  app.use(errorHandler);
  return { app, sessions, users, auditEvents };
}

test('authentication verifies credentials, issues a secure session cookie, and redacts secrets', async () => {
  const { app, sessions } = await createAuthTestApp();
  const response = await request(app)
    .post('/api/auth/login')
    .send({ email: ' ADMIN@example.test ', password: 'correct horse battery staple' })
    .expect(200);

  assert.equal(response.body.success, true);
  assert.deepEqual(response.body.data.user, {
    id: '64b000000000000000000001',
    email: 'admin@example.test',
    displayName: 'Test Admin',
    role: 'admin',
    doctorId: '',
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

test('admin password reset changes the bcrypt hash and revokes the target sessions', async () => {
  const { app, sessions, users, auditEvents } = await createAuthTestApp();
  const targetLogin = await request(app)
    .post('/api/auth/login')
    .send({ email: 'records@example.test', password: 'records secret passphrase' })
    .expect(200);
  const targetCookie = targetLogin.headers['set-cookie'][0].split(';')[0];
  const adminLogin = await request(app)
    .post('/api/auth/login')
    .send({ email: 'admin@example.test', password: 'correct horse battery staple' })
    .expect(200);
  const adminCookie = adminLogin.headers['set-cookie'][0].split(';')[0];

  const response = await request(app)
    .patch('/api/auth/users/64b000000000000000000002/password')
    .set('Cookie', adminCookie)
    .send({
      newPassword: 'replacement secure passphrase',
      confirmPassword: 'replacement secure passphrase',
    })
    .expect(200);

  assert.equal(response.body.success, true);
  assert.equal(response.body.data, undefined);
  assert.equal(sessions.length, 1);
  assert.equal(
    await bcrypt.compare(
      'replacement secure passphrase',
      users[1].passwordHash
    ),
    true
  );
  assert.equal(auditEvents.at(-1).action, 'reset_password');
  assert.equal(auditEvents.at(-1).resource, 'users');
  assert.equal(auditEvents.at(-1).resourceId, '64b000000000000000000002');
  assert.equal(
    JSON.stringify(response.body).includes(users[1].passwordHash),
    false
  );

  await request(app)
    .get('/api/auth/session')
    .set('Cookie', targetCookie)
    .expect(401);
  await request(app)
    .post('/api/auth/login')
    .send({ email: 'records@example.test', password: 'records secret passphrase' })
    .expect(401);
  await request(app)
    .post('/api/auth/login')
    .send({
      email: 'records@example.test',
      password: 'replacement secure passphrase',
    })
    .expect(200);
});

test('password reset requires admin authorization and rejects missing or inactive accounts', async () => {
  const { app, users, auditEvents } = await createAuthTestApp();
  const staffLogin = await request(app)
    .post('/api/auth/login')
    .send({ email: 'records@example.test', password: 'records secret passphrase' })
    .expect(200);
  const staffCookie = staffLogin.headers['set-cookie'][0].split(';')[0];
  const resetBody = {
    newPassword: 'replacement secure passphrase',
    confirmPassword: 'replacement secure passphrase',
  };

  await request(app)
    .patch('/api/auth/users/64b000000000000000000001/password')
    .send(resetBody)
    .expect(401);
  await request(app)
    .patch('/api/auth/users/64b000000000000000000001/password')
    .set('Cookie', staffCookie)
    .send(resetBody)
    .expect(403);
  assert.equal(auditEvents.at(-1).outcome, 'role_denied');
  assert.equal(
    await bcrypt.compare('correct horse battery staple', users[0].passwordHash),
    true
  );

  const adminLogin = await request(app)
    .post('/api/auth/login')
    .send({ email: 'admin@example.test', password: 'correct horse battery staple' })
    .expect(200);
  const adminCookie = adminLogin.headers['set-cookie'][0].split(';')[0];
  await request(app)
    .patch('/api/auth/users/64b000000000000000000099/password')
    .set('Cookie', adminCookie)
    .send(resetBody)
    .expect(404);
  await request(app)
    .patch('/api/auth/users/64b000000000000000000003/password')
    .set('Cookie', adminCookie)
    .send(resetBody)
    .expect(409);
  assert.equal(
    await bcrypt.compare(
      'inactive account passphrase',
      users[2].passwordHash
    ),
    true
  );
});

test('password reset validates confirmation and password length', async () => {
  const { app } = await createAuthTestApp();
  const adminLogin = await request(app)
    .post('/api/auth/login')
    .send({ email: 'admin@example.test', password: 'correct horse battery staple' })
    .expect(200);
  const adminCookie = adminLogin.headers['set-cookie'][0].split(';')[0];
  const endpoint = '/api/auth/users/64b000000000000000000002/password';

  await request(app)
    .patch(endpoint)
    .set('Cookie', adminCookie)
    .send({ newPassword: 'short', confirmPassword: 'short' })
    .expect(400);
  await request(app)
    .patch(endpoint)
    .set('Cookie', adminCookie)
    .send({
      newPassword: 'replacement secure passphrase',
      confirmPassword: 'different secure passphrase',
    })
    .expect(400);
  await request(app)
    .patch(endpoint)
    .set('Cookie', adminCookie)
    .send({
      newPassword: '😀'.repeat(19),
      confirmPassword: '😀'.repeat(19),
    })
    .expect(400);
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
