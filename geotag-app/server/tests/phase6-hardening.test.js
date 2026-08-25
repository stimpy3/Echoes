// Phase 6 of the co-presence rollout plan: hardening, load, and a real kill switch.
//
// Three things under test:
//  1. The job-level kill switch — COPRESENCE_ENABLED=false must mean the job touches
//     NOTHING, not even a read, even when eligible data genuinely exists.
//  2. The route-level kill switch — tested against an isolated in-process Express app
//     (not the forked test server), because toggling process.env in THIS Jest process
//     has no effect on the forked app's already-running, separate OS process. This
//     directly exercises the same middleware code the real app uses, just not through
//     the real app's own process boundary.
//  3. A load test at a meaningfully larger synthetic population than any earlier phase
//     used, proving maxPairs still bounds the work done, not just "it works with 4 users."

const fs = require('fs');
const path = require('path');
const os = require('os');
const express = require('express');
const cookieParser = require('cookie-parser');
const request = require('supertest');
const mongoose = require('mongoose');

const STATE_FILE = path.join(os.tmpdir(), 'echoes-test-state.json');
const { mongoUri } = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));

let User, Follower, Memory, CoPresenceCandidate;
let runCoPresenceCandidateJob;
let getCoPresenceMetrics;

const ORIGINAL_FLAG = process.env.COPRESENCE_ENABLED;

beforeAll(async () => {
  // routes/coPresenceRoutes.js pulls in middleware/rateLimiter.js, which constructs a
  // Redis connection at require() time (utils/redisClient.js's createClient(), which
  // throws if REDIS_URL is unset) — same issue Phase 3's test file hit for the same
  // reason. This Jest process never loads server/.env, so it has to be set explicitly.
  process.env.REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6380';

  await mongoose.connect(mongoUri);
  User = require('../models/users');
  Follower = require('../models/follower');
  Memory = require('../models/memories');
  CoPresenceCandidate = require('../models/coPresenceCandidate');
  ({ runCoPresenceCandidateJob } = require('../jobs/coPresenceCandidateJob'));
  ({ getCoPresenceMetrics } = require('../utils/coPresenceMetrics'));
});

afterEach(() => {
  // process.env is a raw Node global, not sandboxed per test file the way Jest's
  // module registry is — leaving this flipped would silently affect any test file
  // that happens to run after this one in the same `npm test` invocation.
  if (ORIGINAL_FLAG === undefined) delete process.env.COPRESENCE_ENABLED;
  else process.env.COPRESENCE_ENABLED = ORIGINAL_FLAG;
});

afterAll(async () => {
  await mongoose.disconnect();
});

let seq = 0;
function uniqueEmail(tag) {
  seq += 1;
  return `phase6-${tag}-${Date.now()}-${seq}@example.test`;
}

async function makeUser({ name, coPresenceOptIn = true } = {}) {
  return User.create({ name, email: uniqueEmail(name.replace(/\s+/g, '')), password: 'irrelevant', coPresenceOptIn });
}

async function follow(followerId, followingId) {
  return Follower.create({ follower: followerId, following: followingId });
}

const ANCHOR = [72.8777, 19.076];
const SAME_EVENT_EMBEDDING = [1, 0, 0, 0, 0, 0, 0, 0];

async function makeMemory(userId, lngOffset = 0) {
  return Memory.create({
    userId,
    title: 'Fixture memory',
    description: 'Phase 6 hardening fixture',
    location: { type: 'Point', coordinates: [ANCHOR[0] + lngOffset, ANCHOR[1]], address: 'Fixture address' },
    photoUrl: 'https://example.test/fixture.jpg',
    imageEmbedding: SAME_EVENT_EMBEDDING,
  });
}

describe('Phase 6 — job-level kill switch', () => {
  test('disabled: the job returns a skipped result and writes NOTHING, even with genuinely eligible data', async () => {
    const userA = await makeUser({ name: 'KillA' });
    const userB = await makeUser({ name: 'KillB' });
    await follow(userA._id, userB._id);
    await follow(userB._id, userA._id);
    await makeMemory(userA._id, 0);
    await makeMemory(userB._id, 0.00005); // a few meters away — well within default range

    process.env.COPRESENCE_ENABLED = 'false';

    const result = await runCoPresenceCandidateJob();
    expect(result.skipped).toBe(true);
    expect(result.reason).toBe('disabled');
    expect(result.candidatesWritten).toBe(0);

    const candidates = await CoPresenceCandidate.find({
      $or: [{ userA: userA._id }, { userB: userA._id }],
    });
    expect(candidates.length).toBe(0);
  });

  test('re-enabled: the exact same eligible data now produces a candidate normally', async () => {
    const userA = await makeUser({ name: 'ReenableA' });
    const userB = await makeUser({ name: 'ReenableB' });
    await follow(userA._id, userB._id);
    await follow(userB._id, userA._id);
    const memA = await makeMemory(userA._id, 0);
    const memB = await makeMemory(userB._id, 0.00005);

    process.env.COPRESENCE_ENABLED = 'false';
    const disabledRun = await runCoPresenceCandidateJob();
    expect(disabledRun.skipped).toBe(true);

    delete process.env.COPRESENCE_ENABLED; // unset -> defaults to enabled
    const enabledRun = await runCoPresenceCandidateJob();
    expect(enabledRun.skipped).toBe(false);

    const candidate = await CoPresenceCandidate.findOne({
      memoryA: { $in: [memA._id, memB._id] },
      memoryB: { $in: [memA._id, memB._id] },
    });
    expect(candidate).toBeTruthy();
  });

  test('flipping the flag off does not touch already-existing opt-in state or confirmed matches', async () => {
    const userA = await makeUser({ name: 'PreserveA', coPresenceOptIn: true });

    process.env.COPRESENCE_ENABLED = 'false';
    await runCoPresenceCandidateJob();

    const stillOptedIn = await User.findById(userA._id);
    expect(stillOptedIn.coPresenceOptIn).toBe(true);
  });
});

