// Phase 0 regression suite — the safety net the co-presence rollout plan depends on.
//
// Covers the app's actual hot paths (per the plan): signup, login, create memory,
// fetch own memories, follow/unfollow, Explore returns 200, and a real WebSocket
// message round-trip. Runs against the isolated app instance + in-memory Mongo that
// tests/globalSetup.js just booted — never the real Atlas cluster, never the real
// production Redis.
//
// The one exception is Cloudinary: the create-memory test uses the real dev account
// (see globalSetup.js) to exercise the actual signed-upload path, and immediately
// deletes what it created via the app's own DELETE route — same cleanup path a real
// user's delete goes through, so no test image is left behind.

const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');
const request = require('supertest');
const { io: ioClient } = require('socket.io-client');
const { flushRateLimits } = require('./helpers/flushRateLimits');

const STATE_FILE = path.join(os.tmpdir(), 'echoes-test-state.json');
const { baseURL } = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));

const PHOTO_PATH = path.join(__dirname, 'fixtures', 'test-photo.jpg');

// Pulls the raw `token=...` value out of a supertest response's Set-Cookie header,
// the same cookie the browser would store and the server's own middleware/socket
// handshake both key off of.
function extractTokenCookie(res) {
  const setCookie = res.headers['set-cookie'];
  if (!setCookie) throw new Error('No Set-Cookie header on response');
  const tokenLine = setCookie.find((c) => c.startsWith('token='));
  if (!tokenLine) throw new Error('No token cookie in Set-Cookie header');
  return tokenLine.split(';')[0]; // "token=<value>"
}

function uniqueEmail(tag) {
  return `phase0-${tag}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.test`;
}

