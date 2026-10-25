import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import request from 'supertest';
import { createPatientRouter } from '../src/routes/patient.routes.js';
import { toPatientResponse } from '../src/controllers/patient.controller.js';
import { errorHandler } from '../src/middleware/errorHandler.js';
import { env } from '../src/config/env.js';
import Patient from '../src/models/patient.model.js';

const idFor = (number) => number.toString(16).padStart(24, '0');

function matches(document, filter) {
  if (filter.archivedAt === null && document.archivedAt) return false;
  if (filter.status && document.status !== filter.status) return false;
  if (filter.createdAt && document.createdAt < filter.createdAt.$gte) return false;
  if (filter.patientId && document.patientId !== filter.patientId) return false;
  if (filter._id && document._id !== String(filter._id)) return false;
  if (filter.doctor && String(document.doctor || '') !== String(filter.doctor)) return false;
  if (filter.$and && !filter.$and.every((condition) => matches(document, condition))) return false;
  if (filter.$or && !filter.$or.some((condition) => {
    const [field, pattern] = Object.entries(condition)[0];
    return pattern.test(String(document[field] || ''));
  })) return false;
  return true;
}

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

function createTestModel() {
  const records = [];
  let createFailure = null;
  let queryFailure = null;

  return {
    records,
    failNextCreate(error) {
      createFailure = error;
    },
    failQueries(error) {
      queryFailure = error;
    },
    find(filter) {
      let query;
      query = new Query(() => {
        if (queryFailure) throw queryFailure;
        const rows = records.filter((record) => matches(record, filter));
        const sort = query.sortOptions || {};
        rows.sort((left, right) => {
          for (const [key, direction] of Object.entries(sort)) {
            const comparison = String(left[key] || '').localeCompare(String(right[key] || ''));
            if (comparison) return comparison * direction;
          }
          return 0;
        });
        return rows.slice(
          query.skipAmount || 0,
          (query.skipAmount || 0) + (query.limitAmount || rows.length)
        );
      });
      return query;
    },
    countDocuments(filter) {
      return Promise.resolve(records.filter((record) => matches(record, filter)).length);
    },
    findOne(filter) {
      return new Query(() => {
        if (queryFailure) throw queryFailure;
        return records.find((record) => matches(record, filter)) || null;
      });
    },
    create(input) {
      if (createFailure) {
        const error = createFailure;
        createFailure = null;
        return Promise.reject(error);
      }
      const record = {
        ...input,
        patientId: `CS-${String(records.length + 8901).padStart(4, '0')}`,
        _id: idFor(records.length + 1),
        createdAt: new Date(),
        updatedAt: new Date(),
        archivedAt: null,
      };
      records.push(record);
      return Promise.resolve(record);
    },
    findOneAndUpdate(filter, update) {
      return new Query(() => {
        if (queryFailure) throw queryFailure;
        const record = records.find((entry) => matches(entry, filter));
        if (!record) return null;
        Object.assign(record, update.$set, { updatedAt: new Date() });
        return record;
      });
    },
  };
}

function createTestDoctorModel() {
  const doctors = [
    {
      _id: idFor(100),
      name: 'Alex Sample',
      specialty: 'Family Medicine',
      active: true,
    },
  ];
  return {
    doctors,
    findOne(filter) {
      return new Query(() =>
        doctors.find((doctor) =>
          Object.entries(filter).every(([key, value]) =>
            String(doctor[key]) === String(value)
          )
        ) || null
      );
    },
    find(filter) {
      return new Query(() => doctors.filter((doctor) => filter._id.$in.includes(doctor._id)));
    },
  };
}

function createTestApp(
  model,
  {
    authenticated = true,
    role = 'admin',
    doctorId = '',
    DoctorModel = createTestDoctorModel(),
  } = {}
) {
  const app = express();
  app.use(express.json());
  const authenticate = authenticated
    ? (req, res, next) => {
        req.auth = { userId: 'test-user', role, doctorId };
        next();
      }
    : undefined;
  const auditEvents = [];
  const AuditModel = {
    async create(event) {
      auditEvents.push(event);
      return event;
    },
  };
  app.use('/api/patients', createPatientRouter(model, { authenticate, AuditModel, DoctorModel }));
  app.use(errorHandler);
  return { app, auditEvents, DoctorModel };
}

const validPatient = {
  firstName: 'Fictional',
  lastName: 'Patient',
  dob: '1990-02-03',
  gender: 'Undisclosed',
  phone: '555-0100',
  email: 'PATIENT@example.test',
  status: 'Outpatient',
  doctorId: idFor(100),
};

