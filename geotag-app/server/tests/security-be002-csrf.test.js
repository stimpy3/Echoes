// Fix for audit finding BE-002: mutating requests need a matching X-CSRF-Token header,
// carried inside the JWT as a `csrf` claim and handed to the real client once, in the
// signup/login/google JSON response body — never in a cookie (a cookie set by the API's
// origin can't be read by frontend JS on a different origin anyway, which is why the
// classic double-submit-cookie pattern wasn't viable here — see verifyToken.js).
//
// This directly proves the actual attack this closes: a request carrying the real auth
// cookie (what a forged cross-site form submission WOULD have, since the browser
// attaches it automatically) but with no way to also supply the matching header (what a
// plain HTML form CANNOT do — it can't set custom headers) must be rejected.

const fs = require('fs');
const path = require('path');
const os = require('os');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { flushRateLimits } = require('./helpers/flushRateLimits');

const STATE_FILE = path.join(os.tmpdir(), 'echoes-test-state.json');
const { baseURL } = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));

// Matches tests/globalSetup.js's fixed test secret for the forked app — needed only for
// the one test below that has to construct a pre-fix-shaped token (no csrf claim) by
// hand, to prove old tokens fail closed rather than silently bypassing the new check.
const TEST_JWT_SECRET = 'phase-0-test-secret-do-not-use-in-real-life';

function extractTokenCookie(res) {
  const setCookie = res.headers['set-cookie'];
  const tokenLine = setCookie.find((c) => c.startsWith('token='));
  return tokenLine.split(';')[0];
}

let seq = 0;
function uniqueEmail(tag) {
  seq += 1;
  return `be002-${tag}-${Date.now()}-${seq}@example.test`;
}

async function createUser(name) {
  const email = uniqueEmail(name.replace(/\s+/g, ''));
  const signupRes = await request(baseURL)
    .post('/api/auth/signup')
    .send({ name, email, password: 'correct-horse-battery' });
  return {
    cookie: extractTokenCookie(signupRes),
    csrf: signupRes.body.csrfToken,
  };
}

describe('BE-002 fix — mutating requests require a matching CSRF header', () => {
  beforeEach(flushRateLimits);

  test('signup/login responses actually carry a csrfToken in the JSON body', async () => {
    const email = uniqueEmail('bodycheck');
    const signup = await request(baseURL)
      .post('/api/auth/signup')
      .send({ name: 'Body Check', email, password: 'correct-horse-battery' });
    expect(typeof signup.body.csrfToken).toBe('string');
    expect(signup.body.csrfToken.length).toBeGreaterThan(10);

    const login = await request(baseURL)
      .post('/api/auth/login')
      .send({ email, password: 'correct-horse-battery' });
    expect(typeof login.body.csrfToken).toBe('string');
  });

  test('a mutating request with the auth cookie but NO CSRF header is rejected — the actual forged-form scenario', async () => {
    const user = await createUser('BE002 NoHeader');
    // Deliberately omit X-CSRF-Token — this is exactly what a cross-site <form> POST
    // would look like: the browser attaches the cookie automatically, but a plain form
    // cannot set a custom header at all.
    const res = await request(baseURL)
      .patch('/api/user/co-presence-opt-in')
      .set('Cookie', user.cookie)
      .send({ optIn: true });
    expect(res.status).toBe(403);
  });

  test('a mutating request with a WRONG CSRF header (not just missing) is also rejected', async () => {
    const user = await createUser('BE002 WrongHeader');
    const res = await request(baseURL)
      .patch('/api/user/co-presence-opt-in')
      .set('Cookie', user.cookie)
      .set('X-CSRF-Token', 'not-the-real-token')
      .send({ optIn: true });
    expect(res.status).toBe(403);
  });

  test('a mutating request with the correct matching header succeeds normally (no regression)', async () => {
    const user = await createUser('BE002 Correct');
    const res = await request(baseURL)
      .patch('/api/user/co-presence-opt-in')
      .set('Cookie', user.cookie)
      .set('X-CSRF-Token', user.csrf)
      .send({ optIn: true });
    expect(res.status).toBe(200);
    expect(res.body.coPresenceOptIn).toBe(true);
  });

  test('GET requests need no CSRF header at all — safe methods are exempt', async () => {
    const user = await createUser('BE002 SafeMethod');
    const res = await request(baseURL).get('/api/user/navbar').set('Cookie', user.cookie);
    expect(res.status).toBe(200);
  });

  test('a token issued before this fix (no csrf claim) fails closed, not open', async () => {
    const user = await createUser('BE002 PreFixToken');
    // Simulates a real pre-existing session: a JWT with the same shape auth tokens had
    // before this fix — no `csrf` claim at all — signed with the same secret the forked
    // test app verifies against.
    const preFixToken = jwt.sign({ id: 'irrelevant-for-this-check' }, TEST_JWT_SECRET, { expiresIn: '7d' });

    const res = await request(baseURL)
      .patch('/api/user/co-presence-opt-in')
      .set('Cookie', `token=${preFixToken}`)
      // Even supplying SOME header value must not help — there is nothing correct to
      // match against, since decoded.csrf is undefined for this token.
      .set('X-CSRF-Token', 'anything-at-all')
      .send({ optIn: true });
    expect(res.status).toBe(403);
  });
});
