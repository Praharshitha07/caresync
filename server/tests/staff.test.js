import test from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import express from 'express';
import request from 'supertest';
import { createAuthRouter } from '../src/routes/auth.routes.js';
import { createStaffRouter } from '../src/routes/staff.routes.js';
import { errorHandler } from '../src/middleware/errorHandler.js';
import User, { USER_ROLES } from '../src/models/user.model.js';

class Query {
  constructor(execute) {
    this.executeQuery = execute;
  }

  select() { return this; }
  sort() { return this; }
  lean() { return this; }
  populate() { return this; }
  session() { return this; }
  exec() { return Promise.resolve().then(this.executeQuery); }
}

function makeFixture() {
  const adminId = '64b000000000000000000001';
  const doctorId = '64b000000000000000000011';
  const admin = {
    _id: adminId,
    email: 'admin@example.test',
    displayName: 'CareSync Admin',
    role: 'admin',
    isActive: true,
    passwordHash: bcrypt.hashSync('correct admin password', 4),
  };
  const users = [admin];
  const doctors = [{
    _id: doctorId,
    name: 'Casey Example',
    specialty: 'Family Medicine',
    active: true,
  }];
  const sessions = [];
  const auditEvents = [];
  const matches = (user, filter) =>
    Object.entries(filter).every(([key, value]) => {
      if (key === '_id' || key === 'doctor') return String(user[key] || '') === String(value);
      if (value && typeof value === 'object' && '$regex' in value) {
        return new RegExp(value.$regex, value.$options).test(user[key] || '');
      }
      return user[key] === value;
    });
  const UserModel = {
    findOne(filter) {
      return new Query(() => users.find((user) => matches(user, filter)) || null);
    },
    find() {
      return new Query(() => users);
    },
    async create(documents) {
      const fields = Array.isArray(documents) ? documents[0] : documents;
      const user = {
        ...fields,
        _id: `64b0000000000000000000${String(users.length + 1).padStart(2, '0')}`,
        isActive: true,
      };
      users.push(user);
      return [user];
    },
    findByIdAndUpdate(id, update) {
      return new Query(() => {
        const user = users.find((item) => item._id === id);
        if (!user) return null;
        Object.assign(user, update.$set);
        return user;
      });
    },
  };
  const DoctorModel = {
    findOne(filter) {
      return new Query(() => doctors.find((doctor) =>
        Object.entries(filter).every(([key, value]) => {
          if (value && typeof value === 'object' && '$regex' in value) {
            return new RegExp(value.$regex, value.$options).test(doctor[key] || '');
          }
          return String(doctor[key]) === String(value);
        })
      ) || null);
    },
    findById(id) {
      return new Query(() => doctors.find((doctor) => doctor._id === String(id)) || null);
    },
    find(filter) {
      return new Query(() => doctors.filter((doctor) =>
        (filter._id?.$in || []).some((id) => String(id) === String(doctor._id))
      ));
    },
    async create(documents) {
      const created = documents.map((fields, index) => ({
        ...fields,
        _id: `64b0000000000000000000${String(doctors.length + index + 11).padStart(2, '0')}`,
      }));
      doctors.push(...created);
      return created;
    },
  };
  const SessionModel = {
    async create(session) {
      sessions.push(session);
      return session;
    },
    findOne(filter) {
      return new Query(async () => {
        const session = sessions.find((item) =>
          item.tokenHash === filter.tokenHash && item.expiresAt > filter.expiresAt.$gt
        );
        if (!session) return null;
        return { ...session, userId: users.find((user) => user._id === session.userId) };
      });
    },
    async deleteMany(filter) {
      for (let index = sessions.length - 1; index >= 0; index -= 1) {
        if (String(sessions[index].userId) === String(filter.userId)) sessions.splice(index, 1);
      }
    },
    async deleteOne(filter) {
      const index = sessions.findIndex((session) => session.tokenHash === filter.tokenHash);
      if (index !== -1) sessions.splice(index, 1);
    },
  };
  const AuditModel = {
    async create(event) {
      auditEvents.push(event);
      return event;
    },
  };
  const app = express();
  app.use(express.json());
  app.use('/api/auth', createAuthRouter({ UserModel, SessionModel, AuditModel }));
  app.use('/api/staff', createStaffRouter({
    UserModel,
    DoctorModel,
    SessionModel,
    AuditModel,
    runTransaction: (operation) => operation(null),
  }));
  app.use(errorHandler);
  return { app, users, doctors, sessions, auditEvents, adminId, doctorId };
}

async function login(app, email, password) {
  const response = await request(app)
    .post('/api/auth/login')
    .send({ email, password })
    .expect(200);
  return {
    cookie: response.headers['set-cookie'][0].split(';')[0],
    user: response.body.data.user,
  };
}

const securePassword = 'safe individual staff password';