test('patient response retains historical physician name if the linked profile is unavailable', () => {
  const patient = {
    patientId: 'CS-HISTORY',
    firstName: 'Fictional',
    lastName: 'Patient',
    dob: '1990-02-03',
    gender: 'Undisclosed',
    phone: '555-0100',
    email: '',
    status: 'Outpatient',
    doctor: idFor(100),
    primaryPhysician: 'Historical Physician',
    createdAt: new Date('2025-01-01T00:00:00.000Z'),
    updatedAt: new Date('2025-01-01T00:00:00.000Z'),
  };

  assert.equal(toPatientResponse(patient).doctorName, 'Historical Physician');
  assert.equal(
    toPatientResponse(patient, { receptionist: true }).doctorName,
    'Historical Physician'
  );
});

test('patient demographic edits preserve a legacy doctor reference without reassigning it', async () => {
  const model = createTestModel();
  const historicalDoctorId = idFor(100);
  model.records.push({
    patientId: 'CS-HISTORY',
    firstName: 'Fictional',
    lastName: 'Patient',
    dob: '1990-02-03',
    gender: 'Undisclosed',
    phone: '555-0100',
    email: '',
    status: 'Outpatient',
    doctor: historicalDoctorId,
    primaryPhysician: 'Historical Physician',
    createdAt: new Date('2025-01-01T00:00:00.000Z'),
    updatedAt: new Date('2025-01-01T00:00:00.000Z'),
    archivedAt: null,
  });
  const { app } = createTestApp(model, { DoctorModel: { findOne: () => new Query(() => null) } });

  const response = await request(app)
    .patch('/api/patients/CS-HISTORY')
    .send({ phone: '555-0101', doctorId: historicalDoctorId })
    .expect(200);

  assert.equal(model.records[0].doctor, historicalDoctorId);
  assert.equal(response.body.data.doctorName, 'Historical Physician');
});

