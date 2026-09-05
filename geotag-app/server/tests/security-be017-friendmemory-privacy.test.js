// Fix for audit finding BE-017: POST /api/memory/friendMemory trusted `userIds` from
// the request body completely — any authenticated caller could pass ANY user's id,
// private account or not, followed or not, and get their full memory list back (title,
// description, exact GPS coordinates, photo URL). Unlike every other listing route in
// this file, it had no buildPrivacyMatch() gate at all. Proven live against the real
// dev server before this fix: a stranger with zero follow relationship to a private
// account retrieved that account's memories in full through this route, while the
// already-fixed BE-004 routes correctly blocked the same stranger for the same memory.
//
// Mirrors security-be004-memory-privacy.test.js's structure — same trust boundary,
// different route.

const fs = require('fs');
const path = require('path');
const os = require('os');
const request = require('supertest');
const mongoose = require('mongoose');
const { flushRateLimits } = require('./helpers/flushRateLimits');

const STATE_FILE = path.join(os.tmpdir(), 'echoes-test-state.json');
const { baseURL, mongoUri } = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));

let Memory;

beforeAll(async () => {
  await mongoose.connect(mongoUri);
  Memory = require('../models/memories');
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
  return `be017-${tag}-${Date.now()}-${seq}@example.test`;
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

async function makePrivate(user) {
  await request(baseURL)
    .patch('/api/user/privacy')
    .set('Cookie', user.cookie)
    .set('X-CSRF-Token', user.csrf)
    .send({ isPrivate: true });
}

async function seedMemory(ownerId, title) {
  return Memory.create({
    userId: ownerId,
    title,
    description: 'BE-017 fixture memory',
    location: { type: 'Point', coordinates: [72.8777, 19.076], address: 'BE-017 test fixture' },
    photoUrl: 'https://example.test/fixture.jpg',
  });
}

describe('BE-017 fix — friendMemory enforces the same privacy boundary as every other listing route', () => {
  beforeEach(flushRateLimits);

  test('a stranger with no follow relationship gets nothing back for a private account', async () => {
    const owner = await createUser('BE017 PrivOwnerA');
    const stranger = await createUser('BE017 StrangerA');
    await makePrivate(owner);
    await seedMemory(owner.id, 'Private memory A');

    const res = await request(baseURL)
      .post('/api/memory/friendMemory')
      .set('Cookie', stranger.cookie)
      .set('X-CSRF-Token', stranger.csrf)
      .send({ userIds: [owner.id] });

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]); // no group for this user at all, not an empty memories array.
  });

  test('an approved follower of a private account still gets their memories (no regression)', async () => {
    const owner = await createUser('BE017 PrivOwnerB');
    const follower = await createUser('BE017 FollowerB');
    await makePrivate(owner);
    await seedMemory(owner.id, 'Private memory B');

    await request(baseURL)
      .post('/api/follow/request')
      .set('Cookie', follower.cookie)
      .set('X-CSRF-Token', follower.csrf)
      .send({ receiverId: owner.id });
    await request(baseURL)
      .post('/api/follow/confirm')
      .set('Cookie', owner.cookie)
      .set('X-CSRF-Token', owner.csrf)
      .send({ senderId: follower.id });

    const res = await request(baseURL)
      .post('/api/memory/friendMemory')
      .set('Cookie', follower.cookie)
      .set('X-CSRF-Token', follower.csrf)
      .send({ userIds: [owner.id] });

    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
    expect(res.body[0].memories[0].title).toBe('Private memory B');
  });

  test('a stranger CAN still see a PUBLIC account\'s memories (no regression)', async () => {
    const owner = await createUser('BE017 PubOwnerC');
    const stranger = await createUser('BE017 StrangerC');
    await seedMemory(owner.id, 'Public memory C');

    const res = await request(baseURL)
      .post('/api/memory/friendMemory')
      .set('Cookie', stranger.cookie)
      .set('X-CSRF-Token', stranger.csrf)
      .send({ userIds: [owner.id] });

    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
    expect(res.body[0].memories[0].title).toBe('Public memory C');
  });

  test('the caller can always see their own memories through this route', async () => {
    const user = await createUser('BE017 SelfD');
    await makePrivate(user);
    await seedMemory(user.id, 'Own private memory D');

    const res = await request(baseURL)
      .post('/api/memory/friendMemory')
      .set('Cookie', user.cookie)
      .set('X-CSRF-Token', user.csrf)
      .send({ userIds: [user.id] });

    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
  });

  test('a mix of one allowed and one blocked id only returns the allowed one', async () => {
    const stranger = await createUser('BE017 StrangerE');
    const privateOwner = await createUser('BE017 PrivOwnerE');
    const publicOwner = await createUser('BE017 PubOwnerE');
    await makePrivate(privateOwner);
    await seedMemory(privateOwner.id, 'Private memory E');
    await seedMemory(publicOwner.id, 'Public memory E');

    const res = await request(baseURL)
      .post('/api/memory/friendMemory')
      .set('Cookie', stranger.cookie)
      .set('X-CSRF-Token', stranger.csrf)
      .send({ userIds: [privateOwner.id, publicOwner.id] });

    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
    expect(res.body[0].memories[0].title).toBe('Public memory E');
  });
});