test('admin can create a doctor profile and login account in one staff workflow', async () => {
  const fixture = makeFixture();
  const adminLogin = await login(fixture.app, 'admin@example.test', 'correct admin password');
  const payload = {
    email: 'newdoctor@example.test',
    displayName: 'Jordan Example',
    role: 'doctor',
    doctorProfile: {
      specialty: 'Neurology',
      department: 'Neurosciences',
      phone: '555-0100',
    },
    password: securePassword,
    confirmPassword: securePassword,
  };

  const created = await request(fixture.app)
    .post('/api/staff')
    .set('Cookie', adminLogin.cookie)
    .send(payload)
    .expect(201);
  const doctor = fixture.doctors.find(({ name }) => name === 'Jordan Example');
  const user = fixture.users.find(({ email }) => email === payload.email);

  assert.equal(doctor.specialty, 'Neurology');
  assert.equal(doctor.department, 'Neurosciences');
  assert.equal(doctor.email, payload.email);
  assert.equal(doctor.phone, '555-0100');
  assert.equal(user.doctor, doctor._id);
  assert.equal(created.body.data.doctor.id, doctor._id);
  assert.equal(created.body.data.passwordHash, undefined);

  const doctorLogin = await login(fixture.app, payload.email, securePassword);
  assert.equal(doctorLogin.user.role, 'doctor');
  assert.equal(doctorLogin.user.doctorId, doctor._id);

  const staffList = await request(fixture.app)
    .get('/api/staff')
    .set('Cookie', adminLogin.cookie)
    .expect(200);
  assert.equal(staffList.body.data.find(({ id }) => id === user._id).doctor.name, 'Jordan Example');
  assert.equal(JSON.stringify(staffList.body).includes(user.passwordHash), false);
  assert.equal(fixture.auditEvents.some(({ action, outcome }) =>
    action === 'create' && outcome === 'authorization_granted'
  ), true);

  await request(fixture.app)
    .post('/api/staff')
    .set('Cookie', adminLogin.cookie)
    .send({
      ...payload,
      email: 'duplicate-profile@example.test',
    })
    .expect(409);
  assert.equal(fixture.doctors.filter(({ name }) => name === 'Jordan Example').length, 1);
});

test('staff list returns all account roles without exposing password hashes', async () => {
  const fixture = makeFixture();
  const adminLogin = await login(fixture.app, 'admin@example.test', 'correct admin password');
  const accounts = [
    { email: 'nurse@example.test', displayName: 'Nurse Example', role: 'nurse' },
    { email: 'reception@example.test', displayName: 'Reception Example', role: 'receptionist' },
    { email: 'clinician@example.test', displayName: 'Clinician Example', role: 'clinician' },
    { email: 'records@example.test', displayName: 'Records Example', role: 'records_staff' },
  ];

  for (const account of accounts) {
    await request(fixture.app)
      .post('/api/staff')
      .set('Cookie', adminLogin.cookie)
      .send({
        ...account,
        password: securePassword,
        confirmPassword: securePassword,
      })
      .expect(201);
  }

  const response = await request(fixture.app)
    .get('/api/staff')
    .set('Cookie', adminLogin.cookie)
    .expect(200);
  assert.deepEqual(
    new Set(response.body.data.map(({ role }) => role)),
    new Set(['admin', 'nurse', 'receptionist', 'clinician', 'records_staff'])
  );
  assert.equal(response.body.data.length, fixture.users.length);
  assert.equal(JSON.stringify(response.body).includes('passwordHash'), false);
});

test('staff creation rejects doctor profile linking, duplicate accounts or profiles, and weak credentials', async () => {
  const fixture = makeFixture();
  const adminLogin = await login(fixture.app, 'admin@example.test', 'correct admin password');
  const emptyDoctorReference = await request(fixture.app)
    .post('/api/staff')
    .set('Cookie', adminLogin.cookie)
    .send({
      email: 'frontdesk@example.test',
      displayName: 'Front Desk',
      role: 'receptionist',
      doctorId: '',
      password: securePassword,
      confirmPassword: securePassword,
    })
    .expect(400);
  assert.equal(emptyDoctorReference.body.message, 'Request validation failed');
  assert.ok(emptyDoctorReference.body.errors.some(({ message }) =>
    message.toLowerCase().includes('doctorid')
  ));

  const payload = {
    email: 'doctor@example.test',
    displayName: 'Taylor Doctor',
    role: 'doctor',
    doctorProfile: { specialty: 'Emergency Medicine' },
    password: securePassword,
    confirmPassword: securePassword,
  };
  await request(fixture.app)
    .post('/api/staff')
    .set('Cookie', adminLogin.cookie)
    .send({ ...payload, confirmPassword: undefined })
    .expect(400);
  await request(fixture.app)
    .post('/api/staff')
    .set('Cookie', adminLogin.cookie)
    .send(payload)
    .expect(201);
  await request(fixture.app)
    .post('/api/staff')
    .set('Cookie', adminLogin.cookie)
    .send({ ...payload, email: 'another@example.test' })
    .expect(409);
  await request(fixture.app)
    .post('/api/staff')
    .set('Cookie', adminLogin.cookie)
    .send({ ...payload, displayName: 'Another', doctorProfile: undefined })
    .expect(400);
  await request(fixture.app)
    .post('/api/staff')
    .set('Cookie', adminLogin.cookie)
    .send({ ...payload, email: 'profile-link@example.test', doctorId: fixture.doctorId })
    .expect(400);
  await request(fixture.app)
    .post('/api/staff')
    .set('Cookie', adminLogin.cookie)
    .send({
      ...payload,
      email: 'admin@example.test',
      role: 'nurse',
      doctorProfile: undefined,
    })
    .expect(409);
  await request(fixture.app)
    .post('/api/staff')
    .set('Cookie', adminLogin.cookie)
    .send({ ...payload, email: 'weak@example.test', password: 'short', confirmPassword: 'short' })
    .expect(400);
});