test('patient API validates and manages patient records', async (t) => {
  const model = createTestModel();
  const { app, auditEvents, DoctorModel } = createTestApp(model);

  await t.test('rejects missing required fields and invalid values', async () => {
    const missing = await request(app).post('/api/patients').send({ firstName: 'Only' }).expect(400);
    assert.equal(missing.body.success, false);
    assert.ok(missing.body.errors.some((item) => item.field === 'lastName'));

    const invalid = await request(app)
      .post('/api/patients')
      .send({ ...validPatient, dob: '2999-01-01', ignored: 'not allowed' })
      .expect(400);
    assert.equal(invalid.body.message, 'Request validation failed');
  });

  await t.test('creates patients with a generated stable identifier', async () => {
    const response = await request(app).post('/api/patients').send(validPatient).expect(201);
    assert.match(response.body.data.id, /^CS-\d{4}$/);
    assert.equal(response.body.data.patientId, response.body.data.id);
    assert.equal(response.body.data.email, 'patient@example.test');
    assert.equal(response.body.data.name, 'Fictional Patient');
    assert.equal(response.body.data.doctorId, idFor(100));
    assert.equal(response.body.data.doctorName, 'Alex Sample');
    assert.equal(model.records[0].doctor, idFor(100));
    assert.equal(auditEvents.at(-1).resource, 'patients');
    assert.equal(auditEvents.at(-1).action, 'create');
    assert.equal(auditEvents.at(-1).subjectId, undefined);
    assert.equal(auditEvents.at(-1).outcome, 'authorization_granted');
  });

  await t.test('maps duplicate identifier conflicts to a safe 409 response', async () => {
    model.failNextCreate(Object.assign(new Error('duplicate value includes private data'), { code: 11000 }));
    const response = await request(app).post('/api/patients').send(validPatient).expect(409);
    assert.equal(response.body.message, 'A patient with a conflicting identifier already exists');
    assert.equal(response.body.stack, undefined);
  });

  await t.test('requires an existing active doctor assignment', async () => {
    const missingAssignment = { ...validPatient };
    delete missingAssignment.doctorId;
    await request(app).post('/api/patients').send(missingAssignment).expect(400);

    const inactiveDoctors = createTestDoctorModel();
    inactiveDoctors.doctors[0].active = false;
    const inactiveApp = createTestApp(createTestModel(), { DoctorModel: inactiveDoctors }).app;
    const inactiveResponse = await request(inactiveApp)
      .post('/api/patients')
      .send(validPatient)
      .expect(400);
    assert.equal(inactiveResponse.body.message, 'Selected doctor is not active');

    const demoDoctors = createTestDoctorModel();
    demoDoctors.doctors[0].professionalIdentifier = 'DEV-FICTIONAL-001';
    const demoApp = createTestApp(createTestModel(), { DoctorModel: demoDoctors }).app;
    const demoResponse = await request(demoApp)
      .post('/api/patients')
      .send(validPatient)
      .expect(400);
    assert.equal(demoResponse.body.message, 'Selected doctor is not active');

    const secondDoctorId = idFor(101);
    DoctorModel.doctors.push({
      _id: secondDoctorId,
      name: 'Casey Example',
      specialty: 'Cardiology',
      active: true,
    });
    const reassigned = await request(app)
      .patch('/api/patients/CS-8901')
      .send({ doctorId: secondDoctorId })
      .expect(200);
    assert.equal(model.records[0].doctor, secondDoctorId);
    assert.equal(reassigned.body.data.doctorName, 'Casey Example');

    const updated = await request(app)
      .patch('/api/patients/CS-8901')
      .send({ doctorId: 'not-an-object-id' })
      .expect(400);
    assert.equal(updated.body.message, 'Request validation failed');
  });

  await t.test('lists using bounded pagination, search, status filters, and sorting', async () => {
    await request(app).post('/api/patients').send({ ...validPatient, firstName: 'Other', status: 'Admitted' }).expect(201);
    const response = await request(app)
      .get('/api/patients?page=1&limit=1&search=Fictional%20Patient&status=Outpatient&sort=name&order=asc')
      .expect(200);

    assert.equal(response.body.data.length, 1);
    assert.equal(response.body.data[0].firstName, 'Fictional');
    assert.equal(response.body.pagination.total, 1);
    assert.equal(response.body.pagination.page, 1);
    assert.equal(response.body.pagination.limit, 1);
    assert.equal(response.body.pagination.activeTotal, 2);
    assert.equal(response.body.data[0].emergencyContact, undefined);
    assert.equal(response.body.data[0].allergies, undefined);

    const paginated = await request(app).get('/api/patients?page=1&limit=1').expect(200);
    assert.equal(paginated.body.data.length, 1);
    assert.equal(paginated.body.pagination.total, 2);

    await request(app).get('/api/patients?limit=51').expect(400);
    await request(app).get('/api/patients?sort=__proto__').expect(400);
  });

  await t.test('escapes search expressions and retrieves by stable or Mongo identifier', async () => {
    const escaped = await request(app).get('/api/patients?search=%5B').expect(200);
    assert.equal(escaped.body.pagination.total, 0);

    const byPatientId = await request(app).get('/api/patients/CS-8901').expect(200);
    assert.equal(byPatientId.body.data.id, 'CS-8901');

    const mongoId = idFor(1);
    const byMongoId = await request(app).get(`/api/patients/${mongoId}`).expect(200);
    assert.equal(byMongoId.body.data.id, 'CS-8901');
    assert.equal(byMongoId.body.data.mongoId, undefined);

    await request(app).get('/api/patients/not-an-id').expect(400);
    await request(app).get('/api/patients/CS-9999').expect(404);
  });

  await t.test('updates only permitted fields and archives without cascading deletion', async () => {
    const updated = await request(app)
      .patch('/api/patients/CS-8901')
      .send({ phone: '555-0199' })
      .expect(200);
    assert.equal(updated.body.data.phone, '555-0199');

    await request(app)
      .patch('/api/patients/CS-8901')
      .send({ patientId: 'CS-0000' })
      .expect(400);

    const archived = await request(app).delete('/api/patients/CS-8901').expect(200);
    assert.equal(archived.body.data.archived, true);
    await request(app).get('/api/patients/CS-8901').expect(404);
  });

  await t.test('returns a safe service-unavailable response for database errors', async () => {
    model.failQueries(Object.assign(new Error('driver URI and credentials'), { name: 'MongooseServerSelectionError' }));
    const response = await request(app).get('/api/patients').expect(503);
    assert.equal(response.body.message, 'Database is temporarily unavailable');
    assert.equal(response.body.stack, undefined);
  });
});

test('patient schema generates normalized identity data without a database', async () => {
  const patient = new Patient({ ...validPatient, firstName: '  Fictional  ' });
  assert.match(patient.patientId, /^CS-[A-F0-9]{12}$/);
  assert.equal(patient.firstName, 'Fictional');
  assert.equal(patient.email, 'patient@example.test');
  await patient.validate();
  assert.ok(
    Patient.schema.indexes().some(([keys, options]) => keys.patientId === 1 && options.unique)
  );
});

