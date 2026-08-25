/*
Co-presence rollout, Phase 2: candidate generation. This is a plain, invocable module —
NOT required by server/index.js, NOT started automatically, NOT on any HTTP route. It
only runs when something explicitly calls runCoPresenceCandidateJob() (today: the test
suite; a real schedule/cron entry point is a Phase 6 concern, deliberately not built yet
so this phase can be proven correct in isolation first).

The one rule every other function in this file exists to serve: a pair of users is only
ever considered if BOTH mutually follow each other AND both have explicitly opted in
(User.coPresenceOptIn). Nothing here reads isPrivate — mutual follow is already the trust
boundary a private account's owner controls (they approved that follower), so it isn't a
second gate on top of that; it's the same gate FUTURE_SCOPE.md describes for this feature.

Output is a coarse candidate: which two memories, how far apart, how close in time. No
visual-similarity score yet (that's Phase 3, once image embeddings exist) — a Phase 2
candidate is never shown to anyone; Phase 4 is the first thing with a read path into
this collection at all.
*/

const User = require('../models/users');
const Follower = require('../models/follower');
const Memory = require('../models/memories');
const CoPresenceCandidate = require('../models/coPresenceCandidate');
const { haversineMeters } = require('../utils/geo');
const { isCoPresenceEnabled } = require('../utils/featureFlags');
// From vectorMath.js, NOT embeddingHelper.js — importing the latter here would also
// trigger its eager MiniLM preload as a side effect of require() (see that file), which
// has no reason to run in whatever process merely wants this job's candidate logic
// (the Jest test process is exactly that case — it never runs the real app). This is
// the same generic cosineSimilarity Explore's k-means step already uses on TEXT
// embeddings; Phase 3 reuses it as-is on IMAGE embeddings, just from its new home.
const { cosineSimilarity } = require('../utils/vectorMath');
const logger = require('../utils/logger').child({ component: 'copresence-candidate-job' });

// Co-presence rollout, Phase 3 default. Not tuned against real labeled data yet — a
// reasonable starting point (see tests/phase3-visual-similarity.test.js for the
// synthetic same-event-vs-unrelated cases this threshold is checked against), and the
// one number a future phase should revisit once real confirm/reject outcomes exist to
// tune it against.
const DEFAULT_VISUAL_SIMILARITY_THRESHOLD = 0.6;

/**
 * Mutual-follow pairs among users who have BOTH opted in. Bounded by maxPairs so the
 * job's cost can't grow unboundedly as the opted-in population grows — see the rollout
 * plan's Phase 2 notes on why this is a hard cap, not a soft suggestion.
 *
 * Audit finding BE-008: the initial User.find({ coPresenceOptIn: true }) had no limit
 * at all — maxPairs only bounded the OUTPUT of this function, after the full opted-in
 * population (and then a Follower $in/$in query sized off of it) had already been
 * pulled into memory. As the opted-in population grows, that first query's cost grows
 * unboundedly even though the job's eventual output stays capped — maxOptedInUsers caps
 * the input the same deliberate way maxPairs already caps the output. A stable sort
 * (by _id) makes which users get truncated, if the cap is ever hit, consistent run to
 * run rather than arbitrary.
 */
async function findEligibleMutualPairs({ maxPairs = 500, maxOptedInUsers = 5000 } = {}) {
  const optedInUsers = await User.find({ coPresenceOptIn: true })
    .select('_id')
    .sort({ _id: 1 })
    .limit(maxOptedInUsers)
    .lean();
  const optedInIds = optedInUsers.map((u) => u._id);

  if (optedInIds.length === maxOptedInUsers) {
    logger.warn(
      { maxOptedInUsers },
      'co-presence candidate job: opted-in user count hit maxOptedInUsers — some eligible users were not considered this run'
    );
  }

  if (optedInIds.length < 2) return [];

  // Edges among opted-in users ONLY — a follow edge involving anyone who hasn't opted
  // in is irrelevant here and excluded at the query itself, not filtered out after.
  const edges = await Follower.find({
    follower: { $in: optedInIds },
    following: { $in: optedInIds },
  })
    .select('follower following')
    .lean();

  const edgeKeys = new Set(edges.map((e) => `${e.follower.toString()}_${e.following.toString()}`));
  const seenPairs = new Set();
  const pairs = [];

  for (const edge of edges) {
    const followerId = edge.follower.toString();
    const followingId = edge.following.toString();

    // Mutual means the reverse edge exists too — a one-directional follow, however
    // recent or however "opted in" both sides are, is not eligible.
    if (!edgeKeys.has(`${followingId}_${followerId}`)) continue;

    const [a, b] = [followerId, followingId].sort();
    const pairKey = `${a}_${b}`;
    if (seenPairs.has(pairKey)) continue;
    seenPairs.add(pairKey);

    pairs.push({ userA: a, userB: b });
    if (pairs.length >= maxPairs) break;
  }

  return pairs;
}

