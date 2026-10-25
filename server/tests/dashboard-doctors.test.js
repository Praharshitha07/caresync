import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import request from 'supertest';
import { createDashboardRouter } from '../src/routes/dashboard.routes.js';
import { createDoctorRouter } from '../src/routes/doctor.routes.js';
import { errorHandler } from '../src/middleware/errorHandler.js';
import AuditEvent from '../src/models/audit-event.model.js';
import Doctor from '../src/models/doctor.model.js';
import Patient from '../src/models/patient.model.js';

class Query {
  constructor(execute) {
    this.execute = execute;
  }

  select() { return this; }
  sort() { return this; }
  limit() { return this; }
  lean() { return this; }
  exec() { return Promise.resolve().then(this.execute); }
}

function createFixture({
  failDashboard = false,
  recentPatients = [],
  summary = {
    totalPatients: 0,
    todayAppointments: 0,
    upcomingAppointments: 0,
    recentlyAddedPatients: 0,
  },
} = {}) {
  const todayString = new Date().toISOString().slice(0, 10);
  const doctor = {
    _id: '507f1f77bcf86cd799439011',
    name: 'Alex Sample',
    specialty: 'Family Medicine',
    department: 'Primary Care',
    professionalIdentifier: 'DEV-FICTIONAL-001',
    active: true,
  };
  const inactiveDoctor = {
    _id: '507f1f77bcf86cd799439012',
    name: 'Taylor Inactive',
    specialty: 'Dermatology',
    active: false,
  };
  const countFilters = [];
  const patientModel = {
    countDocuments(filter) {
      countFilters.push(filter);
      if (failDashboard) return Promise.reject(Object.assign(new Error('database unavailable'), {
        name: 'MongooseServerSelectionError',
      }));
      if (filter.createdAt) return Promise.resolve(summary.recentlyAddedPatients);
      return Promise.resolve(summary.totalPatients);
    },
    find(filter) {
      if (filter.patientId) return new Query(() => []);
      return new Query(() => recentPatients);
    },
  };
  const appointmentModel = {
    countDocuments(filter) {
      countFilters.push(filter);
      if (failDashboard) return Promise.reject(Object.assign(new Error('database unavailable'), {
        name: 'MongooseServerSelectionError',
      }));
      return Promise.resolve(
        filter.date?.$gte ? summary.upcomingAppointments : summary.todayAppointments
      );
    },
    find() {
      return new Query(() => []);
    },
  };
  const doctorModel = {
    find(filter) {
      return new Query(() => (filter.active
        ? [doctor, inactiveDoctor].filter(({ active }) => active)
        : [doctor, inactiveDoctor].filter(({ _id }) => filter._id.$in.includes(_id))));
    },
  };
  const auditEvents = [];
  const AuditModel = {
    async create(event) {
      await new AuditEvent(event).validate();
      auditEvents.push(event);
    },
  };
  const authenticate = (req, res, next) => {
    if (!req.headers.authorization) {
      return res.status(401).json({ success: false, message: 'Authentication is required' });
    }
    req.auth = { userId: 'staff-1', role: req.headers['x-role'] || 'clinician' };
    return next();
  };
  const app = express();
  app.use('/api/dashboard', createDashboardRouter({
    PatientModel: patientModel,
    AppointmentModel: appointmentModel,
    DoctorModel: doctorModel,
    AuditModel,
    authenticate,
  }));
  app.use('/api/doctors', createDoctorRouter({
    DoctorModel: doctorModel,
    AuditModel,
    authenticate,
  }));
  app.use(errorHandler);
  return { app, countFilters, auditEvents, todayString };
}

test('dashboard returns database counts and zero-valued empty state', async () => {
  const { app, countFilters, auditEvents, todayString } = createFixture();
  const response = await request(app)
    .get('/api/dashboard')
    .set('Authorization', 'Bearer session')
    .expect(200);

  assert.deepEqual(response.body.data.stats, {
    totalPatients: 0,
    todayAppointments: 0,
    upcomingAppointments: 0,
    recentlyAddedPatients: 0,
  });
  assert.deepEqual(response.body.data.recentPatients, []);
  assert.deepEqual(response.body.data.upcomingAppointments, []);
  assert.equal(countFilters[1].date, todayString);
  assert.deepEqual(countFilters[1].status.$in, ['Scheduled', 'Confirmed', 'In Progress']);
  assert.deepEqual(countFilters[2].date, { $gte: todayString });
  assert.equal(auditEvents[0].resource, 'dashboard');
});