test('receptionists can register demographics but cannot submit or read clinical patient details', async () => {
  const model = createTestModel();
  const { app } = createTestApp(model, { role: 'receptionist' });
  const response = await request(app)
    .post('/api/patients')
    .set('Authorization', 'test-session')
    .send({
      firstName: 'Front',
      lastName: 'Desk',
      dob: '1990-02-03',
      gender: 'Undisclosed',
      phone: '555-0100',
      email: '',
      address: '',
      emergencyContact: { name: '', relationship: '', phone: '' },
      doctorId: idFor(100),
    });
  assert.equal(response.status, 201, JSON.stringify(response.body));
  assert.equal(response.body.data.allergies, undefined);
  assert.equal(response.body.data.dob, undefined);

  await request(app)
    .post('/api/patients')
    .set('Authorization', 'test-session')
    .send({
      firstName: 'Attempt',
      lastName: 'Clinical',
      dob: '1990-02-03',
      gender: 'Undisclosed',
      phone: '555-0101',
      doctorId: idFor(100),
      allergies: 'private clinical data',
    })
    .expect(400);

  const demographic = await request(app)
    .get(`/api/patients/${response.body.data.id}`)
    .set('Authorization', 'test-session')
    .expect(200);
  assert.equal(demographic.body.data.dob, validPatient.dob);
  assert.equal(demographic.body.data.allergies, undefined);
});

test('receptionists can update only patient demographic fields', async () => {
  const model = createTestModel();
  const adminApp = createTestApp(model).app;
  const patientResponse = await request(adminApp)
    .post('/api/patients')
    .send({
      ...validPatient,
      address: '12 Example Street',
      emergencyContact: { name: 'Casey Patient', relationship: 'Sibling', phone: '555-0102' },
      allergies: 'Existing clinical detail',
    })
    .expect(201);
  const patientId = patientResponse.body.data.id;
  const receptionistApp = createTestApp(model, { role: 'receptionist' }).app;

  const retrieved = await request(receptionistApp)
    .get(`/api/patients/${patientId}`)
    .set('Authorization', 'test-session')
    .expect(200);
  assert.equal(retrieved.body.data.dob, validPatient.dob);
  assert.equal(retrieved.body.data.address, '12 Example Street');
  assert.equal(retrieved.body.data.allergies, undefined);

  const updated = await request(receptionistApp)
    .patch(`/api/patients/${patientId}`)
    .set('Authorization', 'test-session')
    .send({
      phone: '555-0199',
      address: '14 Example Street',
      emergencyContact: { name: 'Jordan Patient', relationship: 'Sibling', phone: '555-0103' },
    })
    .expect(200);
  assert.equal(updated.body.data.phone, '555-0199');
  assert.equal(updated.body.data.address, '14 Example Street');
  assert.equal(updated.body.data.allergies, undefined);

  await request(receptionistApp)
    .patch(`/api/patients/${patientId}`)
    .set('Authorization', 'test-session')
    .send({ allergies: 'Attempted clinical update' })
    .expect(400);
  await request(receptionistApp)
    .patch(`/api/patients/${patientId}`)
    .set('Authorization', 'test-session')
    .send({ doctorId: idFor(101) })
    .expect(400);
});

test('doctor accounts can only list and retrieve patients assigned to their linked profile', async () => {
  const model = createTestModel();
  model.records.push(
    {
      ...validPatient,
      patientId: 'CS-DOCTOR-1',
      _id: idFor(501),
      doctor: idFor(100),
      createdAt: new Date(),
      updatedAt: new Date(),
      archivedAt: null,
    },
    {
      ...validPatient,
      firstName: 'Other',
      patientId: 'CS-DOCTOR-2',
      _id: idFor(502),
      doctor: idFor(101),
      createdAt: new Date(),
      updatedAt: new Date(),
      archivedAt: null,
    }
  );
  const DoctorModel = createTestDoctorModel();
  const { app } = createTestApp(model, {
    role: 'doctor',
    doctorId: idFor(100),
    DoctorModel,
  });
  const list = await request(app)
    .get('/api/patients')
    .set('Authorization', 'test-session')
    .expect(200);
  assert.deepEqual(list.body.data.map(({ patientId }) => patientId), ['CS-DOCTOR-1']);
  await request(app)
    .get('/api/patients/CS-DOCTOR-2')
    .set('Authorization', 'test-session')
    .expect(404);
  DoctorModel.doctors[0].active = false;
  await request(app)
    .get('/api/patients')
    .set('Authorization', 'test-session')
    .expect(403);
});

test('patient routes require authentication in production', async () => {
  const previousEnvironment = env.NODE_ENV;
  env.NODE_ENV = 'production';
  try {
    const { app } = createTestApp(createTestModel(), { authenticated: false });
    const response = await request(app)
      .get('/api/patients')
      .expect(401);
    assert.equal(response.body.message, 'Authentication is required');
  } finally {
    env.NODE_ENV = previousEnvironment;
  }
});
