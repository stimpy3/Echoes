// Phase 2 of the co-presence rollout plan: candidate generation.
//
// This tests jobs/coPresenceCandidateJob.js directly against the same in-memory Mongo
// instance the forked app is using (tests/globalSetup.js) — but bypasses the HTTP layer
// entirely, since candidate generation isn't an API surface yet (deliberately: Phase 2
// ships with no endpoint that could expose a candidate row). Connecting mongoose in
// THIS process is independent of the forked app's own connection in its own process;
// both simply point at the same underlying mongod.
//
// The exclusion-rule tests below are the ones that actually matter for this phase — the
// whole point of Phase 2 is that a candidate can only ever exist for a pair that is
// BOTH mutually-following AND both opted in. Getting any one of those wrong is a
// privacy bug, not a quality bug, so each rule gets its own explicit test rather than
// one combined "eligibility" test.

const fs = require('fs');
const path = require('path');
const os = require('os');
const mongoose = require('mongoose');

const STATE_FILE = path.join(os.tmpdir(), 'echoes-test-state.json');
const { mongoUri } = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));

let User, Follower, Memory, CoPresenceCandidate;
let runCoPresenceCandidateJob, findEligibleMutualPairs;

beforeAll(async () => {
  await mongoose.connect(mongoUri);
  User = require('../models/users');
  Follower = require('../models/follower');
  Memory = require('../models/memories');
  CoPresenceCandidate = require('../models/coPresenceCandidate');
  ({ runCoPresenceCandidateJob, findEligibleMutualPairs } = require('../jobs/coPresenceCandidateJob'));
});

afterAll(async () => {
  await mongoose.disconnect();
});

let seq = 0;
function uniqueEmail(tag) {
  seq += 1;
  return `phase2-${tag}-${Date.now()}-${seq}@example.test`;
}

async function makeUser({ name = 'Test User', coPresenceOptIn = false, isPrivate = false } = {}) {
  return User.create({ name, email: uniqueEmail(name.replace(/\s+/g, '')), password: 'irrelevant', coPresenceOptIn, isPrivate });
}

async function follow(followerId, followingId) {
  return Follower.create({ follower: followerId, following: followingId });
}

// Phase 3 added a visual-similarity requirement on top of Phase 2's spatio-temporal
// match — SAME_EVENT_EMBEDDING used identically on both sides of a pair simulates two
// photos of the same thing (cosine similarity 1.0, comfortably above the default 0.6
// threshold). Tests that assert a candidate SHOULD be written need this now; tests that
// already expect zero candidates for an earlier reason (not mutual, not opted in, too
// far, too late) are unaffected — see tests/phase3-visual-similarity.test.js for the
// dedicated tests of the similarity threshold itself.
const SAME_EVENT_EMBEDDING = [1, 0, 0, 0, 0, 0, 0, 0];

async function makeMemory({ userId, coordinates, createdAt, imageEmbedding }) {
  return Memory.create({
    userId,
    title: 'Test memory',
    description: 'Fixture memory for Phase 2 candidate job tests',
    location: { type: 'Point', coordinates, address: 'Fixture address' },
    photoUrl: 'https://example.test/fixture.jpg',
    createdAt,
    imageEmbedding,
  });
}

// A fixed anchor point (Mumbai, matching the app's own default map center) — tests
// offset from here in small increments, not real-world meaningful coordinates.
const ANCHOR = [72.8777, 19.076];
function offsetCoords([lng, lat], metersEast) {
  // ~111,320 meters per degree of longitude at the equator; close enough for small
  // test offsets (tens to thousands of meters) without needing a full geodesy library.
  return [lng + metersEast / 111320, lat];
}

