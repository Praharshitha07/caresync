import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import request from 'supertest';
import { createPatientRouter } from '../src/routes/patient.routes.js';
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

function createTestApp(model, { authenticated = true, role = 'admin' } = {}) {
  const app = express();
  app.use(express.json());
  const authenticate = authenticated
    ? (req, res, next) => {
        req.auth = { userId: 'test-user', role };
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
  app.use('/api/patients', createPatientRouter(model, { authenticate, AuditModel }));
  app.use(errorHandler);
  return { app, auditEvents };
}

const validPatient = {
  firstName: 'Fictional',
  lastName: 'Patient',
  dob: '1990-02-03',
  gender: 'Undisclosed',
  phone: '555-0100',
  email: 'PATIENT@example.test',
  status: 'Outpatient',
};

test('patient API validates and manages patient records', async (t) => {
  const model = createTestModel();
  const { app, auditEvents } = createTestApp(model);

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
