// Fix for audit finding BE-013: logout only ever cleared the cookie client-side — the
// JWT itself stayed cryptographically valid for its full remaining 7-day lifetime, so a
// copy of the token (stolen from a device, leaked in a log) kept working after the
// legitimate user "logged out." Each token now carries a `jti` (routes/authRoutes.js's
// createToken); /logout denylists it in Redis for its remaining lifetime
// (utils/tokenDenylist.js), and both the HTTP verifyToken middleware and the Socket.IO
// handshake reject a denylisted jti.
//
// This suite proves the actual attack this closes: a token copy captured BEFORE logout
// must stop working immediately AFTER that logout call — not just the browser that
// called it.

const fs = require('fs');
const path = require('path');
const os = require('os');
const request = require('supertest');
const { io: ioClient } = require('socket.io-client');
const { flushRateLimits } = require('./helpers/flushRateLimits');

const STATE_FILE = path.join(os.tmpdir(), 'echoes-test-state.json');
const { baseURL } = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));

function extractTokenCookie(res) {
  const setCookie = res.headers['set-cookie'];
  const tokenLine = setCookie.find((c) => c.startsWith('token='));
  return tokenLine.split(';')[0];
}

let seq = 0;
function uniqueEmail(tag) {
  seq += 1;
  return `be013-${tag}-${Date.now()}-${seq}@example.test`;
}

async function createUser(name) {
  const email = uniqueEmail(name.replace(/\s+/g, ''));
  const signupRes = await request(baseURL)
    .post('/api/auth/signup')
    .send({ name, email, password: 'correct-horse-battery' });
  return { cookie: extractTokenCookie(signupRes), csrf: signupRes.body.csrfToken };
}

describe('BE-013 fix — logout actually revokes the token, not just the browser session', () => {
  beforeEach(flushRateLimits);

  test('a token that worked before logout is rejected immediately after logout, over HTTP', async () => {
    const user = await createUser('BE013 HttpUser');

    const beforeLogout = await request(baseURL).get('/api/user/navbar').set('Cookie', user.cookie);
    expect(beforeLogout.status).toBe(200);

    const logoutRes = await request(baseURL)
      .post('/api/auth/logout')
      .set('Cookie', user.cookie)
      .set('X-CSRF-Token', user.csrf);
    expect(logoutRes.status).toBe(200);

    // The SAME token/cookie, captured before logout — this is exactly the "stolen
    // token" scenario the finding describes, not the browser that actually logged out.
    const afterLogout = await request(baseURL).get('/api/user/navbar').set('Cookie', user.cookie);
    expect(afterLogout.status).toBe(403);
    expect(afterLogout.body.message).toMatch(/revoked/i);
  });

  test('a denylisted token also can no longer open a Socket.IO connection', async () => {
    const user = await createUser('BE013 SocketUser');

    await request(baseURL)
      .post('/api/auth/logout')
      .set('Cookie', user.cookie)
      .set('X-CSRF-Token', user.csrf);

    const socket = ioClient(baseURL, {
      transports: ['websocket'],
      extraHeaders: { Cookie: user.cookie },
    });

    const rejection = await new Promise((resolve) => {
      socket.on('connect_error', (err) => resolve(err));
      socket.on('connect', () => resolve(null));
    });
    expect(rejection).toBeTruthy();
    socket.disconnect();
  });

  test('logging out with no token at all still returns a clean 200 (no regression)', async () => {
    const res = await request(baseURL).post('/api/auth/logout');
    expect(res.status).toBe(200);
  });

  test('a normal, non-revoked token keeps working across unrelated requests (no regression)', async () => {
    const user = await createUser('BE013 UnaffectedUser');
    const res1 = await request(baseURL).get('/api/user/navbar').set('Cookie', user.cookie);
    const res2 = await request(baseURL).get('/api/user/navbar').set('Cookie', user.cookie);
    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);
  });
});
