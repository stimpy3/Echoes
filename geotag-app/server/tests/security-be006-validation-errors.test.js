// Fix for audit finding BE-006: POST /api/memory/creatememory returned a generic 500
// for a Mongoose ValidationError (e.g. a blank/missing location.address, which the
// Memory schema requires) instead of a 400 — indistinguishable, from the client's
// perspective, from a real server failure. Compounded client-side: AddMemoryForm.jsx
// called onAdd()/onClose() optimistically BEFORE the request even resolved, so a
// rejected memory still looked like it saved, and the only trace of the failure was a
// console.error no user would ever see.
//
// This suite proves the server half directly: a request that fails Mongoose validation
// must come back 400 with a real message, not 500. It uses a real Cloudinary upload
// (like regression.test.js's create-memory test) because the bug only reproduces via
// the actual creatememory route, not a seeded document — an invalid memory is never
// successfully created here, so there is nothing to clean up afterward.

const fs = require('fs');
const path = require('path');
const os = require('os');
const request = require('supertest');
const { flushRateLimits } = require('./helpers/flushRateLimits');

const STATE_FILE = path.join(os.tmpdir(), 'echoes-test-state.json');
const { baseURL } = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));

const PHOTO_PATH = path.join(__dirname, 'fixtures', 'test-photo.jpg');

function extractTokenCookie(res) {
  const setCookie = res.headers['set-cookie'];
  const tokenLine = setCookie.find((c) => c.startsWith('token='));
  return tokenLine.split(';')[0];
}

let seq = 0;
function uniqueEmail(tag) {
  seq += 1;
  return `be006-${tag}-${Date.now()}-${seq}@example.test`;
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

describe('BE-006 fix — invalid memory input is a 400, not a 500', () => {
  beforeEach(flushRateLimits);

  test('a blank address fails schema validation and comes back 400 with a real message', async () => {
    const user = await createUser('BE006 BlankAddress');

    const res = await request(baseURL)
      .post('/api/memory/creatememory')
      .set('Cookie', user.cookie)
      .set('X-CSRF-Token', user.csrf)
      .field('title', 'BE-006 invalid memory')
      .field('description', 'Should be rejected with 400, not 500')
      .field('location', JSON.stringify({
        type: 'Point',
        coordinates: [72.8777, 19.0760],
        address: '', // required by the Memory schema — this is the validation trigger.
      }))
      .attach('photo', PHOTO_PATH);

    expect(res.status).toBe(400);
    expect(typeof res.body.message).toBe('string');
    expect(res.body.message.length).toBeGreaterThan(0);
  });

  test('a valid request is unaffected by the fix (no regression)', async () => {
    const user = await createUser('BE006 ValidControl');

    const res = await request(baseURL)
      .post('/api/memory/creatememory')
      .set('Cookie', user.cookie)
      .set('X-CSRF-Token', user.csrf)
      .field('title', 'BE-006 valid control memory')
      .field('description', 'Should still succeed normally')
      .field('location', JSON.stringify({
        type: 'Point',
        coordinates: [72.8777, 19.0760],
        address: 'Automated test fixture, not a real place',
      }))
      .attach('photo', PHOTO_PATH);

    expect(res.status).toBe(201);
    expect(res.body.memory).toBeTruthy();

    // Cleanup — same delete path a real user's delete goes through.
    await request(baseURL)
      .delete(`/api/memory/deletememory/${res.body.memory._id}`)
      .set('Cookie', user.cookie)
      .set('X-CSRF-Token', user.csrf);
  });
});