test('only admins manage staff; receptionist cannot elevate role and doctor cannot access staff actions', async () => {
  const fixture = makeFixture();
  const adminLogin = await login(fixture.app, 'admin@example.test', 'correct admin password');
  const receptionistCreate = await request(fixture.app)
    .post('/api/staff')
    .set('Cookie', adminLogin.cookie)
    .send({
      email: 'frontdesk@example.test',
      displayName: 'Front Desk',
      role: 'receptionist',
      password: securePassword,
      confirmPassword: securePassword,
    })
    .expect(201);
  const receptionistLogin = await login(fixture.app, 'frontdesk@example.test', securePassword);
  await request(fixture.app)
    .patch(`/api/staff/${receptionistCreate.body.data.id}/status`)
    .set('Cookie', adminLogin.cookie)
    .send({ isActive: true, role: 'admin' })
    .expect(400);
  await request(fixture.app)
    .get('/api/staff')
    .set('Cookie', receptionistLogin.cookie)
    .expect(403);
  await request(fixture.app)
    .patch(`/api/staff/${receptionistCreate.body.data.id}/status`)
    .set('Cookie', receptionistLogin.cookie)
    .send({ isActive: false })
    .expect(403);
  await request(fixture.app)
    .patch(`/api/staff/${receptionistCreate.body.data.id}/status`)
    .set('Cookie', receptionistLogin.cookie)
    .send({ role: 'admin' })
    .expect(403);

  const doctorCreate = await request(fixture.app)
    .post('/api/staff')
    .set('Cookie', adminLogin.cookie)
    .send({
      email: 'doctor@example.test',
      displayName: 'Taylor Doctor',
      role: 'doctor',
      doctorProfile: { specialty: 'Emergency Medicine' },
      password: securePassword,
      confirmPassword: securePassword,
    })
    .expect(201);
  const doctorLogin = await login(fixture.app, 'doctor@example.test', securePassword);
  await request(fixture.app)
    .get('/api/staff')
    .set('Cookie', doctorLogin.cookie)
    .expect(403);
  await request(fixture.app)
    .patch(`/api/staff/${doctorCreate.body.data.id}/status`)
    .set('Cookie', doctorLogin.cookie)
    .send({ isActive: false })
    .expect(403);
  await request(fixture.app).get('/api/staff').expect(401);
});

test('deactivation revokes sessions, prevents sign-in, and administrators cannot deactivate themselves', async () => {
  const fixture = makeFixture();
  const adminLogin = await login(fixture.app, 'admin@example.test', 'correct admin password');
  await request(fixture.app)
    .patch(`/api/staff/${fixture.adminId}/status`)
    .set('Cookie', adminLogin.cookie)
    .send({ isActive: false })
    .expect(409);
  const nurse = await request(fixture.app)
    .post('/api/staff')
    .set('Cookie', adminLogin.cookie)
    .send({
      email: 'nurse@example.test',
      displayName: 'Nurse Example',
      role: 'nurse',
      password: securePassword,
      confirmPassword: securePassword,
    })
    .expect(201);
  const nurseLogin = await login(fixture.app, 'nurse@example.test', securePassword);
  await request(fixture.app)
    .patch(`/api/staff/${nurse.body.data.id}/status`)
    .set('Cookie', adminLogin.cookie)
    .send({ isActive: false })
    .expect(200);
  assert.equal(fixture.sessions.some(({ userId }) => userId === nurse.body.data.id), false);
  await request(fixture.app).get('/api/auth/session').set('Cookie', nurseLogin.cookie).expect(401);
  await request(fixture.app)
    .post('/api/auth/login')
    .send({ email: 'nurse@example.test', password: securePassword })
    .expect(401);
});

test('user model retains legacy roles and enforces a unique sparse doctor link', () => {
  assert.deepEqual(USER_ROLES, [
    'admin',
    'doctor',
    'clinician',
    'nurse',
    'receptionist',
    'records_staff',
  ]);
  assert.ok(User.schema.indexes().some(([keys, options]) =>
    keys.doctor === 1 && options.unique && options.sparse
  ));
});
