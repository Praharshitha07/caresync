import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import request from 'supertest';
import app from '../src/app.js';
import { connectDatabase, getDatabaseStatus } from '../src/config/database.js';
import { isValidMongoUri } from '../src/config/env.js';

test('CareSync Express API & MongoDB Health Tests', async (t) => {
  await t.test('GET /api/health should return 200 and process status', async () => {
    const res = await request(app)
      .get('/api/health')
      .expect(200)
      .expect('Content-Type', /json/);

    assert.equal(res.body.success, true);
    assert.equal(res.body.message, 'CareSync API service is running');
    assert.ok(res.body.environment);
  });

  await t.test('patient data and session endpoints reject unauthenticated requests', async () => {
    const patientResponse = await request(app)
      .get('/api/patients')
      .expect(401)
      .expect('Content-Type', /json/);
    assert.equal(patientResponse.body.message, 'Authentication is required');

    const sessionResponse = await request(app)
      .get('/api/auth/session')
      .expect(401)
      .expect('Content-Type', /json/);
    assert.equal(sessionResponse.body.message, 'Authentication is required');
  });

  await t.test(
    'GET /api/health/db should return 200 when Mongoose is connected',
    async () => {
      const originalState = mongoose.connection.readyState;
      mongoose.connection.readyState = 1;
      try {
        const res = await request(app)
          .get('/api/health/db')
          .expect(200)
          .expect('Content-Type', /json/);

        assert.equal(res.body.success, true);
        assert.equal(res.body.message, 'Database is connected and operational');
        assert.equal(res.body.database.status, 'connected');
        assert.equal(res.body.database.readyState, 1);
        assert.equal(res.body.uri, undefined);
        assert.equal(res.body.connectionString, undefined);
        assert.equal(res.body.stack, undefined);
      } finally {
        mongoose.connection.readyState = originalState;
      }
    }
  );

  await t.test(
    'GET /api/health/db should return 503 when database is disconnected',
    async () => {
      const res = await request(app)
        .get('/api/health/db')
        .expect(503)
        .expect('Content-Type', /json/);

      assert.equal(res.body.success, false);
      assert.equal(res.body.message, 'Database is not connected');
      assert.equal(res.body.database.status, 'disconnected');
      assert.equal(res.body.database.readyState, 0);
      // Ensure no credentials or connection strings leaked in response
      assert.equal(res.body.uri, undefined);
      assert.equal(res.body.connectionString, undefined);
      assert.equal(res.body.stack, undefined);
    }
  );

  await t.test(
    'GET /api/nonexistent-route should return 404 with standard error format',
    async () => {
      const res = await request(app)
        .get('/api/nonexistent-route')
        .expect(404)
        .expect('Content-Type', /json/);

      assert.equal(res.body.success, false);
      assert.ok(res.body.message.includes('Route not found'));
    }
  );

  await t.test(
    'POST with malformed JSON should return 400 Bad Request with safe message',
    async () => {
      const res = await request(app)
        .post('/api/health')
        .set('Content-Type', 'application/json')
        .send('{"invalidJson": }')
        .expect(400)
        .expect('Content-Type', /json/);

      assert.equal(res.body.success, false);
      assert.equal(res.body.message, 'Invalid JSON payload received');
    }
  );

  await t.test(
    'connectDatabase should reject if MONGODB_URI is missing or empty',
    async () => {
      await assert.rejects(
        async () => {
          await connectDatabase('');
        },
        {
          name: 'ConfigurationError',
          message:
            'MONGODB_URI configuration is missing. The server cannot start without a valid database connection string.',
        }
      );
    }
  );

  await t.test(
    'connectDatabase should reject if MONGODB_URI has invalid protocol',
    async () => {
      await assert.rejects(
        async () => {
          await connectDatabase('postgres://user:pass@localhost:5432/db');
        },
        {
          name: 'ConfigurationError',
          message:
            'Invalid MONGODB_URI format. Use a valid mongodb:// or mongodb+srv:// connection URI.',
        }
      );
    }
  );

  await t.test('MONGODB_URI validation accepts Atlas SRV URIs without exposing values', () => {
    assert.equal(
      isValidMongoUri('mongodb+srv://user:encoded%40password@cluster.example.mongodb.net/caresync'),
      true
    );
    assert.equal(isValidMongoUri('mongodb+srv://cluster.example.mongodb.net:27017/caresync'), false);
    assert.equal(isValidMongoUri('mongodb://username@localhost:27017/caresync'), false);
    assert.equal(isValidMongoUri('https://example.com'), false);
  });
});
