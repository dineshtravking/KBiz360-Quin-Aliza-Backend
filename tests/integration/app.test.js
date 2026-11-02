import { test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';

// These checks need no database.
process.env.NODE_ENV = 'test';
process.env.MONGODB_URI ??= 'mongodb://127.0.0.1:27017/kbiz360_test_app';
process.env.JWT_SECRET ??= 'test-secret-that-is-long-enough-for-validation-123';

const { createApp } = await import('../../src/app.js');
const app = createApp();

test('GET /api/v1/health returns the standard success shape', async () => {
  const res = await request(app).get('/api/v1/health').expect(200);

  assert.equal(res.body.success, true);
  assert.equal(res.body.data.status, 'up');
  assert.equal(typeof res.body.data.database, 'string');
});

test('protected routes need a login (401, standard error shape)', async () => {
  const res = await request(app).get('/api/v1/vouchers').expect(401);

  assert.equal(res.body.success, false);
  assert.equal(res.body.message, 'Please log in');
});

test('a bad token is rejected', async () => {
  await request(app).get('/api/v1/vouchers').set('Authorization', 'Bearer nope').expect(401);
});

test('invalid JSON body returns 400, not 500', async () => {
  const res = await request(app)
    .post('/api/v1/auth/login')
    .set('Content-Type', 'application/json')
    .send('{"bad json"')
    .expect(400);

  assert.equal(res.body.message, 'Request body is not valid JSON');
});

test('login input is validated', async () => {
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: 'not-an-email' })
    .expect(400);

  assert.equal(res.body.message, 'Validation failed');
  assert.ok(res.body.details.some((d) => d.field === 'email'));
});

test('security headers are set', async () => {
  const res = await request(app).get('/api/v1/health');

  assert.equal(res.headers['x-powered-by'], undefined);
  assert.ok(res.headers['x-content-type-options']);
});