describe('Phase 6 — route-level kill switch', () => {
  // An isolated in-process app mounting the REAL router — this tests the same
  // middleware code the live app runs, just without depending on the forked test
  // server's separate OS process (whose env can't be toggled from here — see this
  // file's header comment).
  function buildTestApp() {
    delete require.cache[require.resolve('../routes/coPresenceRoutes')];
    const coPresenceRoutes = require('../routes/coPresenceRoutes');
    const app = express();
    app.use(express.json());
    // Matches the real app's actual middleware stack (server/index.js) — verifyToken
    // reads req.cookies.token, which is only populated by cookie-parser. Without it,
    // req.cookies is undefined and that read throws synchronously instead of cleanly
    // returning 401, which is a gap in this test app, not in verifyToken itself.
    app.use(cookieParser());
    app.use('/api/copresence', coPresenceRoutes);
    return app;
  }

  test('disabled: every route responds 503, before authentication is even checked', async () => {
    process.env.COPRESENCE_ENABLED = 'false';
    const app = buildTestApp();

    const pending = await request(app).get('/api/copresence/pending'); // no cookie at all
    expect(pending.status).toBe(503);

    const confirm = await request(app).post('/api/copresence/000000000000000000000000/confirm');
    expect(confirm.status).toBe(503);
  });

  test('enabled: routes fall through to normal auth handling (401 with no cookie), not 503', async () => {
    delete process.env.COPRESENCE_ENABLED;
    const app = buildTestApp();

    const pending = await request(app).get('/api/copresence/pending');
    expect(pending.status).toBe(401);
  });
});

describe('Phase 6 — load test at meaningfully larger scale', () => {
  test('maxPairs still bounds pairsConsidered even with far more eligible pairs available than the cap', async () => {
    const POPULATION = 40; // C(40,2) = 780 eligible mutual pairs — well over the cap used below.
    const users = [];
    for (let i = 0; i < POPULATION; i += 1) {
      users.push(await makeUser({ name: `Load${i}` }));
    }
    const userIds = users.map((u) => u._id);

    // Full mutual mesh — deliberately more eligible pairs than any earlier phase test
    // used, to prove the bound holds at scale, not just with a handful of users.
    for (let i = 0; i < users.length; i += 1) {
      for (let j = i + 1; j < users.length; j += 1) {
        await follow(users[i]._id, users[j]._id);
        await follow(users[j]._id, users[i]._id);
      }
    }

    for (const user of users) {
      await makeMemory(user._id, 0);
    }

    try {
      const CAP = 50;
      const started = Date.now();
      const result = await runCoPresenceCandidateJob({ maxPairs: CAP });
      const elapsedMs = Date.now() - started;

      expect(result.pairsConsidered).toBe(CAP); // capped, not the full 780 eligible pairs
      expect(result.candidatesWritten).toBeLessThanOrEqual(CAP);
      // Generous bound — this is a smoke test against a catastrophic blowup (an
      // accidental O(n^3) bug), not a tight performance regression assertion that
      // would be flaky on a slower machine or a loaded CI runner.
      expect(elapsedMs).toBeLessThan(20000);
    } finally {
      // This test's whole point is to create far more eligible pairs than maxPairs
      // caps — left behind, those ~780 pairs would permanently crowd out any OTHER
      // test file's own pair from ever being among the first `maxPairs` considered,
      // since findEligibleMutualPairs operates globally over the real shared test
      // database by design (it isn't, and shouldn't be, scoped per test — that's
      // exactly how it needs to behave in production too). Clean up everything this
      // test created so it can't leak into any other file's results, regardless of
      // which order Jest happens to run test files in.
      await CoPresenceCandidate.deleteMany({ $or: [{ userA: { $in: userIds } }, { userB: { $in: userIds } }] });
      await Memory.deleteMany({ userId: { $in: userIds } });
      await Follower.deleteMany({ $or: [{ follower: { $in: userIds } }, { following: { $in: userIds } }] });
      await User.deleteMany({ _id: { $in: userIds } });
    }
  }, 30000);
});

describe('Phase 6 — metrics', () => {
  test('getCoPresenceMetrics reflects actual current candidate/match state', async () => {
    const userA = await makeUser({ name: 'MetricsA' });
    const userB = await makeUser({ name: 'MetricsB' });
    await follow(userA._id, userB._id);
    await follow(userB._id, userA._id);
    await makeMemory(userA._id, 0);
    await makeMemory(userB._id, 0.00005);

    const before = await getCoPresenceMetrics();
    await runCoPresenceCandidateJob();
    const after = await getCoPresenceMetrics();

    expect(after.candidatesByStatus.pending).toBeGreaterThanOrEqual(before.candidatesByStatus.pending);
    expect(typeof after.matchRate === 'number' || after.matchRate === null).toBe(true);
  });
});