/**
 * Spatio-temporal + (Phase 3) visual candidates for one eligible pair. Uses the
 * existing 2dsphere index (memorySchema.index({ location: '2dsphere' })) via $near —
 * the same index-backed mechanism Explore's Stream B already relies on, not a new query
 * shape for MongoDB to plan from scratch. maxMemoriesPerUser bounds the outer loop so
 * one prolific user pair can't make a single job run arbitrarily expensive.
 *
 * Phase 3: a spatio-temporal match is no longer enough on its own to become a
 * candidate. Two people can easily be 50m apart and 5 minutes apart in a crowded place
 * without being TOGETHER (a mall, a stadium — see the rollout plan's Phase 2 notes).
 * `visualSimilarity` (cosine similarity of the two photos' CLIP embeddings) is the term
 * that separates "both nearby" from "actually with each other." A pair whose photos
 * haven't been embedded yet (imageEmbedding not generated — see models/memories.js) is
 * skipped for THIS run, not persisted with a missing score; it becomes eligible again
 * automatically once a later run finds both embeddings populated. A pair below
 * `visualSimilarityThreshold` is discarded outright — never written, never a row that
 * has to be deleted later.
 */
async function generateCandidatesForPair({
  userA,
  userB,
  maxMemoriesPerUser = 200,
  proximityMeters = 200,
  timeWindowMinutes = 30,
  maxCandidatesPerPair = 20,
  visualSimilarityThreshold = DEFAULT_VISUAL_SIMILARITY_THRESHOLD,
}) {
  const memoriesA = await Memory.find({ userId: userA })
    .select('_id location createdAt +imageEmbedding')
    .sort({ createdAt: -1 })
    .limit(maxMemoriesPerUser)
    .lean();

  const candidates = [];

  for (const memA of memoriesA) {
    if (!memA.location || !memA.location.coordinates) continue;

    const nearbyB = await Memory.find({
      userId: userB,
      location: {
        $near: {
          $geometry: memA.location,
          $maxDistance: proximityMeters,
        },
      },
    })
      .select('_id location createdAt +imageEmbedding')
      .limit(5)
      .lean();

    for (const memB of nearbyB) {
      const timeDeltaMinutes = Math.abs(new Date(memA.createdAt) - new Date(memB.createdAt)) / 60000;
      if (timeDeltaMinutes > timeWindowMinutes) continue;

      // Not yet embedded on one or both sides — defer to a later run rather than
      // persist a partial/no-score candidate.
      if (!memA.imageEmbedding?.length || !memB.imageEmbedding?.length) continue;

      const visualSimilarity = cosineSimilarity(memA.imageEmbedding, memB.imageEmbedding);
      if (visualSimilarity < visualSimilarityThreshold) continue;

      candidates.push({
        memoryA: memA._id,
        memoryB: memB._id,
        distanceMeters: haversineMeters(memA.location.coordinates, memB.location.coordinates),
        timeDeltaMinutes,
        visualSimilarity,
      });

      if (candidates.length >= maxCandidatesPerPair) return candidates;
    }
  }

  return candidates;
}

/**
 * Entry point. Idempotent — re-running it after memories/follows have changed only
 * ever adds NEW candidates; it never duplicates one for the same (memoryA, memoryB)
 * pair, enforced by the unique compound index on CoPresenceCandidate itself, not just
 * application-level care. A duplicate-key error here is expected steady-state
 * behavior, not a fault.
 */
async function runCoPresenceCandidateJob(options = {}) {
  // Phase 6 kill switch — checked FIRST, before a single query runs. A disabled flag
  // means this function does not touch the database at all, not even a read; that's
  // the difference between "stops producing new results" and "genuinely does nothing,"
  // and an emergency rollback should mean the latter.
  if (!isCoPresenceEnabled()) {
    const summary = {
      skipped: true,
      reason: 'disabled',
      pairsConsidered: 0,
      candidatesWritten: 0,
      candidatesSkippedDuplicate: 0,
    };
    logger.info(summary, 'co-presence candidate job skipped — disabled via COPRESENCE_ENABLED');
    return summary;
  }

  const {
    maxPairs = 500,
    maxOptedInUsers = 5000,
    maxMemoriesPerUser = 200,
    proximityMeters = 200,
    timeWindowMinutes = 30,
    maxCandidatesPerPair = 20,
    visualSimilarityThreshold = DEFAULT_VISUAL_SIMILARITY_THRESHOLD,
  } = options;

  const pairs = await findEligibleMutualPairs({ maxPairs, maxOptedInUsers });

  let candidatesWritten = 0;
  let candidatesSkippedDuplicate = 0;

  for (const { userA, userB } of pairs) {
    const candidates = await generateCandidatesForPair({
      userA,
      userB,
      maxMemoriesPerUser,
      proximityMeters,
      timeWindowMinutes,
      maxCandidatesPerPair,
      visualSimilarityThreshold,
    });

    for (const candidate of candidates) {
      try {
        await CoPresenceCandidate.create({
          userA,
          userB,
          memoryA: candidate.memoryA,
          memoryB: candidate.memoryB,
          distanceMeters: candidate.distanceMeters,
          timeDeltaMinutes: candidate.timeDeltaMinutes,
          visualSimilarity: candidate.visualSimilarity,
        });
        candidatesWritten += 1;
      } catch (err) {
        if (err.code === 11000) {
          candidatesSkippedDuplicate += 1;
          continue;
        }
        throw err;
      }
    }
  }

  const summary = { skipped: false, pairsConsidered: pairs.length, candidatesWritten, candidatesSkippedDuplicate };
  logger.info(summary, 'co-presence candidate job run complete');
  return summary;
}

module.exports = {
  runCoPresenceCandidateJob,
  findEligibleMutualPairs,
  generateCandidatesForPair,
};
