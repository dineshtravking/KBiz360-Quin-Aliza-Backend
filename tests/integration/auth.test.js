import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { ADMIN, startTestApp } from '../helpers.js';

let t;
let admin;

before(async () => {
  t = await startTestApp('auth');
  admin = await t.login();
});
after(() => t.close());

describe('login', () => {
  test('wrong password gives the same message as an unknown email', async () => {
    const wrong = await t.api().post('/auth/login', { email: ADMIN.email, password: 'nope' });
    const unknown = await t
      .api()
      .post('/auth/login', { email: 'ghost@test.local', password: 'nope' });
    assert.equal(wrong.status, 401);
    assert.equal(unknown.status, 401);
    assert.equal(wrong.body.message, unknown.body.message);
  });

  test('success returns a token and the role permissions, never the password hash', async () => {
    const res = await t.api().post('/auth/login', ADMIN).expect(200);
    assert.ok(res.body.data.token);
    assert.equal(res.body.data.user.role.isSuperAdmin, true);
    assert.ok(res.body.data.user.role.permissions.includes('vouchers:create'));
    assert.equal(JSON.stringify(res.body).includes('passwordHash'), false);
  });

  test('GET /auth/me returns the logged-in user', async () => {
    const res = await t.api(admin).get('/auth/me').expect(200);
    assert.equal(res.body.data.email, ADMIN.email);
  });
});

describe('permissions', () => {
  test('a read-only Owner can view but not change anything', async () => {
    const owner = await t.createUser(admin, { roleKey: 'owner', email: 'owner@test.local' });
    await t.api(owner).get('/clients').expect(200);
    const res = await t.api(owner).post('/clients', { name: 'Should fail' }).expect(403);
    assert.match(res.body.message, /View-only/);
  });

  test('an Accountant cannot manage users or masters', async () => {
    const accountant = await t.createUser(admin, {
      roleKey: 'accountant',
      email: 'acc@test.local',
    });
    await t.api(accountant).get('/users').expect(403);
    await t.api(accountant).post('/suppliers', { name: 'Nope Ltd' }).expect(403);
    await t.api(accountant).get('/accounts').expect(200);
  });

  test('only a Super Admin can create another Super Admin', async () => {
    const gm = await t.createUser(admin, { roleKey: 'general_manager', email: 'gm@test.local' });
    const res = await t.api(gm).post('/users', {
      name: 'Sneaky',
      email: 'sneaky@test.local',
      password: 'Passw0rd123',
      roleId: String(t.seed.roles.super_admin._id),
    });
    assert.equal(res.status, 403);
  });
});

describe('branch scope', () => {
  let manager;

  before(async () => {
    manager = await t.createUser(admin, {
      roleKey: 'branch_manager',
      email: 'shop1@test.local',
      branchIds: [t.branch('S1')],
    });
  });

  test('a branch manager only sees their own branch', async () => {
    const res = await t.api(manager).get('/branches').expect(200);
    assert.deepEqual(
      res.body.data.map((b) => b.code),
      ['S1'],
    );
  });

  test('asking for another branch is refused', async () => {
    await t.api(manager, t.branch('S2')).get('/vouchers').expect(403);
  });

  test('Group view cannot create branch data', async () => {
    const res = await t.api(admin).post('/godowns', { name: 'No Branch Godown' }).expect(400);
    assert.match(res.body.message, /Choose a branch/);
  });
});

describe('password change', () => {
  test('old token stops working, new token works', async () => {
    const email = 'changer@test.local';
    const oldToken = await t.createUser(admin, { roleKey: 'accountant', email });
    // Tokens carry whole seconds; wait so the change is strictly newer.
    await new Promise((r) => setTimeout(r, 1100));
    const res = await t
      .api(oldToken)
      .post('/auth/change-password', {
        currentPassword: 'Passw0rd123',
        newPassword: 'NewPassw0rd9',
      })
      .expect(200);
    await t.api(oldToken).get('/auth/me').expect(401);
    await t.api(res.body.data.token).get('/auth/me').expect(200);
  });
});

test('every successful change is in the audit log', async () => {
  await t.api(admin).post('/tax-codes', { name: 'TVA 16', rate: 16 }).expect(201);
  const res = await t.api(admin).get('/audit-logs?method=POST').expect(200);
  assert.ok(
    res.body.data.some((e) => e.path === '/api/v1/tax-codes' && e.userName === 'Super Admin'),
  );
});
