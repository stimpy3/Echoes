// Phase 3 of the co-presence rollout plan: visual similarity.
//
// Two things are tested here, deliberately without ever loading the real CLIP model —
// see utils/imageEmbeddingHelper.js for why that's not something this suite should
// depend on (a cold load attempt in this environment took over 90 seconds without
// finishing). What Phase 3 is actually responsible for — the threshold/deferral LOGIC
// in the candidate job, and the queue-isolation guarantee — is fully testable with
// synthetic embedding vectors and the real (but empty) BullMQ queues, no model needed.
//
// 1. The candidate job's similarity gate: a spatio-temporal match with no image
//    embedding yet is deferred (not written); one with a low similarity score is
//    discarded outright; one with a high similarity score is written with its real
//    score attached.
// 2. Queue isolation: the image-embedding queue and text-embedding queue are
//    structurally separate BullMQ queues — a job added to one is invisible to the
//    other's job counts, and jobs actually run this app's OWN production queue helpers
//    (queues/embeddingQueue.js, queues/imageEmbeddingQueue.js), not test doubles.

const fs = require('fs');
const path = require('path');
const os = require('os');
const mongoose = require('mongoose');

const STATE_FILE = path.join(os.tmpdir(), 'echoes-test-state.json');
const { mongoUri } = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));

let User, Follower, Memory, CoPresenceCandidate;
let runCoPresenceCandidateJob;
let embeddingQueue, enqueueEmbeddingJob;
let imageEmbeddingQueue, enqueueImageEmbeddingJob;

beforeAll(async () => {
  // The queue modules construct a Redis connection at require() time
  // (utils/redisClient.js's createClient(), which THROWS if REDIS_URL is unset) — this
  // Jest process never loads server/.env (only the forked app does, via dotenv in
  // index.js), so it has to be set explicitly here, before requiring them, pointed at
  // the same disposable test-only Redis instance as everything else in this suite.
  process.env.REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6380';

  await mongoose.connect(mongoUri);
  User = require('../models/users');
  Follower = require('../models/follower');
  Memory = require('../models/memories');
  CoPresenceCandidate = require('../models/coPresenceCandidate');
  ({ runCoPresenceCandidateJob } = require('../jobs/coPresenceCandidateJob'));
  ({ embeddingQueue, enqueueEmbeddingJob } = require('../queues/embeddingQueue'));
  ({ imageEmbeddingQueue, enqueueImageEmbeddingJob } = require('../queues/imageEmbeddingQueue'));
});

afterAll(async () => {
  await mongoose.disconnect();
});

let seq = 0;
function uniqueEmail(tag) {
  seq += 1;
  return `phase3-${tag}-${Date.now()}-${seq}@example.test`;
}

async function makeUser({ name, coPresenceOptIn = true } = {}) {
  return User.create({ name, email: uniqueEmail(name.replace(/\s+/g, '')), password: 'irrelevant', coPresenceOptIn });
}

async function follow(followerId, followingId) {
  return Follower.create({ follower: followerId, following: followingId });
}

async function makeMemory({ userId, coordinates, createdAt, imageEmbedding }) {
  return Memory.create({
    userId,
    title: 'Test memory',
    description: 'Fixture memory for Phase 3 visual-similarity tests',
    location: { type: 'Point', coordinates, address: 'Fixture address' },
    photoUrl: 'https://example.test/fixture.jpg',
    createdAt,
    imageEmbedding,
  });
}

const ANCHOR = [72.8777, 19.076];
function offsetCoords([lng, lat], metersEast) {
  return [lng + metersEast / 111320, lat];
}

const SAME_EVENT_EMBEDDING = [1, 0, 0, 0, 0, 0, 0, 0];
const UNRELATED_EMBEDDING = [0, 1, 0, 0, 0, 0, 0, 0]; // orthogonal to the above -> cosine similarity 0

