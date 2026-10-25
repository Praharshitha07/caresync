import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import request from 'supertest';
import { createAppointmentRouter } from '../src/routes/appointment.routes.js';
import { createMedicalRecordRouter } from '../src/routes/medical-record.routes.js';
import { errorHandler } from '../src/middleware/errorHandler.js';

class Query {
  constructor(execute) {
    this.execute = execute;
  }

  sort(options) {
    this.sortOptions = options;
    return this;
  }

  skip(amount) {
    this.skipAmount = amount;
    return this;
  }

  limit(amount) {
    this.limitAmount = amount;
    return this;
  }

  select() {
    return this;
  }

  lean() {
    return this;
  }

  exec() {
    return Promise.resolve().then(() => this.execute());
  }
}

function matches(record, filter) {
  for (const [field, expected] of Object.entries(filter)) {
    if (field === '$or') {
      if (!expected.some((condition) => matches(record, condition))) return false;
    } else if (field === '$and') {
      if (!expected.every((condition) => matches(record, condition))) return false;
    } else if (expected === null) {
      if (record[field]) return false;
    } else if (expected && typeof expected === 'object') {
      if ('$regex' in expected) {
        if (!new RegExp(expected.$regex, expected.$options).test(record[field] || '')) return false;
      } else if ('$in' in expected) {
        if (!expected.$in.includes(record[field])) return false;
      } else {
        if ('$gte' in expected && record[field] < expected.$gte) return false;
        if ('$lte' in expected && record[field] > expected.$lte) return false;
      }
    } else if (record[field] !== expected) {
      return false;
    }
  }
  return true;
}

