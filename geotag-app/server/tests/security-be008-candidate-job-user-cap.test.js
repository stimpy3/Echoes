// Fix for audit finding BE-008: findEligibleMutualPairs' initial
// User.find({ coPresenceOptIn: true }) had no limit at all — maxPairs only bounded the
// function's OUTPUT, after the full opted-in population (and a Follower $in/$in query
// sized off of it) had already been pulled into memory. As the opted-in population
// grows, that first query's cost grows unboundedly even though the job's eventual
// output stays capped. maxOptedInUsers now caps the INPUT the same deliberate way
// maxPairs already caps the output.
//
// This proves the cap actually takes effect: a full mesh of mutually-following,
// opted-in users larger than the cap must only ever consider `maxOptedInUsers` of them,
// never all of them.

const fs = require('fs');
const path = require('path');
const os = require('os');
const mongoose = require('mongoose');

const STATE_FILE = path.join(os.tmpdir(), 'echoes-test-state.json');
const { mongoUri } = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));

let User, Follower;
let findEligibleMutualPairs;

beforeAll(async () => {
  await mongoose.connect(mongoUri);
  User = require('../models/users');
  Follower = require('../models/follower');
  ({ findEligibleMutualPairs } = require('../jobs/coPresenceCandidateJob'));
});

afterAll(async () => {
  await mongoose.disconnect();
});

let seq = 0;
function uniqueEmail(tag) {
  seq += 1;
  return `be008-${tag}-${Date.now()}-${seq}@example.test`;
}

async function makeOptedInUser(name) {
  return User.create({ name, email: uniqueEmail(name), password: 'irrelevant', coPresenceOptIn: true });
}

describe('BE-008 fix — candidate job caps the opted-in user population it considers', () => {
  test('a full mesh larger than maxOptedInUsers only ever considers maxOptedInUsers users', async () => {
    // 5 mutually-following, opted-in users; cap set to 3 — comfortably smaller, and
    // small enough that a full mesh (5*4 = 20 follow edges) stays a fast test.
    const users = [];
    for (let i = 0; i < 5; i += 1) {
      users.push(await makeOptedInUser(`BE008User${i}`));
    }

    for (const a of users) {
      for (const b of users) {
        if (a._id.equals(b._id)) continue;
        await Follower.create({ follower: a._id, following: b._id });
      }
    }

    const pairs = await findEligibleMutualPairs({ maxPairs: 500, maxOptedInUsers: 3 });

    const involvedUsers = new Set();
    for (const { userA, userB } of pairs) {
      involvedUsers.add(userA);
      involvedUsers.add(userB);
    }

    // A full mesh among exactly N considered users yields C(N,2) mutual pairs — if the
    // cap were NOT applied, 5 users would yield 10 pairs and 5 involved users instead.
    expect(involvedUsers.size).toBeLessThanOrEqual(3);
    expect(pairs.length).toBeLessThanOrEqual(3); // C(3,2) = 3
  });

  test('a population at or under the cap is entirely unaffected (no regression)', async () => {
    const users = [];
    for (let i = 0; i < 3; i += 1) {
      users.push(await makeOptedInUser(`BE008Small${i}`));
    }
    for (const a of users) {
      for (const b of users) {
        if (a._id.equals(b._id)) continue;
        await Follower.create({ follower: a._id, following: b._id });
      }
    }

    const pairs = await findEligibleMutualPairs({ maxPairs: 500, maxOptedInUsers: 5000 });

    const involvedUsers = new Set();
    for (const { userA, userB } of pairs) {
      involvedUsers.add(userA);
      involvedUsers.add(userB);
    }

    // All 3 of THIS test's users must be found among the results — other tests/files
    // sharing this DB may add unrelated opted-in users, so this checks a subset, not
    // an exact global pair count.
    for (const u of users) {
      expect(involvedUsers.has(u._id.toString())).toBe(true);
    }
  });
});