async function makeEligiblePair() {
  const userA = await makeUser({ name: `SimA${seq}` });
  const userB = await makeUser({ name: `SimB${seq}` });
  await follow(userA._id, userB._id);
  await follow(userB._id, userA._id);
  return { userA, userB };
}

describe('Phase 3 — visual similarity threshold logic', () => {
  test('a spatio-temporally eligible pair with NO image embedding yet is deferred, not written', async () => {
    const { userA, userB } = await makeEligiblePair();
    const now = new Date();
    const memA = await makeMemory({ userId: userA._id, coordinates: ANCHOR, createdAt: now }); // no imageEmbedding
    const memB = await makeMemory({ userId: userB._id, coordinates: offsetCoords(ANCHOR, 10), createdAt: now }); // no imageEmbedding

    await runCoPresenceCandidateJob();

    const candidate = await CoPresenceCandidate.findOne({
      memoryA: { $in: [memA._id, memB._id] },
      memoryB: { $in: [memA._id, memB._id] },
    });
    expect(candidate).toBeNull();
  });

  test('one side embedded, the other not, is still deferred (needs BOTH sides)', async () => {
    const { userA, userB } = await makeEligiblePair();
    const now = new Date();
    const memA = await makeMemory({ userId: userA._id, coordinates: ANCHOR, createdAt: now, imageEmbedding: SAME_EVENT_EMBEDDING });
    const memB = await makeMemory({ userId: userB._id, coordinates: offsetCoords(ANCHOR, 10), createdAt: now }); // still missing

    await runCoPresenceCandidateJob();

    const candidate = await CoPresenceCandidate.findOne({
      memoryA: { $in: [memA._id, memB._id] },
      memoryB: { $in: [memA._id, memB._id] },
    });
    expect(candidate).toBeNull();
  });

  test('both embedded but visually UNRELATED (below threshold) is discarded, not written', async () => {
    const { userA, userB } = await makeEligiblePair();
    const now = new Date();
    const memA = await makeMemory({ userId: userA._id, coordinates: ANCHOR, createdAt: now, imageEmbedding: SAME_EVENT_EMBEDDING });
    const memB = await makeMemory({ userId: userB._id, coordinates: offsetCoords(ANCHOR, 10), createdAt: now, imageEmbedding: UNRELATED_EMBEDDING });

    await runCoPresenceCandidateJob();

    const candidate = await CoPresenceCandidate.findOne({
      memoryA: { $in: [memA._id, memB._id] },
      memoryB: { $in: [memA._id, memB._id] },
    });
    expect(candidate).toBeNull();
  });

  test('both embedded and visually similar (above threshold) IS written, with the real score attached', async () => {
    const { userA, userB } = await makeEligiblePair();
    const now = new Date();
    const memA = await makeMemory({ userId: userA._id, coordinates: ANCHOR, createdAt: now, imageEmbedding: SAME_EVENT_EMBEDDING });
    const memB = await makeMemory({ userId: userB._id, coordinates: offsetCoords(ANCHOR, 10), createdAt: now, imageEmbedding: SAME_EVENT_EMBEDDING });

    await runCoPresenceCandidateJob();

    const candidate = await CoPresenceCandidate.findOne({
      memoryA: { $in: [memA._id, memB._id] },
      memoryB: { $in: [memA._id, memB._id] },
    });
    expect(candidate).toBeTruthy();
    expect(candidate.visualSimilarity).toBeCloseTo(1, 5);
  });

  test('the threshold is configurable — a stricter caller-supplied threshold can reject a pair the default would accept', async () => {
    const { userA, userB } = await makeEligiblePair();
    const now = new Date();
    // A moderately-similar-but-not-identical pair of vectors: cosine similarity is
    // comfortably above the DEFAULT 0.6 threshold but below a strict 0.99 one.
    const memA = await makeMemory({ userId: userA._id, coordinates: ANCHOR, createdAt: now, imageEmbedding: [1, 0, 0, 0, 0, 0, 0, 0] });
    const memB = await makeMemory({ userId: userB._id, coordinates: offsetCoords(ANCHOR, 10), createdAt: now, imageEmbedding: [0.8, 0.6, 0, 0, 0, 0, 0, 0] });

    await runCoPresenceCandidateJob({ visualSimilarityThreshold: 0.99 });
    const withStrictThreshold = await CoPresenceCandidate.findOne({
      memoryA: { $in: [memA._id, memB._id] },
      memoryB: { $in: [memA._id, memB._id] },
    });
    expect(withStrictThreshold).toBeNull();

    await runCoPresenceCandidateJob({ visualSimilarityThreshold: 0.5 });
    const withDefaultishThreshold = await CoPresenceCandidate.findOne({
      memoryA: { $in: [memA._id, memB._id] },
      memoryB: { $in: [memA._id, memB._id] },
    });
    expect(withDefaultishThreshold).toBeTruthy();
  });
});

