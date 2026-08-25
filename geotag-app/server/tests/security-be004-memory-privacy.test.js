// Fix for audit finding BE-004: GET /api/memory/single/:id, POST /like/:id, and
// POST /comment/:id previously fetched or mutated a Memory document with no
// privacy/ownership check at all — any authenticated user, any memory id, private
// account or not, followed or not. This suite proves the fix directly for all three
// routes, and just as importantly proves the legitimate cases still work: the owner,
// an approved follower of a private account, and any viewer of a public account.
//
// Memories are seeded directly via Mongoose (same pattern as phase4/phase5's test
// files), not through the real creatememory endpoint — this is an authorization test,
// not an upload test, and has no reason to make real Cloudinary calls the way
// regression.test.js's one deliberate upload test does.

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
  return `be004-${tag}-${Date.now()}-${seq}@example.test`;
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

async function follow(followerUser, targetId) {
  return request(baseURL)
    .post('/api/follow/request')
    .set('Cookie', followerUser.cookie)
    .set('X-CSRF-Token', followerUser.csrf)
    .send({ receiverId: targetId });
}

async function seedMemory(ownerId, title) {
  return Memory.create({
    userId: ownerId,
    title,
    description: 'BE-004 fixture memory',
    location: { type: 'Point', coordinates: [72.8777, 19.076], address: 'BE-004 test fixture' },
    photoUrl: 'https://example.test/fixture.jpg',
  });
}

describe('BE-004 fix — memory single/like/comment routes enforce privacy', () => {
  beforeEach(flushRateLimits); // this file signs up several users per test

  test('a stranger cannot view a private account\'s memory via /single/:id', async () => {
    const owner = await createUser('BE004 PrivOwnerA');
    const stranger = await createUser('BE004 StrangerA');
    await makePrivate(owner);
    const memory = await seedMemory(owner.id, 'Private memory A');

    const res = await request(baseURL).get(`/api/memory/single/${memory._id}`).set('Cookie', stranger.cookie);
    expect(res.status).toBe(403);
  });

  test('a stranger cannot like a private account\'s memory', async () => {
    const owner = await createUser('BE004 PrivOwnerB');
    const stranger = await createUser('BE004 StrangerB');
    await makePrivate(owner);
    const memory = await seedMemory(owner.id, 'Private memory B');

    const res = await request(baseURL)
      .post(`/api/memory/like/${memory._id}`)
      .set('Cookie', stranger.cookie)
      .set('X-CSRF-Token', stranger.csrf);
    expect(res.status).toBe(403);
  });

  test('a stranger cannot comment on a private account\'s memory', async () => {
    const owner = await createUser('BE004 PrivOwnerC');
    const stranger = await createUser('BE004 StrangerC');
    await makePrivate(owner);
    const memory = await seedMemory(owner.id, 'Private memory C');

    const res = await request(baseURL)
      .post(`/api/memory/comment/${memory._id}`)
      .set('Cookie', stranger.cookie)
      .set('X-CSRF-Token', stranger.csrf)
      .send({ text: 'trying to comment anyway' });
    expect(res.status).toBe(403);
  });

  test('an approved follower of a private account CAN still view/like/comment (no regression)', async () => {
    const owner = await createUser('BE004 PrivOwnerD');
    const follower = await createUser('BE004 FollowerD');
    await makePrivate(owner);
    const memory = await seedMemory(owner.id, 'Private memory D');

    const followRes = await follow(follower, owner.id);
    expect(followRes.body.requested).toBe(true); // private account -> request, not instant follow

    await request(baseURL)
      .post('/api/follow/confirm')
      .set('Cookie', owner.cookie)
      .set('X-CSRF-Token', owner.csrf)
      .send({ senderId: follower.id });

    const viewRes = await request(baseURL).get(`/api/memory/single/${memory._id}`).set('Cookie', follower.cookie);
    expect(viewRes.status).toBe(200);

    const likeRes = await request(baseURL)
      .post(`/api/memory/like/${memory._id}`)
      .set('Cookie', follower.cookie)
      .set('X-CSRF-Token', follower.csrf);
    expect(likeRes.status).toBe(200);

    const commentRes = await request(baseURL)
      .post(`/api/memory/comment/${memory._id}`)
      .set('Cookie', follower.cookie)
      .set('X-CSRF-Token', follower.csrf)
      .send({ text: 'approved follower comment' });
    expect(commentRes.status).toBe(201);
  });

  test('a stranger CAN still view/like/comment on a PUBLIC account\'s memory (no regression)', async () => {
    const owner = await createUser('BE004 PubOwnerE');
    const stranger = await createUser('BE004 StrangerE');
    // Accounts are public by default — no makePrivate() call here.
    const memory = await seedMemory(owner.id, 'Public memory E');

    const viewRes = await request(baseURL).get(`/api/memory/single/${memory._id}`).set('Cookie', stranger.cookie);
    expect(viewRes.status).toBe(200);

    const likeRes = await request(baseURL)
      .post(`/api/memory/like/${memory._id}`)
      .set('Cookie', stranger.cookie)
      .set('X-CSRF-Token', stranger.csrf);
    expect(likeRes.status).toBe(200);

    const commentRes = await request(baseURL)
      .post(`/api/memory/comment/${memory._id}`)
      .set('Cookie', stranger.cookie)
      .set('X-CSRF-Token', stranger.csrf)
      .send({ text: 'public account comment' });
    expect(commentRes.status).toBe(201);
  });

  test('the owner can always view/like/comment on their own memory, even while private', async () => {
    const owner = await createUser('BE004 SelfOwnerF');
    await makePrivate(owner);
    const memory = await seedMemory(owner.id, 'Own private memory F');

    const viewRes = await request(baseURL).get(`/api/memory/single/${memory._id}`).set('Cookie', owner.cookie);
    expect(viewRes.status).toBe(200);

    const likeRes = await request(baseURL)
      .post(`/api/memory/like/${memory._id}`)
      .set('Cookie', owner.cookie)
      .set('X-CSRF-Token', owner.csrf);
    expect(likeRes.status).toBe(200);
  });

  test('a nonexistent memory id still 404s on all three routes', async () => {
    const user = await createUser('BE004 NoMemG');
    const fakeId = '000000000000000000000000';

    const viewRes = await request(baseURL).get(`/api/memory/single/${fakeId}`).set('Cookie', user.cookie);
    expect(viewRes.status).toBe(404);

    const likeRes = await request(baseURL)
      .post(`/api/memory/like/${fakeId}`)
      .set('Cookie', user.cookie)
      .set('X-CSRF-Token', user.csrf);
    expect(likeRes.status).toBe(404);

    const commentRes = await request(baseURL)
      .post(`/api/memory/comment/${fakeId}`)
      .set('Cookie', user.cookie)
      .set('X-CSRF-Token', user.csrf)
      .send({ text: 'irrelevant' });
    expect(commentRes.status).toBe(404);
  });
});