function createCollection() {
  const records = [];
  let nextId = 0;

  return {
    records,
    find(filter) {
      const query = new Query(() => records.filter((record) => matches(record, filter)));
      const execute = query.execute;
      query.execute = () => {
        const results = execute();
        const [field, direction] = Object.entries(query.sortOptions || {})[0] || [];
        if (field) results.sort((a, b) => String(a[field]).localeCompare(String(b[field])) * direction);
        return results.slice(
          query.skipAmount || 0,
          (query.skipAmount || 0) + (query.limitAmount || results.length)
        );
      };
      return query;
    },
    countDocuments(filter) {
      return Promise.resolve(records.filter((record) => matches(record, filter)).length);
    },
    findOne(filter) {
      return new Query(() => records.find((record) => matches(record, filter)) || null);
    },
    async create(input) {
      const record = {
        ...input,
        _id: `record-${++nextId}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      records.push(record);
      return record;
    },
    findOneAndUpdate(filter, update) {
      return new Query(() => {
        const record = records.find((entry) => matches(entry, filter));
        if (!record) return null;
        Object.assign(record, update.$set, { updatedAt: new Date() });
        return record;
      });
    },
  };
}

function createClinicalApp({
  role = 'clinician',
  auditFailure = false,
  doctorId = 'doctor-profile-1',
  assignedDoctorId = 'doctor-profile-1',
} = {}) {
  const medicalRecords = createCollection();
  const appointments = createCollection();
  const auditEvents = [];
  const patient = {
    patientId: 'CS-TEST',
    firstName: 'Synthetic',
    lastName: 'Patient',
    doctor: assignedDoctorId,
    archivedAt: null,
  };
  const doctorModel = {
    findOne(filter) {
      return new Query(() =>
        String(filter._id) === String(assignedDoctorId) && filter.active === true
          ? { _id: assignedDoctorId, name: 'Linked Doctor', active: true }
          : null
      );
    },
    findById(id) {
      return new Query(() => String(id) === String(assignedDoctorId)
        ? { _id: assignedDoctorId, name: 'Linked Doctor' }
        : null);
    },
    find(filter) {
      return new Query(() => (filter._id?.$in || []).includes(assignedDoctorId)
        ? [{ _id: assignedDoctorId, name: 'Linked Doctor' }]
        : []);
    },
  };
  const patientModel = {
    find(filter) {
      return new Query(async () => {
        if (filter.doctor && String(filter.doctor) !== String(patient.doctor)) return [];
        if (filter.$and) return matches(patient, { $and: filter.$and }) ? [patient] : [];
        if (filter.patientId?.$in) {
          return filter.patientId.$in.includes(patient.patientId) &&
            (filter.archivedAt !== null || patient.archivedAt === null)
            ? [patient]
            : [];
        }
        if (filter.doctor) return patient.archivedAt === null ? [patient] : [];
        return [];
      });
    },
    findOne(filter) {
      return new Query(async () =>
        filter.patientId === 'CS-TEST' &&
        filter.archivedAt === null &&
        (!filter.doctor || String(filter.doctor) === String(patient.doctor))
          ? patient
          : null
      );
    },
  };
  const AuditModel = {
    async create(event) {
      if (auditFailure) {
        throw Object.assign(new Error('audit store unavailable'), {
          name: 'MongooseServerSelectionError',
        });
      }
      auditEvents.push(event);
      return event;
    },
  };
  const authenticate = (req, res, next) => {
    if (!req.headers.authorization) {
      return res.status(401).json({ success: false, message: 'Authentication is required' });
    }
    req.auth = {
      userId: 'staff-1',
      role,
      doctorId: role === 'doctor' ? doctorId : '',
    };
    return next();
  };

  const app = express();
  app.use(express.json());
  app.use(
    '/api/medical-records',
    createMedicalRecordRouter({
      MedicalRecordModel: medicalRecords,
      PatientModel: patientModel,
      DoctorModel: doctorModel,
      AuditModel,
      authenticate,
    })
  );
  app.use(
    '/api/appointments',
    createAppointmentRouter({
      AppointmentModel: appointments,
      PatientModel: patientModel,
      DoctorModel: doctorModel,
      AuditModel,
      authenticate,
    })
  );
  app.use(errorHandler);
  return { app, medicalRecords, appointments, auditEvents };
}

const recordPayload = {
  patientId: 'CS-TEST',
  visitDate: '2026-10-20',
  diagnosis: 'Fictional diagnosis',
  treatment: 'Fictional treatment',
  prescriptions: '',
  clinicalNotes: '',
  attendingPhysician: 'Dr Test',
  department: 'General Medicine',
  followUpDate: '',
  severity: 'Moderate',
};

const appointmentPayload = {
  patientId: 'CS-TEST',
  date: '2026-10-21',
  time: '10:00 AM',
  reason: 'Fictional follow-up',
  type: 'Consultation',
  assignedDoctor: 'Dr Test',
  room: 'Room 1',
};

test('clinical record endpoints deny unauthenticated access and validate input', async () => {
  const { app } = createClinicalApp();
  await request(app).get('/api/medical-records').expect(401);
  await request(app).get('/api/appointments').expect(401);

  const invalid = await request(app)
    .post('/api/medical-records')
    .set('Authorization', 'test-session')
    .send({ ...recordPayload, patientId: 'unknown', unexpected: true })
    .expect(400);
  assert.equal(invalid.body.message, 'Request validation failed');
});

test('clinicians can create and read records; audit decisions store metadata, not clinical text', async () => {
  const { app, auditEvents } = createClinicalApp({ role: 'clinician' });
  const created = await request(app)
    .post('/api/medical-records')
    .set('Authorization', 'test-session')
    .send(recordPayload)
    .expect(201);
  assert.equal(created.body.data.patientId, 'CS-TEST');
  assert.equal(created.body.data.diagnosis, recordPayload.diagnosis);

  await request(app)
    .get(`/api/medical-records/${created.body.data.id}`)
    .set('Authorization', 'test-session')
    .expect(200);

  assert.equal(auditEvents.length, 2);
  assert.equal(auditEvents[0].resource, 'medical_records');
  assert.equal(auditEvents[0].subjectId, 'CS-TEST');
  assert.equal(auditEvents[0].actorId, 'staff-1');
  assert.equal(auditEvents[0].outcome, 'authorization_granted');
  assert.equal(auditEvents[0].diagnosis, undefined);
  assert.equal(auditEvents[0].clinicalNotes, undefined);
});

test('clinical list searches filter records and appointments safely across pages', async () => {
  const { app, medicalRecords } = createClinicalApp();
  await request(app)
    .post('/api/medical-records')
    .set('Authorization', 'test-session')
    .send(recordPayload)
    .expect(201);
  await request(app)
    .post('/api/appointments')
    .set('Authorization', 'test-session')
    .send(appointmentPayload)
    .expect(201);

  const records = await request(app)
    .get('/api/medical-records')
    .query({ search: 'fictional diagnosis' })
    .set('Authorization', 'test-session')
    .expect(200);
  assert.equal(records.body.pagination.total, 1);
  assert.equal(records.body.data[0].diagnosis, recordPayload.diagnosis);
  assert.equal(records.body.data[0].patientName, 'Synthetic Patient');

  const firstNameSearch = await request(app)
    .get('/api/medical-records')
    .query({ search: 'Synthetic' })
    .set('Authorization', 'test-session')
    .expect(200);
  assert.equal(firstNameSearch.body.pagination.total, 1);
  assert.equal(firstNameSearch.body.data[0].patientName, 'Synthetic Patient');

  const fullNameSearch = await request(app)
    .get('/api/medical-records')
    .query({ search: 'Synthetic Patient' })
    .set('Authorization', 'test-session')
    .expect(200);
  assert.equal(fullNameSearch.body.pagination.total, 1);

  const patientIdSearch = await request(app)
    .get('/api/medical-records')
    .query({ search: 'CS-TEST' })
    .set('Authorization', 'test-session')
    .expect(200);
  assert.equal(patientIdSearch.body.pagination.total, 1);

  const physicianSearch = await request(app)
    .get('/api/medical-records')
    .query({ search: 'Dr Test' })
    .set('Authorization', 'test-session')
    .expect(200);
  assert.equal(physicianSearch.body.pagination.total, 1);

  medicalRecords.records.push({
    ...recordPayload,
    patientId: 'CS-MISSING',
    _id: 'record-orphan',
    createdAt: new Date(),
    updatedAt: new Date(),
    archivedAt: null,
  });
  const orphanRecord = await request(app)
    .get('/api/medical-records')
    .set('Authorization', 'test-session')
    .expect(200);
  const orphan = orphanRecord.body.data.find(({ patientId }) => patientId === 'CS-MISSING');
  assert.ok(orphan);
  assert.equal(orphan.patientName, '');

  const escapedSearch = await request(app)
    .get('/api/medical-records')
    .query({ search: '.*' })
    .set('Authorization', 'test-session')
    .expect(200);
  assert.equal(escapedSearch.body.pagination.total, 0);

  const appointments = await request(app)
    .get('/api/appointments')
    .query({ search: 'fictional follow-up' })
    .set('Authorization', 'test-session')
    .expect(200);
  assert.equal(appointments.body.pagination.total, 1);
  assert.equal(appointments.body.data[0].reason, appointmentPayload.reason);
  assert.equal(appointments.body.data[0].patientName, 'Synthetic Patient');
});

test('records staff can read clinical records and schedule appointments, but cannot edit them', async () => {
  const { app, auditEvents } = createClinicalApp({ role: 'records_staff' });
  const appointment = await request(app)
    .post('/api/appointments')
    .set('Authorization', 'test-session')
    .send(appointmentPayload)
    .expect(201);
  assert.equal(appointment.body.data.status, 'Scheduled');

  await request(app)
    .patch(`/api/appointments/${appointment.body.data.id}`)
    .set('Authorization', 'test-session')
    .send({ status: 'Confirmed' })
    .expect(403);

  assert.equal(auditEvents.length, 2);
  assert.equal(auditEvents[0].resource, 'appointments');
  assert.equal(auditEvents[0].outcome, 'authorization_granted');
  assert.equal(auditEvents[1].outcome, 'role_denied');
});

test('receptionists may schedule appointments but cannot read clinical records or update appointments', async () => {
  const { app } = createClinicalApp({ role: 'receptionist' });
  await request(app)
    .get('/api/medical-records')
    .set('Authorization', 'test-session')
    .expect(403);
  await request(app)
    .get('/api/appointments')
    .set('Authorization', 'test-session')
    .expect(200);
  const created = await request(app)
    .post('/api/appointments')
    .set('Authorization', 'test-session')
    .send(appointmentPayload)
    .expect(201);
  assert.equal(created.body.data.reason, 'Scheduled appointment');
  await request(app)
    .patch(`/api/appointments/${created.body.data.id}`)
    .set('Authorization', 'test-session')
    .send({ status: 'Confirmed' })
    .expect(403);
});

test('doctor accounts are scoped to their linked profile and record authorship uses that profile', async () => {
  const { app, medicalRecords, appointments } = createClinicalApp({
    role: 'doctor',
    doctorId: '64b000000000000000000001',
    assignedDoctorId: '64b000000000000000000001',
  });
  const record = await request(app)
    .post('/api/medical-records')
    .set('Authorization', 'test-session')
    .send({ ...recordPayload, attendingPhysician: 'Spoofed Name' })
    .expect(201);
  assert.equal(record.body.data.attendingPhysician, 'Linked Doctor');

  const appointment = await request(app)
    .post('/api/appointments')
    .set('Authorization', 'test-session')
    .send({
      ...appointmentPayload,
      assignedDoctor: 'Spoofed Name',
      doctorId: '64b000000000000000000001',
    })
    .expect(201);
  assert.equal(appointment.body.data.assignedDoctor, 'Linked Doctor');
  assert.equal(appointments.records[0].doctor, '64b000000000000000000001');

  medicalRecords.records.push({
    ...recordPayload,
    patientId: 'CS-OTHER',
    _id: 'foreign-record',
    archivedAt: null,
  });
  appointments.records.push({
    ...appointmentPayload,
    _id: 'foreign-appointment',
    doctor: '64b000000000000000000002',
    archivedAt: null,
  });
  const records = await request(app)
    .get('/api/medical-records')
    .set('Authorization', 'test-session')
    .expect(200);
  assert.deepEqual(records.body.data.map(({ patientId }) => patientId), ['CS-TEST']);
  await request(app)
    .get('/api/medical-records/foreign-record')
    .set('Authorization', 'test-session')
    .expect(404);
  const appointmentList = await request(app)
    .get('/api/appointments')
    .set('Authorization', 'test-session')
    .expect(200);
  assert.deepEqual(appointmentList.body.data.map(({ id }) => id), [appointment.body.data.id]);
  await request(app)
    .get('/api/appointments/foreign-appointment')
    .set('Authorization', 'test-session')
    .expect(404);
});

test('admin archival is soft, and audit-store failure blocks clinical reads', async () => {
  const admin = createClinicalApp({ role: 'admin' });
  const created = await request(admin.app)
    .post('/api/appointments')
    .set('Authorization', 'test-session')
    .send(appointmentPayload)
    .expect(201);
  await request(admin.app)
    .delete(`/api/appointments/${created.body.data.id}`)
    .set('Authorization', 'test-session')
    .expect(200);
  assert.equal(admin.appointments.records.length, 1);
  assert.ok(admin.appointments.records[0].archivedAt);
  assert.equal(admin.appointments.records[0].status, 'Cancelled');

  const failingAudit = createClinicalApp({ role: 'clinician', auditFailure: true });
  const response = await request(failingAudit.app)
    .get('/api/medical-records')
    .set('Authorization', 'test-session')
    .expect(503);
  assert.equal(response.body.message, 'Database is temporarily unavailable');
});
