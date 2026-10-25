import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import request from 'supertest';
import { createDoctorRouter } from '../src/routes/doctor.routes.js';
import { createAppointmentRouter } from '../src/routes/appointment.routes.js';
import { errorHandler } from '../src/middleware/errorHandler.js';
import Doctor from '../src/models/doctor.model.js';

class Query {
  constructor(execute) {
    this.executeQuery = execute;
  }

  select() { return this; }
  sort() { return this; }
  lean() { return this; }
  exec() { return Promise.resolve().then(this.executeQuery); }
}

function applyFilter(document, filter) {
  return Object.entries(filter).every(([field, expected]) => {
    if (field === '$or') return expected.some((branch) => applyFilter(document, branch));
    if (field === '_id' && expected?.$ne) return String(document._id) !== String(expected.$ne);
    if (expected && typeof expected === 'object' && expected.$regex) {
      return new RegExp(expected.$regex, expected.$options).test(document[field] || '');
    }
    return document[field] === expected;
  });
}

function makeModels() {
  const doctors = [];
  let id = 0;
  const DoctorModel = {
    doctors,
    find(filter) {
      return new Query(() => doctors.filter((doctor) => applyFilter(doctor, filter)));
    },
    findOne(filter) {
      return new Query(() => doctors.find((doctor) => applyFilter(doctor, filter)) || null);
    },
    findById(identifier) {
      return new Query(() => doctors.find((doctor) => doctor._id === identifier) || null);
    },
    findByIdAndUpdate(identifier, update) {
      return new Query(() => {
        const doctor = doctors.find((item) => item._id === identifier);
        if (!doctor) return null;
        Object.assign(doctor, update.$set);
        return doctor;
      });
    },
    async create(fields) {
      const doctor = {
        ...fields,
        _id: (++id).toString(16).padStart(24, '0'),
        active: fields.active ?? true,
      };
      doctors.push(doctor);
      return doctor;
    },
  };
  const appointments = [];
  const AppointmentModel = {
    appointments,
    async create(fields) {
      const appointment = { ...fields, _id: 'appointment-1' };
      appointments.push(appointment);
      return appointment;
    },
    findOneAndUpdate(filter, update) {
      return new Query(() => {
        const appointment = appointments.find((item) => item._id === filter._id);
        if (!appointment) return null;
        Object.assign(appointment, update.$set);
        return appointment;
      });
    },
  };
  const PatientModel = {
    findOne() {
      return new Query(() => ({ patientId: 'CS-TEST' }));
    },
  };
  return { DoctorModel, AppointmentModel, PatientModel };
}

function createApp(role = 'admin') {
  const models = makeModels();
  const auditEvents = [];
  const AuditModel = { async create(event) { auditEvents.push(event); } };
  const authenticate = (req, res, next) => {
    if (!req.headers.authorization) {
      return res.status(401).json({ success: false, message: 'Authentication is required' });
    }
    req.auth = { userId: 'user-1', role: req.headers['x-role'] || role };
    return next();
  };
  const app = express();
  app.use(express.json());
  app.use('/api/doctors', createDoctorRouter({
    ...models,
    AuditModel,
    authenticate,
  }));
  app.use('/api/appointments', createAppointmentRouter({
    ...models,
    AuditModel,
    authenticate,
  }));
  app.use(errorHandler);
  return { app, ...models, auditEvents };
}

const doctorPayload = {
  name: 'Jordan Example',
  specialty: 'Family Medicine',
  department: 'Primary Care',
  email: 'JORDAN@example.test',
  phone: '555-0101',
  professionalIdentifier: 'DEV-TEST-001',
};

test('only admins can create, edit, or deactivate doctor profiles', async () => {
  const { app, DoctorModel, auditEvents } = createApp();
  await request(app)
    .post('/api/doctors')
    .set('Authorization', 'test')
    .set('x-role', 'nurse')
    .send(doctorPayload)
    .expect(403);
  assert.equal(DoctorModel.doctors.length, 0);

  const created = await request(app)
    .post('/api/doctors')
    .set('Authorization', 'test')
    .send(doctorPayload)
    .expect(201);
  const doctorId = created.body.data.id;
  assert.equal(created.body.data.email, 'jordan@example.test');
  assert.equal(created.body.data.active, true);

  await request(app)
    .patch(`/api/doctors/${doctorId}`)
    .set('Authorization', 'test')
    .set('x-role', 'clinician')
    .send({ specialty: 'Cardiology' })
    .expect(403);

  const updated = await request(app)
    .patch(`/api/doctors/${doctorId}`)
    .set('Authorization', 'test')
    .send({ specialty: 'Cardiology', active: false })
    .expect(200);
  assert.equal(updated.body.data.specialty, 'Cardiology');
  assert.equal(updated.body.data.active, false);
  assert.equal(auditEvents.find(({ action }) => action === 'create').resource, 'doctors');
  const updateDecisions = auditEvents.filter(({ action }) => action === 'update');
  assert.ok(updateDecisions.some(({ outcome }) => outcome === 'authorization_granted'));
  assert.ok(updateDecisions.some(({ outcome }) => outcome === 'role_denied'));
});

