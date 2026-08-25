// Phase 1 of the co-presence rollout plan: consent flag + schema, no behavior yet.
// Uses the same forked app + in-memory Mongo instance tests/globalSetup.js already
// booted for Phase 0 (shared across all *.test.js files in one Jest run).

const fs = require('fs');
const path = require('path');
const os = require('os');
const request = require('supertest');
const mongoose = require('mongoose');
const { flushRateLimits } = require('./helpers/flushRateLimits');

const STATE_FILE = path.join(os.tmpdir(), 'echoes-test-state.json');
const { baseURL, mongoUri } = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));

function extractTokenCookie(res) {
  const setCookie = res.headers['set-cookie'];
  const tokenLine = setCookie.find((c) => c.startsWith('token='));
  return tokenLine.split(';')[0];
}

function uniqueEmail(tag) {
  return `phase1-${tag}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.test`;
}

describe('Phase 1 — co-presence consent flag', () => {
  // A direct connection to the SAME in-memory test database the forked app is using,
  // for the one thing the app's own HTTP surface can't do: insert a raw, pre-Phase-1-
  // shaped document that never went through Mongoose (so it genuinely has no
  // coPresenceOptIn field in storage) and confirm the schema default still applies
  // when it's read back through the model — proving no migration script is needed,
  // the same guarantee the existing isPrivate field already relies on.
  let directConn;

  beforeAll(async () => {
    // See regression.test.js for why — same shared-IP-across-files reasoning.
    await flushRateLimits();
    directConn = await mongoose.createConnection(mongoUri).asPromise();
  });

  afterAll(async () => {
    await directConn.close();
  });

  test('a newly created user has coPresenceOptIn: false, explicitly, in storage', async () => {
    const email = uniqueEmail('new');
    const signup = await request(baseURL)
      .post('/api/auth/signup')
      .send({ name: 'Phase 1 New User', email, password: 'correct-horse-battery' });
    expect(signup.status).toBe(201);

    const rawUsers = directConn.collection('users');
    const doc = await rawUsers.findOne({ email });
    expect(doc.coPresenceOptIn).toBe(false);
  });

  test('a legacy-shaped document (no coPresenceOptIn field at all) still defaults to false when read through the model', async () => {
    const rawUsers = directConn.collection('users');
    const legacyEmail = uniqueEmail('legacy');

    // Bypasses Mongoose entirely — this document has NO coPresenceOptIn key, simulating
    // a real user document created before Phase 1 shipped.
    const insertResult = await rawUsers.insertOne({
      name: 'Legacy User',
      email: legacyEmail,
      password: 'irrelevant-not-a-real-hash',
      isPrivate: false,
    });
    expect('coPresenceOptIn' in (await rawUsers.findOne({ _id: insertResult.insertedId }))).toBe(false);

    // Read the SAME document back through the app's actual User schema — reusing the
    // real schema (so the real default is what's under test) on `directConn` rather
    // than the default `mongoose` singleton, which has no active connection in THIS
    // process (the actual DB connection lives in the forked app process; this test
    // process talks to the same in-memory mongod over its own, separate connection).
    const UserSchema = require('../models/users').schema;
    const UserModel = directConn.model('User', UserSchema);
    const hydrated = await UserModel.findById(insertResult.insertedId);
    expect(hydrated.coPresenceOptIn).toBe(false);
  });

  test('toggling opt-in on round-trips through the API and is reflected on /navbar', async () => {
    const email = uniqueEmail('toggle');
    const signup = await request(baseURL)
      .post('/api/auth/signup')
      .send({ name: 'Phase 1 Toggle User', email, password: 'correct-horse-battery' });
    const cookie = extractTokenCookie(signup);

    const before = await request(baseURL).get('/api/user/navbar').set('Cookie', cookie);
    expect(before.body.coPresenceOptIn).toBe(false);

    const patchOn = await request(baseURL)
      .patch('/api/user/co-presence-opt-in')
      .set('Cookie', cookie)
      .send({ optIn: true });
    expect(patchOn.status).toBe(200);
    expect(patchOn.body.coPresenceOptIn).toBe(true);

    const afterOn = await request(baseURL).get('/api/user/navbar').set('Cookie', cookie);
    expect(afterOn.body.coPresenceOptIn).toBe(true);

    const patchOff = await request(baseURL)
      .patch('/api/user/co-presence-opt-in')
      .set('Cookie', cookie)
      .send({ optIn: false });
    expect(patchOff.body.coPresenceOptIn).toBe(false);
  });

  test('rejects a non-boolean optIn value instead of silently coercing it', async () => {
    const email = uniqueEmail('badinput');
    const signup = await request(baseURL)
      .post('/api/auth/signup')
      .send({ name: 'Phase 1 Bad Input User', email, password: 'correct-horse-battery' });
    const cookie = extractTokenCookie(signup);

    const res = await request(baseURL)
      .patch('/api/user/co-presence-opt-in')
      .set('Cookie', cookie)
      .send({ optIn: 'yes-please' });
    expect(res.status).toBe(400);
  });

  test('toggling one user\'s flag never touches another user\'s document', async () => {
    const emailA = uniqueEmail('isoA');
    const emailB = uniqueEmail('isoB');

    const signupA = await request(baseURL)
      .post('/api/auth/signup')
      .send({ name: 'Isolation User A', email: emailA, password: 'correct-horse-battery' });
    const signupB = await request(baseURL)
      .post('/api/auth/signup')
      .send({ name: 'Isolation User B', email: emailB, password: 'correct-horse-battery' });

    const cookieA = extractTokenCookie(signupA);
    const cookieB = extractTokenCookie(signupB);

    await request(baseURL)
      .patch('/api/user/co-presence-opt-in')
      .set('Cookie', cookieA)
      .send({ optIn: true });

    const bStatus = await request(baseURL).get('/api/user/navbar').set('Cookie', cookieB);
    expect(bStatus.body.coPresenceOptIn).toBe(false);
  });

  test('the toggle route requires authentication — no cookie, no change, 401', async () => {
    const res = await request(baseURL)
      .patch('/api/user/co-presence-opt-in')
      .send({ optIn: true });
    expect(res.status).toBe(401);
  });
});
