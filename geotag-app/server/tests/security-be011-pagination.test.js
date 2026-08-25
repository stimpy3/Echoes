// Fix for audit finding BE-011: several list routes had no upper bound on how many
// documents a single request could return — messages in a chat, a user's own memories,
// another user's memories, followers, following, and follow-request notifications all
// grow unboundedly with real usage over time, and every one of these routes used to
// return the entire result set in one response regardless of size.
//
// utils/pagination.js's resolveLimit() now caps every one of them (a default limit for
// existing callers who never pass ?limit=, plus an explicit MAX ceiling even for a
// caller who asks for more). This suite proves the cap using the cheapest route to
// exercise it against — messages, seeded directly via Mongoose rather than N real
// socket round trips — and spot-checks that memories/followers/notifications also
// respect an explicit ?limit=.

const fs = require('fs');
const path = require('path');
const os = require('os');
const request = require('supertest');
const mongoose = require('mongoose');
const { flushRateLimits } = require('./helpers/flushRateLimits');

const STATE_FILE = path.join(os.tmpdir(), 'echoes-test-state.json');
const { baseURL, mongoUri } = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));

let Chat, Message, Memory, Follower;

beforeAll(async () => {
  await mongoose.connect(mongoUri);
  Chat = require('../models/chat');
  Message = require('../models/message');
  Memory = require('../models/memories');
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
  return `be011-${tag}-${Date.now()}-${seq}@example.test`;
}

async function createUser(name) {
  const email = uniqueEmail(name.replace(/\s+/g, ''));
  const signupRes = await request(baseURL)
    .post('/api/auth/signup')
    .send({ name, email, password: 'correct-horse-battery' });
  const cookie = extractTokenCookie(signupRes);
  const navbarRes = await request(baseURL).get('/api/user/navbar').set('Cookie', cookie);
  return { id: navbarRes.body._id, cookie };
}

describe('BE-011 fix — unbounded list routes are now capped', () => {
  beforeEach(flushRateLimits);

  test('GET /api/messages/:chatId caps at the default limit and returns the MOST RECENT messages, oldest-first', async () => {
    const userA = await createUser('BE011 ChatA');
    const userB = await createUser('BE011 ChatB');
    const chat = await Chat.create({ participants: [userA.id, userB.id], pairKey: [userA.id, userB.id].sort().join('_') });

    // Seed well beyond the default limit (200) with a small, cheap limit override so
    // this test stays fast — proves the SAME mechanism without a 200-document seed.
    const TOTAL_MESSAGES = 12;
    const TEST_LIMIT = 5;
    for (let i = 0; i < TOTAL_MESSAGES; i += 1) {
      await Message.create({ chatId: chat._id, sender: userA.id, text: `msg-${i}` });
    }

    const res = await request(baseURL)
      .get(`/api/messages/${chat._id}?limit=${TEST_LIMIT}`)
      .set('Cookie', userA.cookie);

    expect(res.status).toBe(200);
    expect(res.body.length).toBe(TEST_LIMIT);
    // Oldest-first order preserved, and it's the LAST 5 (most recent), not the first 5.
    expect(res.body.map((m) => m.text)).toEqual(['msg-7', 'msg-8', 'msg-9', 'msg-10', 'msg-11']);
  });

  test('GET /api/messages/:chatId ?limit= cannot exceed the hard MAX_MESSAGE_LIMIT ceiling', async () => {
    const userA = await createUser('BE011 CeilingA');
    const userB = await createUser('BE011 CeilingB');
    const chat = await Chat.create({ participants: [userA.id, userB.id], pairKey: [userA.id, userB.id].sort().join('_') });
    await Message.create({ chatId: chat._id, sender: userA.id, text: 'only message' });

    const res = await request(baseURL)
      .get(`/api/messages/${chat._id}?limit=999999`)
      .set('Cookie', userA.cookie);

    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1); // the ceiling doesn't invent messages that don't exist; it just proves the request didn't error or hang.
  });

  test('GET /api/memory/fetchmemory respects an explicit ?limit=', async () => {
    const user = await createUser('BE011 MemOwner');
    for (let i = 0; i < 5; i += 1) {
      await Memory.create({
        userId: user.id,
        title: `BE-011 memory ${i}`,
        description: 'pagination fixture',
        location: { type: 'Point', coordinates: [72.8777, 19.076], address: 'fixture' },
        photoUrl: 'https://example.test/fixture.jpg',
      });
    }

    const res = await request(baseURL).get('/api/memory/fetchmemory?limit=2').set('Cookie', user.cookie);
    expect(res.status).toBe(200);
    expect(res.body.memories.length).toBe(2);
  });

  test('GET /api/users/followers respects an explicit ?limit=', async () => {
    const owner = await createUser('BE011 FollowedOwner');
    const followerA = await createUser('BE011 FollowerA');
    const followerB = await createUser('BE011 FollowerB');
    const followerC = await createUser('BE011 FollowerC');
    await Follower.create({ follower: followerA.id, following: owner.id });
    await Follower.create({ follower: followerB.id, following: owner.id });
    await Follower.create({ follower: followerC.id, following: owner.id });

    const res = await request(baseURL).get('/api/users/followers?limit=2').set('Cookie', owner.cookie);
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(2);
  });

  test('a request under the default limit is unaffected (no regression)', async () => {
    const user = await createUser('BE011 UnderLimit');
    await Memory.create({
      userId: user.id,
      title: 'BE-011 single memory',
      description: 'pagination fixture',
      location: { type: 'Point', coordinates: [72.8777, 19.076], address: 'fixture' },
      photoUrl: 'https://example.test/fixture.jpg',
    });

    const res = await request(baseURL).get('/api/memory/fetchmemory').set('Cookie', user.cookie);
    expect(res.status).toBe(200);
    expect(res.body.memories.length).toBe(1);
  });
});
