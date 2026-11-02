import request from 'supertest';

export const ADMIN = { email: 'admin@test.local', password: 'Admin12345' };

// Starts the app against a fresh database for one test file.
// Each file gets its own database (test files run in parallel).
export async function startTestApp(name) {
  process.env.NODE_ENV = 'test';
  process.env.BCRYPT_ROUNDS = '4';
  process.env.JWT_SECRET ??= 'test-secret-that-is-long-enough-for-validation-123';
  process.env.MONGODB_URI = `mongodb://127.0.0.1:27017/kbiz360_test_${name}`;

  const { default: mongoose } = await import('mongoose');
  const { connectDatabase, disconnectDatabase } = await import('../src/config/database.js');
  const { createApp } = await import('../src/app.js');
  const { seedDatabase } = await import('../scripts/seed.js');

  await connectDatabase();
  await mongoose.connection.dropDatabase();
  const seed = await seedDatabase({
    adminEmail: ADMIN.email,
    adminPassword: ADMIN.password,
    demo: true,
  });
  const app = createApp();

  // api(token, branchId).post('/vouchers', body) → supertest request
  const api = (token, branchId) => {
    const call = (method) => (url, body) => {
      let req = request(app)[method](`/api/v1${url}`);
      if (token) req = req.set('Authorization', `Bearer ${token}`);
      if (branchId) req = req.set('X-Branch-Id', String(branchId));
      return body === undefined ? req : req.send(body);
    };
    return {
      get: call('get'),
      post: call('post'),
      put: call('put'),
      patch: call('patch'),
      delete: call('delete'),
    };
  };

  const login = async (email = ADMIN.email, password = ADMIN.password) => {
    const res = await api().post('/auth/login', { email, password });
    if (res.status !== 200)
      throw new Error(`Login failed for ${email}: ${JSON.stringify(res.body)}`);
    return res.body.data.token;
  };

  // Creates a user with a built-in role and returns their token.
  const createUser = async (adminToken, { roleKey, email, branchIds, name = roleKey }) => {
    const password = 'Passw0rd123';
    const res = await api(adminToken).post('/users', {
      name,
      email,
      password,
      roleId: String(seed.roles[roleKey]._id),
      branchMode: branchIds ? 'specific' : 'all',
      branchIds: branchIds?.map(String) ?? [],
    });
    if (res.status !== 201) throw new Error(`Create user failed: ${JSON.stringify(res.body)}`);
    return login(email, password);
  };

  const branch = (code) => String(seed.branches[code]._id);

  return { app, api, login, createUser, branch, seed, close: disconnectDatabase };
}

// Finds a system account id by name from GET /accounts.
export async function accountsByName(client) {
  const res = await client.get('/accounts?limit=500');
  return Object.fromEntries(res.body.data.map((a) => [a.name, a.id]));
}

export async function itemsByName(client) {
  const res = await client.get('/items?limit=100');
  return Object.fromEntries(res.body.data.map((i) => [i.name, i.id]));
}