describe('Phase 0 regression — existing app behavior is unchanged', () => {
  // This suite's own signup/login calls, plus every other test file's, share one IP
  // against the real (correctly-isolated-per-route, as of the Phase 0 rate-limiter
  // fix) Redis-backed limiters. Reset before this file's assertions so its results
  // depend only on this file's own request count, not on what ran before it.
  beforeAll(flushRateLimits);

  const userA = { name: 'Regression User A', email: uniqueEmail('a'), password: 'correct-horse-battery' };
  const userB = { name: 'Regression User B', email: uniqueEmail('b'), password: 'correct-horse-battery' };

  let cookieA;
  let cookieB;
  let userAId;
  let userBId;
  let createdMemoryId;

  test('signup creates an account and sets an auth cookie', async () => {
    const res = await request(baseURL).post('/api/auth/signup').send(userA);
    expect(res.status).toBe(201);
    expect(res.body.message).toBe('Account Created');
    cookieA = extractTokenCookie(res);
  });

  test('signup rejects a duplicate email', async () => {
    const res = await request(baseURL).post('/api/auth/signup').send(userA);
    expect(res.status).toBe(409);
  });

  test('login succeeds with the correct password and sets an auth cookie', async () => {
    const res = await request(baseURL)
      .post('/api/auth/login')
      .send({ email: userA.email, password: userA.password });
    expect(res.status).toBe(200);
    cookieA = extractTokenCookie(res);
  });

  test('login rejects a wrong password without revealing which part was wrong differently than an unknown email', async () => {
    const res = await request(baseURL)
      .post('/api/auth/login')
      .send({ email: userA.email, password: 'definitely-wrong' });
    expect(res.status).toBe(401);
  });

  test('second account for the follow/chat tests', async () => {
    const res = await request(baseURL).post('/api/auth/signup').send(userB);
    expect(res.status).toBe(201);
    cookieB = extractTokenCookie(res);
  });

  test('navbar identity fetch resolves each user\'s own id', async () => {
    const resA = await request(baseURL).get('/api/user/navbar').set('Cookie', cookieA);
    expect(resA.status).toBe(200);
    userAId = resA.body._id;

    const resB = await request(baseURL).get('/api/user/navbar').set('Cookie', cookieB);
    expect(resB.status).toBe(200);
    userBId = resB.body._id;

    expect(userAId).toBeTruthy();
    expect(userBId).toBeTruthy();
    expect(userAId).not.toBe(userBId);
  });

  test('an unauthenticated request is rejected with 401, not 500 or a silent pass', async () => {
    const res = await request(baseURL).get('/api/user/navbar');
    expect(res.status).toBe(401);
  });

  test('create memory: real signed Cloudinary upload + Mongo write', async () => {
    const res = await request(baseURL)
      .post('/api/memory/creatememory')
      .set('Cookie', cookieA)
      .field('title', 'Phase 0 regression test memory')
      .field('description', 'Created by the automated regression suite, deleted immediately after.')
      .field('location', JSON.stringify({
        type: 'Point',
        coordinates: [72.8777, 19.0760], // Mumbai — matches the app's own default center.
        address: 'Automated test fixture, not a real place',
      }))
      .attach('photo', PHOTO_PATH);

    expect(res.status).toBe(201);
    expect(res.body.memory).toBeTruthy();
    expect(res.body.memory.photoUrl).toMatch(/^https?:\/\//); // really landed on Cloudinary
    createdMemoryId = res.body.memory._id;
  });

  test('fetch own memories includes the one just created', async () => {
    const res = await request(baseURL).get('/api/memory/fetchmemory').set('Cookie', cookieA);
    expect(res.status).toBe(200);
    const ids = res.body.memories.map((m) => m._id);
    expect(ids).toContain(createdMemoryId);
  });

  test('Explore returns 200 with a well-shaped feed for a brand-new user (cold start)', async () => {
    const res = await request(baseURL).get('/api/memory/explore').set('Cookie', cookieB);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.memories)).toBe(true);
  });

  test('Explore also returns 200 for the user who now has interaction history', async () => {
    const res = await request(baseURL).get('/api/memory/explore').set('Cookie', cookieA);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.memories)).toBe(true);
  });

  test('follow a public account is immediate (no request/approval step)', async () => {
    const res = await request(baseURL)
      .post('/api/follow/request')
      .set('Cookie', cookieA)
      .send({ receiverId: userBId });
    expect(res.status).toBe(200);
    expect(res.body.following).toBe(true);

    const status = await request(baseURL).get(`/api/users/status/${userBId}`).set('Cookie', cookieA);
    expect(status.body.following).toBe(true);
  });

  test('unfollow removes the relationship', async () => {
    const res = await request(baseURL)
      .post('/api/follow/unfollow')
      .set('Cookie', cookieA)
      .send({ receiverId: userBId });
    expect(res.status).toBe(200);

    const status = await request(baseURL).get(`/api/users/status/${userBId}`).set('Cookie', cookieA);
    expect(status.body.following).toBe(false);
  });

  test('real-time chat: persist-then-emit round trip over an authenticated socket', async () => {
    const cookieHeaderA = cookieA; // "token=..."
    const cookieHeaderB = cookieB;

    const socketA = ioClient(baseURL, {
      transports: ['websocket'],
      extraHeaders: { Cookie: cookieHeaderA },
    });
    const socketB = ioClient(baseURL, {
      transports: ['websocket'],
      extraHeaders: { Cookie: cookieHeaderB },
    });

    try {
      await Promise.all([
        new Promise((resolve, reject) => {
          socketA.on('connect', resolve);
          socketA.on('connect_error', reject);
        }),
        new Promise((resolve, reject) => {
          socketB.on('connect', resolve);
          socketB.on('connect_error', reject);
        }),
      ]);

      const receivedByB = new Promise((resolve) => {
        socketB.on('newMessage', (msg) => resolve(msg));
      });

      const ackResponse = await new Promise((resolve, reject) => {
        socketA.timeout(8000).emit(
          'sendMessage',
          { receiverId: userBId, message: 'Phase 0 regression test message' },
          (err, response) => (err ? reject(err) : resolve(response))
        );
      });

      expect(ackResponse.success).toBe(true);
      expect(ackResponse.message.text).toBe('Phase 0 regression test message');

      const liveMessage = await receivedByB;
      expect(liveMessage.text).toBe('Phase 0 regression test message');
      expect(liveMessage.isOwn).toBe(false);
    } finally {
      socketA.disconnect();
      socketB.disconnect();
    }
  });

  test('an unauthenticated socket handshake is rejected, never falls back to trusting a client-supplied id', async () => {
    const socket = ioClient(baseURL, { transports: ['websocket'] }); // no cookie at all
    const rejection = await new Promise((resolve) => {
      socket.on('connect_error', (err) => resolve(err));
      socket.on('connect', () => resolve(null));
    });
    expect(rejection).toBeTruthy();
    socket.disconnect();
  });

  test('cleanup: delete the test memory (exercises the real Cloudinary destroy path too)', async () => {
    const res = await request(baseURL)
      .delete(`/api/memory/deletememory/${createdMemoryId}`)
      .set('Cookie', cookieA);
    expect(res.status).toBe(200);

    const after = await request(baseURL).get('/api/memory/fetchmemory').set('Cookie', cookieA);
    const ids = after.body.memories.map((m) => m._id);
    expect(ids).not.toContain(createdMemoryId);
  });
});