describe('Phase 3 — image-embedding queue is structurally isolated from the text-embedding queue', () => {
  function totalJobs(counts) {
    return Object.values(counts).reduce((sum, n) => sum + n, 0);
  }

  test('a job added to the image queue never shows up in the text queue\'s counts, and vice versa', async () => {
    /*
    Both queues are paused for the duration of this check. Not to fake isolation —
    they're genuinely separate BullMQ queues by name regardless — but because the REAL
    app process (forked by tests/globalSetup.js) has a REAL, already-running
    embeddingWorker consuming 'embedding-generation' jobs. Without pausing, a text job
    this test adds could be raced away by that live worker before getJobCounts() reads
    it back, making the assertion flaky through no fault of the isolation itself. Pause
    is a queue-level flag every worker (including that one) respects, and both queues
    are resumed again below so the real app's normal processing continues afterward —
    this test doesn't touch the image-embedding worker at all, since none is started
    yet (see workers/imageEmbeddingWorker.js).
    */
    await embeddingQueue.pause();
    await imageEmbeddingQueue.pause();

    try {
      const beforeText = totalJobs(await embeddingQueue.getJobCounts());
      const beforeImage = totalJobs(await imageEmbeddingQueue.getJobCounts());

      await enqueueImageEmbeddingJob('000000000000000000000001', 'https://example.test/a.jpg');
      await enqueueImageEmbeddingJob('000000000000000000000002', 'https://example.test/b.jpg');
      await enqueueImageEmbeddingJob('000000000000000000000003', 'https://example.test/c.jpg');

      const afterImageAdds_image = totalJobs(await imageEmbeddingQueue.getJobCounts());
      const afterImageAdds_text = totalJobs(await embeddingQueue.getJobCounts());

      expect(afterImageAdds_image).toBe(beforeImage + 3);
      // The text queue's count is completely unaffected by three jobs landing in the
      // image queue — this is the actual isolation claim under test.
      expect(afterImageAdds_text).toBe(beforeText);

      await enqueueEmbeddingJob('000000000000000000000004', 'a fixture text job');
      const afterTextAdd_text = totalJobs(await embeddingQueue.getJobCounts());
      expect(afterTextAdd_text).toBe(beforeText + 1);

      // Cleanup: remove exactly the jobs this test added, so it leaves no residue for
      // the real worker to (fail to) process once queues resume below.
      const addedImageJobs = await imageEmbeddingQueue.getJobs(['waiting', 'paused', 'delayed']);
      await Promise.all(
        addedImageJobs
          .filter((j) => ['000000000000000000000001', '000000000000000000000002', '000000000000000000000003'].includes(j.data?.memoryId))
          .map((j) => j.remove())
      );
      const addedTextJobs = await embeddingQueue.getJobs(['waiting', 'paused', 'delayed']);
      await Promise.all(
        addedTextJobs.filter((j) => j.data?.memoryId === '000000000000000000000004').map((j) => j.remove())
      );
    } finally {
      await embeddingQueue.resume();
      await imageEmbeddingQueue.resume();
    }
  });
});
