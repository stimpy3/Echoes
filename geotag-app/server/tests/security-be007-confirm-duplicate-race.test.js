// Fix for audit finding BE-007: POST /api/follow/confirm read the FollowRequest, then
// created a Follower row, then deleted the request — a read-then-write with no
// protection against two concurrent calls for the SAME request (a retried request, a
// double-tap) both reading the request before either deletes it, then both trying to
// create the identical Follower row. The unique index on {follower, following}
// (models/follower.js) correctly let only one of those two writes succeed, but the
// loser's duplicate-key error (11000) fell straight into the route's generic catch and
// came back as a 500 — even though the caller's actual intent (being followed) had
// already been satisfied by the winning request.
//
// This fires both confirms CONCURRENTLY (Promise.all, not sequential awaits) to
// actually exercise the race, not just assert the happy path.

const fs = require('fs');
const path = require('path');
const os = require('os');
const request = require('supertest');
const mongoose = require('mongoose');
const { flushRateLimits } = require('./helpers/flushRateLimits');

const STATE_FILE = path.join(os.tmpdir(), 'echoes-test-state.json');
const { baseURL, mongoUri } = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));

let Follower;

beforeAll(async () => {
  await mongoose.connect(mongoUri);
  Follower = require('../models/follower');
});

afterAll(async () => {
  await mongoose.disconnect();
});

function extractTokenCookie(res) {
  const setCookie = res.headers['set-cookie'];
  const tokenLine = setCookie.find((c) => c.startsWith('token='));
  return tokenLine.split(';')[0];
}

let seq = 0;
function uniqueEmail(tag) {
  seq += 1;
  return `be007-${tag}-${Date.now()}-${seq}@example.test`;
}

async function createUser(name) {
  const email = uniqueEmail(name.replace(/\s+/g, ''));
  const signupRes = await request(baseURL)
    .post('/api/auth/signup')
    .send({ name, email, password: 'correct-horse-battery' });
  const cookie = extractTokenCookie(signupRes);
  const csrf = signupRes.body.csrfToken;
  const navbarRes = await request(baseURL).get('/api/user/navbar').set('Cookie', cookie);
  return { id: navbarRes.body._id, cookie, csrf };
}

describe('BE-007 fix — concurrent /follow/confirm never returns 500 for a legitimate duplicate', () => {
  beforeEach(flushRateLimits); // this file signs up two users and sends real requests per test.

  test('firing the same confirm twice at once always ends in exactly one Follower row and no 500s', async () => {
    const sender = await createUser('BE007 Sender');
    const receiver = await createUser('BE007 Receiver');

    // A public receiver auto-follows immediately with no FollowRequest ever created —
    // this fix targets the pending-request path, which only a private account has.
    const privacyRes = await request(baseURL)
      .patch('/api/user/privacy')
      .set('Cookie', receiver.cookie)
      .set('X-CSRF-Token', receiver.csrf)
      .send({ isPrivate: true });
    expect(privacyRes.status).toBe(200);

    const sendRes = await request(baseURL)
      .post('/api/follow/request')
      .set('Cookie', sender.cookie)
      .set('X-CSRF-Token', sender.csrf)
      .send({ receiverId: receiver.id });
    expect(sendRes.status).toBe(200);
    expect(sendRes.body.requested).toBe(true);

    const [resA, resB] = await Promise.all([
      request(baseURL)
        .post('/api/follow/confirm')
        .set('Cookie', receiver.cookie)
        .set('X-CSRF-Token', receiver.csrf)
        .send({ senderId: sender.id }),
      request(baseURL)
        .post('/api/follow/confirm')
        .set('Cookie', receiver.cookie)
        .set('X-CSRF-Token', receiver.csrf)
        .send({ senderId: sender.id }),
    ]);

    // Neither request should ever come back as a 500 — a duplicate confirm is either a
    // clean 200 (this fix) or a clean 404 (the request was already deleted by the other
    // side first), never an unhandled server error.
    expect([200, 404]).toContain(resA.status);
    expect([200, 404]).toContain(resB.status);
    expect([resA.status, resB.status]).toContain(200); // at least one genuinely succeeded.

    const followCount = await Follower.countDocuments({ follower: sender.id, following: receiver.id });
    expect(followCount).toBe(1); // exactly one relationship, never zero, never duplicated.
  });
});