test('doctor profiles validate inputs and reject duplicate name-specialty pairs', async () => {
  const { app, DoctorModel } = createApp();
  await request(app)
    .post('/api/doctors')
    .set('Authorization', 'test')
    .send({ ...doctorPayload, email: 'not-an-email' })
    .expect(400);
  await request(app)
    .post('/api/doctors')
    .set('Authorization', 'test')
    .send({ ...doctorPayload, name: '' })
    .expect(400);

  const created = await request(app)
    .post('/api/doctors')
    .set('Authorization', 'test')
    .send(doctorPayload)
    .expect(201);
  const duplicate = await request(app)
    .post('/api/doctors')
    .set('Authorization', 'test')
    .send({ ...doctorPayload, name: 'jordan example', professionalIdentifier: 'DEV-TEST-002' })
    .expect(409);
  assert.equal(duplicate.body.message, 'A doctor with this name and specialty already exists');

  const updated = await request(app)
    .patch(`/api/doctors/${created.body.data.id}`)
    .set('Authorization', 'test')
    .send({ specialty: '' })
    .expect(400);
  assert.equal(updated.body.message, 'Request validation failed');
  assert.equal(DoctorModel.doctors.length, 1);
});

test('doctor listing filters, supports admin inactive profiles, and protects inactive view', async () => {
  const { app, DoctorModel } = createApp();
  await DoctorModel.create({ ...doctorPayload, active: true });
  await DoctorModel.create({
    ...doctorPayload,
    name: 'Inactive Example',
    professionalIdentifier: 'DEV-TEST-002',
    active: false,
  });

  const active = await request(app)
    .get('/api/doctors')
    .set('Authorization', 'test')
    .expect(200);
  assert.equal(active.body.data.length, 1);

  const searched = await request(app)
    .get('/api/doctors?includeInactive=true&search=Inactive')
    .set('Authorization', 'test')
    .expect(200);
  assert.equal(searched.body.data.length, 1);
  assert.equal(searched.body.data[0].active, false);

  await request(app)
    .get('/api/doctors?includeInactive=true')
    .set('Authorization', 'test')
    .set('x-role', 'nurse')
    .expect(403);
});

test('appointment doctor selection persists Mongo reference and resolves its display name', async () => {
  const { app, DoctorModel, AppointmentModel } = createApp();
  const doctor = await DoctorModel.create(doctorPayload);
  const doctorId = doctor._id;
  const appointment = await request(app)
    .post('/api/appointments')
    .set('Authorization', 'test')
    .send({
      patientId: 'CS-TEST',
      date: '2026-10-28',
      time: '10:00 AM',
      reason: 'Follow-up',
      type: 'Consultation',
      assignedDoctor: doctor.name,
      doctorId,
    })
    .expect(201);
  assert.equal(AppointmentModel.appointments[0].doctor, doctorId);
  assert.equal(appointment.body.data.assignedDoctor, doctor.name);
  assert.equal(appointment.body.data.doctorId, doctorId);

  const replacementDoctor = await DoctorModel.create({
    ...doctorPayload,
    name: 'Riley Example',
    professionalIdentifier: 'DEV-TEST-002',
  });
  const updated = await request(app)
    .patch(`/api/appointments/${appointment.body.data.id}`)
    .set('Authorization', 'test')
    .send({ doctorId: replacementDoctor._id, assignedDoctor: replacementDoctor.name })
    .expect(200);
  assert.equal(AppointmentModel.appointments[0].doctor, replacementDoctor._id);
  assert.equal(updated.body.data.assignedDoctor, replacementDoctor.name);
});

test('doctor schema validates required profile fields', async () => {
  await assert.rejects(new Doctor({ name: '', specialty: '' }).validate(), {
    name: 'ValidationError',
  });
});
