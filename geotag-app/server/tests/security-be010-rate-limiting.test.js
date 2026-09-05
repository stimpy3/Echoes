// Fix for audit finding BE-010: mutation-heavy routes (memory create/edit/delete, like,
// comment, follow request/confirm/unfollow, chat mark-read, home location, privacy
// toggle) had verifyToken proving WHO was calling, but nothing capping HOW OFTEN — an
// authenticated caller (or a compromised session, or a scripted client) could hit any of
// them without limit. middleware/rateLimiter.js now adds memoryMutationLimiter (30/15min)
// and socialActionLimiter (100/15min), wired into every route above.
//
// This suite proves the limiters actually engage, cheaply: it fires requests at a
// nonexistent resource id, so every request short-circuits to a 404 inside the real
// route handler with no Cloudinary call or other real side effect — the point here is
// the limiter rejecting the (N+1)th request with 429, not the route's own behavior
// (already covered elsewhere).

const fs = require('fs');
const path = require('path');
const os = require('os');
const request = require('supertest');
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
  return `be010-${tag}-${Date.now()}-${seq}@example.test`;
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

describe('BE-010 fix — mutation-heavy routes are rate limited', () => {
  beforeEach(flushRateLimits);

  test('memoryMutationLimiter rejects the 31st memory-mutation request within the window', async () => {
    const user = await createUser('BE010 MemLimiter');
    const fakeId = '000000000000000000000000'; // valid ObjectId shape, matches nothing.

    let lastStatus;
    for (let i = 0; i < 31; i += 1) {
      const res = await request(baseURL)
        .delete(`/api/memory/deletememory/${fakeId}`)
        .set('Cookie', user.cookie)
        .set('X-CSRF-Token', user.csrf);
      lastStatus = res.status;
      if (i < 30) {
        expect(res.status).toBe(404); // limiter lets it through; route itself 404s.
      }
    }
    expect(lastStatus).toBe(429); // the 31st request is the one the limiter itself blocks.
  }, 30000);

  test('socialActionLimiter rejects the 101st social-action request within the window', async () => {
    const user = await createUser('BE010 SocialLimiter');
    const fakeUserId = '000000000000000000000000';

    let lastStatus;
    for (let i = 0; i < 101; i += 1) {
      const res = await request(baseURL)
        .post('/api/follow/unfollow')
        .set('Cookie', user.cookie)
        .set('X-CSRF-Token', user.csrf)
        .send({ receiverId: fakeUserId });
      lastStatus = res.status;
      if (i < 100) {
        expect(res.status).toBe(404); // no such follow relationship — limiter lets it through.
      }
    }
    expect(lastStatus).toBe(429);
  }, 30000);

  test('a request under the limit is unaffected (no regression)', async () => {
    const user = await createUser('BE010 UnderLimit');
    const res = await request(baseURL)
      .patch('/api/user/privacy')
      .set('Cookie', user.cookie)
      .set('X-CSRF-Token', user.csrf)
      .send({ isPrivate: true });
    expect(res.status).toBe(200);
  });
});
