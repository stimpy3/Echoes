// Fix for audit finding BE-005: the co-presence confirm route's read-then-write had a
// window where two concurrent requests (both participants confirming at nearly the
// same instant — a realistic scenario for this exact feature, not a contrived edge
// case) could both read 'pending', both compute their own next status independently,
// and neither would observe the other's write. This suite fires the two requests
// CONCURRENTLY, for real — not sequentially with `await` between them, which is what
// the original Phase 4 tests did and why this race was never actually exercised —
// and repeats it many times, since a race's absence on one run proves very little.

const fs = require('fs');
const path = require('path');
const os = require('os');
const request = require('supertest');
const mongoose = require('mongoose');
const { flushRateLimits } = require('./helpers/flushRateLimits');

const STATE_FILE = path.join(os.tmpdir(), 'echoes-test-state.json');
const { baseURL, mongoUri } = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));

let Memory, CoPresenceCandidate, CoPresenceMatch;

beforeAll(async () => {
  await mongoose.connect(mongoUri);
  Memory = require('../models/memories');
  CoPresenceCandidate = require('../models/coPresenceCandidate');
  CoPresenceMatch = require('../models/coPresenceMatch');
});

afterAll(async () => {
  await mongoose.disconnect();
});

beforeEach(flushRateLimits); // this file creates two users per iteration, many iterations.

let seq = 0;
function uniqueEmail(tag) {
  seq += 1;
  return `be005-${tag}-${Date.now()}-${seq}@example.test`;
}

async function createUser(name) {
  const email = uniqueEmail(name.replace(/\s+/g, ''));
  const signupRes = await request(baseURL)
    .post('/api/auth/signup')
    .send({ name, email, password: 'correct-horse-battery' });
  const cookie = signupRes.headers['set-cookie'].find((c) => c.startsWith('token=')).split(';')[0];
  const csrf = signupRes.body.csrfToken;
  const navbarRes = await request(baseURL).get('/api/user/navbar').set('Cookie', cookie);
  return { id: navbarRes.body._id, cookie, csrf };
}

async function seedCandidate(userAId, userBId) {
  const memA = await Memory.create({
    userId: userAId,
    title: 'BE-005 fixture',
    description: 'race-condition fixture',
    location: { type: 'Point', coordinates: [72.8777, 19.076], address: 'fixture' },
    photoUrl: 'https://example.test/fixture.jpg',
  });
  const memB = await Memory.create({
    userId: userBId,
    title: 'BE-005 fixture',
    description: 'race-condition fixture',
    location: { type: 'Point', coordinates: [72.8778, 19.076], address: 'fixture' },
    photoUrl: 'https://example.test/fixture.jpg',
  });
  return CoPresenceCandidate.create({
    userA: userAId,
    userB: userBId,
    memoryA: memA._id,
    memoryB: memB._id,
    distanceMeters: 10,
    timeDeltaMinutes: 2,
    visualSimilarity: 0.9,
  });
}

describe('BE-005 fix — concurrent confirm requests never lose the transition to matched', () => {
  test('firing both sides\' confirm at the same instant, repeatedly, always ends in exactly one match', async () => {
    const ITERATIONS = 15; // enough runs for a real race to show up if one still existed.

    for (let i = 0; i < ITERATIONS; i += 1) {
      // beforeEach only flushes once, before the whole test — this loop makes 2 real
      // signups per iteration (30 total across 15 iterations), comfortably more than
      // the real 5/hour signup limit allows in one shot. Flush every iteration so the
      // limiter's correct, real behavior doesn't fail a test about something else.
      await flushRateLimits();
      const userA = await createUser(`RaceA${i}`);
      const userB = await createUser(`RaceB${i}`);
      const candidate = await seedCandidate(userA.id, userB.id);

      // Promise.all, not sequential awaits — both requests are actually in flight at
      // the same time, which is the entire point: the old bug only manifests under
      // real concurrency, not "A then B" with a full round trip in between.
      const [resA, resB] = await Promise.all([
        request(baseURL)
          .post(`/api/copresence/${candidate._id}/confirm`)
          .set('Cookie', userA.cookie)
          .set('X-CSRF-Token', userA.csrf),
        request(baseURL)
          .post(`/api/copresence/${candidate._id}/confirm`)
          .set('Cookie', userB.cookie)
          .set('X-CSRF-Token', userB.csrf),
      ]);

      expect(resA.status).toBe(200);
      expect(resB.status).toBe(200);

      // Exactly one of the two must report 'matched' and the other
      // 'awaiting_other_confirmation' — which one got which is genuinely
      // non-deterministic (depends on which write actually committed first at the
      // storage layer), so the assertion is on the PAIR of outcomes, not on a
      // specific user getting a specific answer.
      const statuses = [resA.body.status, resB.body.status].sort();
      expect(statuses).toEqual(['awaiting_other_confirmation', 'matched']);

      // The property that actually matters: the pair reached 'matched' in the
      // database, exactly once — no lost update (stuck at confirmedByA/B forever)
      // and no duplicate CoPresenceMatch row from both requests racing the create.
      const finalCandidate = await CoPresenceCandidate.findById(candidate._id);
      expect(finalCandidate.status).toBe('matched');

      const matchCount = await CoPresenceMatch.countDocuments({
        memoryA: candidate.memoryA,
        memoryB: candidate.memoryB,
      });
      expect(matchCount).toBe(1);
    }
  }, 60000);

  test('one side confirming twice concurrently (double-tap) never creates two effects', async () => {
    const userA = await createUser('DoubleTapA');
    const userB = await createUser('DoubleTapB');
    const candidate = await seedCandidate(userA.id, userB.id);

    // Same user, same side, two requests in flight at once — simulates a real
    // double-tap or a retried request racing its own original.
    const [first, second] = await Promise.all([
      request(baseURL).post(`/api/copresence/${candidate._id}/confirm`).set('Cookie', userA.cookie).set('X-CSRF-Token', userA.csrf),
      request(baseURL).post(`/api/copresence/${candidate._id}/confirm`).set('Cookie', userA.cookie).set('X-CSRF-Token', userA.csrf),
    ]);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(first.body.status).toBe('awaiting_other_confirmation');
    expect(second.body.status).toBe('awaiting_other_confirmation');

    const finalCandidate = await CoPresenceCandidate.findById(candidate._id);
    expect(finalCandidate.status).toBe('confirmedByA');

    const matchCount = await CoPresenceMatch.countDocuments({
      memoryA: candidate.memoryA,
      memoryB: candidate.memoryB,
    });
    expect(matchCount).toBe(0); // only one side has ever confirmed — no match should exist yet.
  });
});