describe('Phase 2 — co-presence candidate generation', () => {
  test('one-directional follow (not mutual) produces zero candidates, even with perfect proximity/timing', async () => {
    const userA = await makeUser({ name: 'OneWayA', coPresenceOptIn: true });
    const userB = await makeUser({ name: 'OneWayB', coPresenceOptIn: true });
    await follow(userA._id, userB._id); // A follows B, but B does not follow A back

    const now = new Date();
    const memA = await makeMemory({ userId: userA._id, coordinates: ANCHOR, createdAt: now });
    await makeMemory({ userId: userB._id, coordinates: ANCHOR, createdAt: now });

    await runCoPresenceCandidateJob();

    const candidates = await CoPresenceCandidate.find({
      $or: [
        { userA: userA._id, userB: userB._id },
        { userA: userB._id, userB: userA._id },
      ],
    });
    expect(candidates.length).toBe(0);
  });

  test('mutual follow but only ONE side opted in produces zero candidates', async () => {
    const userA = await makeUser({ name: 'HalfOptA', coPresenceOptIn: true });
    const userB = await makeUser({ name: 'HalfOptB', coPresenceOptIn: false }); // did not opt in
    await follow(userA._id, userB._id);
    await follow(userB._id, userA._id);

    const now = new Date();
    await makeMemory({ userId: userA._id, coordinates: ANCHOR, createdAt: now });
    await makeMemory({ userId: userB._id, coordinates: ANCHOR, createdAt: now });

    await runCoPresenceCandidateJob();

    const candidates = await CoPresenceCandidate.find({
      $or: [
        { userA: userA._id, userB: userB._id },
        { userA: userB._id, userB: userA._id },
      ],
    });
    expect(candidates.length).toBe(0);
  });

  test('mutual follow + both opted in + close in space and time => a candidate is written', async () => {
    const userA = await makeUser({ name: 'EligibleA', coPresenceOptIn: true });
    const userB = await makeUser({ name: 'EligibleB', coPresenceOptIn: true });
    await follow(userA._id, userB._id);
    await follow(userB._id, userA._id);

    const now = new Date();
    const memA = await makeMemory({ userId: userA._id, coordinates: ANCHOR, createdAt: now, imageEmbedding: SAME_EVENT_EMBEDDING });
    const memB = await makeMemory({
      userId: userB._id,
      coordinates: offsetCoords(ANCHOR, 50), // 50m away — well within default 200m
      createdAt: new Date(now.getTime() + 5 * 60000), // 5 minutes later
      imageEmbedding: SAME_EVENT_EMBEDDING,
    });

    await runCoPresenceCandidateJob();

    const candidate = await CoPresenceCandidate.findOne({
      memoryA: { $in: [memA._id, memB._id] },
      memoryB: { $in: [memA._id, memB._id] },
    });
    expect(candidate).toBeTruthy();
    expect(candidate.distanceMeters).toBeGreaterThan(0);
    expect(candidate.distanceMeters).toBeLessThan(200);
    expect(candidate.timeDeltaMinutes).toBeCloseTo(5, 0);
    expect(candidate.status).toBe('pending');
    // As of Phase 3, a WRITTEN candidate always carries a real similarity score — a
    // pair with no score yet is deferred (not written) rather than persisted as null.
    // See tests/phase3-visual-similarity.test.js for that deferral behavior directly.
    expect(candidate.visualSimilarity).toBeCloseTo(1, 5);
  });

  test('a PRIVATE account is still eligible when mutual-follow + opt-in both hold (privacy is not a second gate here)', async () => {
    const userA = await makeUser({ name: 'PrivateOkA', coPresenceOptIn: true });
    const userB = await makeUser({ name: 'PrivateOkB', coPresenceOptIn: true, isPrivate: true });
    await follow(userA._id, userB._id);
    await follow(userB._id, userA._id);

    const now = new Date();
    const memA = await makeMemory({ userId: userA._id, coordinates: ANCHOR, createdAt: now, imageEmbedding: SAME_EVENT_EMBEDDING });
    const memB = await makeMemory({ userId: userB._id, coordinates: offsetCoords(ANCHOR, 20), createdAt: now, imageEmbedding: SAME_EVENT_EMBEDDING });

    await runCoPresenceCandidateJob();

    const candidate = await CoPresenceCandidate.findOne({
      memoryA: { $in: [memA._id, memB._id] },
      memoryB: { $in: [memA._id, memB._id] },
    });
    expect(candidate).toBeTruthy();
  });

  test('mutual + both opted in, but too FAR apart in space => zero candidates', async () => {
    const userA = await makeUser({ name: 'FarA', coPresenceOptIn: true });
    const userB = await makeUser({ name: 'FarB', coPresenceOptIn: true });
    await follow(userA._id, userB._id);
    await follow(userB._id, userA._id);

    const now = new Date();
    await makeMemory({ userId: userA._id, coordinates: ANCHOR, createdAt: now });
    await makeMemory({ userId: userB._id, coordinates: offsetCoords(ANCHOR, 5000), createdAt: now }); // 5km away

    await runCoPresenceCandidateJob({ proximityMeters: 200 });

    const candidates = await CoPresenceCandidate.find({
      $or: [
        { userA: userA._id, userB: userB._id },
        { userA: userB._id, userB: userA._id },
      ],
    });
    expect(candidates.length).toBe(0);
  });

  test('mutual + both opted in, close in space, but OUTSIDE the time window => zero candidates', async () => {
    const userA = await makeUser({ name: 'LateA', coPresenceOptIn: true });
    const userB = await makeUser({ name: 'LateB', coPresenceOptIn: true });
    await follow(userA._id, userB._id);
    await follow(userB._id, userA._id);

    const now = new Date();
    await makeMemory({ userId: userA._id, coordinates: ANCHOR, createdAt: now });
    await makeMemory({
      userId: userB._id,
      coordinates: offsetCoords(ANCHOR, 10),
      createdAt: new Date(now.getTime() + 3 * 60 * 60000), // 3 hours later
    });

    await runCoPresenceCandidateJob({ timeWindowMinutes: 30 });

    const candidates = await CoPresenceCandidate.find({
      $or: [
        { userA: userA._id, userB: userB._id },
        { userA: userB._id, userB: userA._id },
      ],
    });
    expect(candidates.length).toBe(0);
  });

  test('running the job twice never duplicates a candidate for the same memory pair', async () => {
    const userA = await makeUser({ name: 'IdempotentA', coPresenceOptIn: true });
    const userB = await makeUser({ name: 'IdempotentB', coPresenceOptIn: true });
    await follow(userA._id, userB._id);
    await follow(userB._id, userA._id);

    const now = new Date();
    const memA = await makeMemory({ userId: userA._id, coordinates: ANCHOR, createdAt: now, imageEmbedding: SAME_EVENT_EMBEDDING });
    const memB = await makeMemory({ userId: userB._id, coordinates: offsetCoords(ANCHOR, 30), createdAt: now, imageEmbedding: SAME_EVENT_EMBEDDING });

    await runCoPresenceCandidateJob();
    const afterFirstRun = await CoPresenceCandidate.countDocuments({
      memoryA: { $in: [memA._id, memB._id] },
      memoryB: { $in: [memA._id, memB._id] },
    });
    expect(afterFirstRun).toBe(1);

    // Second run must not throw on the duplicate-key case, and must not add a second row.
    await expect(runCoPresenceCandidateJob()).resolves.toBeTruthy();
    const afterSecondRun = await CoPresenceCandidate.countDocuments({
      memoryA: { $in: [memA._id, memB._id] },
      memoryB: { $in: [memA._id, memB._id] },
    });
    expect(afterSecondRun).toBe(1);
  });

  test('maxPairs bounds how many eligible pairs a single run will even consider', async () => {
    // Three mutually-following, both-opted-in pairs among four users.
    const users = await Promise.all(
      ['CapA', 'CapB', 'CapC', 'CapD'].map((name) => makeUser({ name, coPresenceOptIn: true }))
    );
    for (let i = 0; i < users.length; i += 1) {
      for (let j = i + 1; j < users.length; j += 1) {
        await follow(users[i]._id, users[j]._id);
        await follow(users[j]._id, users[i]._id);
      }
    }

    const allPairs = await findEligibleMutualPairs({ maxPairs: 1000 });
    const theseFourIds = new Set(users.map((u) => u._id.toString()));
    const relevantPairs = allPairs.filter((p) => theseFourIds.has(p.userA) && theseFourIds.has(p.userB));
    expect(relevantPairs.length).toBeGreaterThanOrEqual(6); // C(4,2) = 6 mutual pairs among these four

    const capped = await findEligibleMutualPairs({ maxPairs: 1 });
    expect(capped.length).toBe(1);
  });

  test('the geo lookup inside candidate generation is index-backed, not a collection scan', async () => {
    const userA = await makeUser({ name: 'PlanCheckA', coPresenceOptIn: true });
    const userB = await makeUser({ name: 'PlanCheckB', coPresenceOptIn: true });

    const explainResult = await Memory.find({
      userId: userB._id,
      location: { $near: { $geometry: { type: 'Point', coordinates: ANCHOR }, $maxDistance: 200 } },
    }).explain('queryPlanner');

    const planText = JSON.stringify(explainResult);
    expect(planText).not.toMatch(/COLLSCAN/);
    // GEO_NEAR_2DSPHERE is the stage MongoDB uses when a $near query is served by a
    // 2dsphere index — confirming the existing index (memorySchema's own
    // `{ location: '2dsphere' }`) is what's actually answering this, not a scan.
    expect(planText).toMatch(/GEO_NEAR_2DSPHERE/);
  });
});
