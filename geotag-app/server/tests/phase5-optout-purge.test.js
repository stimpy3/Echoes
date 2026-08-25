// Phase 5 of the co-presence rollout plan: opting out purges pending candidates.
//
// The rule under test: withdrawing consent (coPresenceOptIn -> false) must immediately
// remove every NOT-YET-matched candidate this user is part of — a suggestion nobody
// has both agreed to shouldn't keep existing once one side has withdrawn. Already-
// confirmed CoPresenceMatch rows are a separate, already-mutually-consented decision
// and must be left untouched by this action.

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

beforeEach(flushRateLimits); // this file creates several users per test, same reasoning as Phase 4's suite.

let seq = 0;
function uniqueEmail(tag) {
  seq += 1;
  return `phase5-${tag}-${Date.now()}-${seq}@example.test`;
}

async function createUser(name) {
  const email = uniqueEmail(name.replace(/\s+/g, ''));
  const signupRes = await request(baseURL)
    .post('/api/auth/signup')
    .send({ name, email, password: 'correct-horse-battery' });
  const cookie = signupRes.headers['set-cookie'].find((c) => c.startsWith('token=')).split(';')[0];
  // CSRF fix (BE-002): every mutating request now needs this exact value as an
  // X-CSRF-Token header — see middleware/verifyToken.js.
  const csrf = signupRes.body.csrfToken;
  const navbarRes = await request(baseURL).get('/api/user/navbar').set('Cookie', cookie);
  return { id: navbarRes.body._id, cookie, csrf };
}

async function makeMemory(userId, lng) {
  return Memory.create({
    userId,
    title: 'Fixture memory',
    description: 'Phase 5 opt-out purge fixture',
    location: { type: 'Point', coordinates: [lng, 19.076], address: 'Fixture address' },
    photoUrl: 'https://example.test/fixture.jpg',
  });
}

async function seedCandidate(userAId, userBId) {
  const memA = await makeMemory(userAId, 72.8777);
  const memB = await makeMemory(userBId, 72.8778);
  return CoPresenceCandidate.create({
    userA: userAId,
    userB: userBId,
    memoryA: memA._id,
    memoryB: memB._id,
    distanceMeters: 12,
    timeDeltaMinutes: 4,
    visualSimilarity: 0.9,
  });
}

describe('Phase 5 — opting out purges pending candidates', () => {
  test('opting out deletes a pending candidate this user is part of', async () => {
    const userA = await createUser('P5 PurgeA');
    const userB = await createUser('P5 PurgeB');
    const candidate = await seedCandidate(userA.id, userB.id);

    const res = await request(baseURL)
      .patch('/api/user/co-presence-opt-in')
      .set('Cookie', userA.cookie)
      .set('X-CSRF-Token', userA.csrf)
      .send({ optIn: false });
    expect(res.status).toBe(200);

    const stillThere = await CoPresenceCandidate.findById(candidate._id);
    expect(stillThere).toBeNull();
  });

  test('opting out deletes a candidate that is one-sided-confirmed (not yet matched)', async () => {
    const userA = await createUser('P5 HalfA');
    const userB = await createUser('P5 HalfB');
    const candidate = await seedCandidate(userA.id, userB.id);

    await request(baseURL).post(`/api/copresence/${candidate._id}/confirm`).set('Cookie', userB.cookie).set('X-CSRF-Token', userB.csrf);

    await request(baseURL)
      .patch('/api/user/co-presence-opt-in')
      .set('Cookie', userA.cookie)
      .set('X-CSRF-Token', userA.csrf)
      .send({ optIn: false });

    const stillThere = await CoPresenceCandidate.findById(candidate._id);
    expect(stillThere).toBeNull();
  });

  test('opting out does NOT touch an already-matched pair\'s CoPresenceMatch row', async () => {
    const userA = await createUser('P5 MatchedA');
    const userB = await createUser('P5 MatchedB');
    const candidate = await seedCandidate(userA.id, userB.id);

    await request(baseURL).post(`/api/copresence/${candidate._id}/confirm`).set('Cookie', userA.cookie).set('X-CSRF-Token', userA.csrf);
    await request(baseURL).post(`/api/copresence/${candidate._id}/confirm`).set('Cookie', userB.cookie).set('X-CSRF-Token', userB.csrf);

    const matchBefore = await CoPresenceMatch.findOne({ memoryA: candidate.memoryA, memoryB: candidate.memoryB });
    expect(matchBefore).toBeTruthy();

    await request(baseURL)
      .patch('/api/user/co-presence-opt-in')
      .set('Cookie', userA.cookie)
      .set('X-CSRF-Token', userA.csrf)
      .send({ optIn: false });

    const matchAfter = await CoPresenceMatch.findOne({ memoryA: candidate.memoryA, memoryB: candidate.memoryB });
    expect(matchAfter).toBeTruthy();
    expect(matchAfter._id.toString()).toBe(matchBefore._id.toString());
  });

  test('opting out only affects the withdrawing user\'s own candidates, never an unrelated pair\'s', async () => {
    const userA = await createUser('P5 ScopeA');
    const userB = await createUser('P5 ScopeB');
    const userC = await createUser('P5 ScopeC');
    const userD = await createUser('P5 ScopeD');

    const ownCandidate = await seedCandidate(userA.id, userB.id);
    const unrelatedCandidate = await seedCandidate(userC.id, userD.id);

    await request(baseURL)
      .patch('/api/user/co-presence-opt-in')
      .set('Cookie', userA.cookie)
      .set('X-CSRF-Token', userA.csrf)
      .send({ optIn: false });

    expect(await CoPresenceCandidate.findById(ownCandidate._id)).toBeNull();
    expect(await CoPresenceCandidate.findById(unrelatedCandidate._id)).toBeTruthy();
  });

  test('opting IN does not error and does not resurrect a previously purged candidate', async () => {
    const userA = await createUser('P5 ReoptA');
    const userB = await createUser('P5 ReoptB');
    const candidate = await seedCandidate(userA.id, userB.id);

    await request(baseURL).patch('/api/user/co-presence-opt-in').set('Cookie', userA.cookie).set('X-CSRF-Token', userA.csrf).send({ optIn: false });
    expect(await CoPresenceCandidate.findById(candidate._id)).toBeNull();

    const reopt = await request(baseURL)
      .patch('/api/user/co-presence-opt-in')
      .set('Cookie', userA.cookie)
      .set('X-CSRF-Token', userA.csrf)
      .send({ optIn: true });
    expect(reopt.status).toBe(200);
    expect(reopt.body.coPresenceOptIn).toBe(true);
    expect(await CoPresenceCandidate.findById(candidate._id)).toBeNull();
  });
});