test('dashboard returns non-zero counts reported by database queries', async () => {
  const expected = {
    totalPatients: 17,
    todayAppointments: 3,
    upcomingAppointments: 8,
    recentlyAddedPatients: 2,
  };
  const { app } = createFixture({ summary: expected });
  const response = await request(app)
    .get('/api/dashboard')
    .set('Authorization', 'Bearer session')
    .expect(200);
  assert.deepEqual(response.body.data.stats, expected);
});

test('dashboard includes active patient and assigned doctor without requiring medical records', async () => {
  const assignedDoctorId = '507f1f77bcf86cd799439011';
  const { app } = createFixture({
    summary: {
      totalPatients: 1,
      todayAppointments: 0,
      upcomingAppointments: 0,
      recentlyAddedPatients: 1,
    },
    recentPatients: [{
      _id: '507f191e810c19729de860ea',
      patientId: 'CS-TEST',
      firstName: 'Fictional',
      lastName: 'Patient',
      dob: '1990-02-03',
      gender: 'Undisclosed',
      phone: '555-0100',
      email: '',
      status: 'Outpatient',
      doctor: assignedDoctorId,
      createdAt: new Date(),
      updatedAt: new Date(),
    }],
  });
  const response = await request(app)
    .get('/api/dashboard')
    .set('Authorization', 'Bearer session')
    .expect(200);

  assert.equal(response.body.data.recentPatients.length, 1);
  assert.equal(response.body.data.recentPatients[0].name, 'Fictional Patient');
  assert.equal(response.body.data.recentPatients[0].doctorId, assignedDoctorId);
  assert.equal(response.body.data.recentPatients[0].doctorName, 'Alex Sample');
  assert.deepEqual(response.body.data.upcomingAppointments, []);
});

test('dashboard errors are returned rather than presented as zero counts', async () => {
  const { app } = createFixture({ failDashboard: true });
  const response = await request(app)
    .get('/api/dashboard')
    .set('Authorization', 'Bearer session')
    .expect(503);
  assert.equal(response.body.data, undefined);
  assert.equal(response.body.success, false);
});

test('active doctor directory requires authorization and excludes inactive records', async () => {
  const { app, auditEvents } = createFixture();
  await request(app).get('/api/doctors').expect(401);

  const response = await request(app)
    .get('/api/doctors')
    .set('Authorization', 'Bearer session')
    .expect(200);
  assert.deepEqual(response.body.data, [{
    id: '507f1f77bcf86cd799439011',
    name: 'Alex Sample',
    specialty: 'Family Medicine',
    department: 'Primary Care',
    email: '',
    phone: '',
    professionalIdentifier: 'DEV-FICTIONAL-001',
    active: true,
  }]);
  assert.equal(auditEvents[0].resource, 'doctors');

  await request(app)
    .get('/api/doctors')
    .set('Authorization', 'Bearer session')
    .set('x-role', 'records_staff')
    .expect(200);
  const denied = await request(app)
    .get('/api/doctors')
    .set('Authorization', 'Bearer session')
    .set('x-role', 'billing')
    .expect(403);
  assert.equal(denied.body.message, 'Your role is not authorized for this operation');
});

test('doctor model enforces required clinical fields and unique identifiers', async () => {
  const doctor = new Doctor({ name: 'Alex Sample', specialty: 'Family Medicine' });
  await doctor.validate();
  const indexes = Doctor.schema.indexes();
  assert.ok(indexes.some(([keys, options]) =>
    keys.professionalIdentifier === 1 && options.unique && options.sparse
  ));

  const invalid = new Doctor({ name: '', specialty: '' });
  await assert.rejects(invalid.validate(), { name: 'ValidationError' });
  assert.ok(Patient.schema.path('doctor'));
});

test('dashboard and doctor audit resources pass the production audit schema', async () => {
  for (const resource of ['dashboard', 'doctors']) {
    const event = new AuditEvent({
      requestId: 'e5cc2bac-682e-4315-b832-37de4394bded',
      actorId: 'staff-1',
      actorRole: 'clinician',
      action: 'read_list',
      resource,
      outcome: 'authorization_granted',
    });
    await event.validate();
  }
});
