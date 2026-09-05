// Fix for audit finding BE-018: GET /api/users/:id selected and returned `email` and
// `home` (the user's exact home GPS coordinates) for ANY user id to ANY authenticated
// caller, with no privacy or follow check at all. Verified live before this fix: a
// stranger with zero follow relationship to a private account retrieved that account's
// exact home coordinates and email address, both with a plain 200.
//
// `home` in particular has no legitimate use here at all — grep confirmed the client
// (ProfilePage.jsx) never reads it from this response; a viewer's own home already
// comes from the correctly self-scoped GET /api/user/gethome. This route now never
// returns anyone's home but their own. `email` follows the same public/private +
// follow-gate model every other piece of content in this app already uses.

const fs = require('fs');
const path = require('path');
const os = require('os');
const request = require('supertest');
const { flushRateLimits } = require('./helpers/flushRateLimits');

const STATE_FILE = path.join(os.tmpdir(), 'echoes-test-state.json');
const { baseURL } = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));

function extractTokenCookie(res) {
  const setCookie = res.headers['set-cookie'];
  const tokenLine = setCookie.find((c) => c.startsWith('token='));
  return tokenLine.split(';')[0];
}

let seq = 0;
function uniqueEmail(tag) {
  seq += 1;
  return `be018-${tag}-${Date.now()}-${seq}@example.test`;
}

async function createUser(name) {
  const email = uniqueEmail(name.replace(/\s+/g, ''));
  const signupRes = await request(baseURL)
    .post('/api/auth/signup')
    .send({ name, email, password: 'correct-horse-battery' });
  const cookie = extractTokenCookie(signupRes);
  const csrf = signupRes.body.csrfToken;
  const navbarRes = await request(baseURL).get('/api/user/navbar').set('Cookie', cookie);
  return { id: navbarRes.body._id, email, cookie, csrf };
}

async function makePrivate(user) {
  await request(baseURL)
    .patch('/api/user/privacy')
    .set('Cookie', user.cookie)
    .set('X-CSRF-Token', user.csrf)
    .send({ isPrivate: true });
}

async function setHome(user, lat, lng) {
  await request(baseURL)
    .post('/api/user/sethome')
    .set('Cookie', user.cookie)
    .set('X-CSRF-Token', user.csrf)
    .send({ lat, lng });
}

describe('BE-018 fix — GET /api/users/:id never leaks home coordinates, and gates email by privacy', () => {
  beforeEach(flushRateLimits);

  test('a stranger never sees a PRIVATE account\'s email or home, even though the profile itself is visible', async () => {
    const owner = await createUser('BE018 PrivOwnerA');
    const stranger = await createUser('BE018 StrangerA');
    await makePrivate(owner);
    await setHome(owner, 19.076, 72.8777);

    const res = await request(baseURL).get(`/api/users/${owner.id}`).set('Cookie', stranger.cookie);
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('BE018 PrivOwnerA'); // identity still visible — matches this app's existing model.
    expect(res.body.isPrivate).toBe(true);
    expect(res.body.email).toBeUndefined();
    expect(res.body.home).toBeUndefined();
  });

  test('a stranger never sees ANY account\'s home coordinates, even a PUBLIC one', async () => {
    const owner = await createUser('BE018 PubOwnerB');
    const stranger = await createUser('BE018 StrangerB');
    await setHome(owner, 19.076, 72.8777);

    const res = await request(baseURL).get(`/api/users/${owner.id}`).set('Cookie', stranger.cookie);
    expect(res.status).toBe(200);
    expect(res.body.home).toBeUndefined(); // home is never returned for anyone but the owner, public or not.
  });

  test('a stranger CAN still see a PUBLIC account\'s email (no regression — matches existing product behavior)', async () => {
    const owner = await createUser('BE018 PubOwnerC');
    const stranger = await createUser('BE018 StrangerC');

    const res = await request(baseURL).get(`/api/users/${owner.id}`).set('Cookie', stranger.cookie);
    expect(res.status).toBe(200);
    expect(res.body.email).toBe(owner.email);
  });

  test('an approved follower of a private account CAN see that account\'s email (no regression)', async () => {
    const owner = await createUser('BE018 PrivOwnerD');
    const follower = await createUser('BE018 FollowerD');
    await makePrivate(owner);

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

    const res = await request(baseURL).get(`/api/users/${owner.id}`).set('Cookie', follower.cookie);
    expect(res.status).toBe(200);
    expect(res.body.email).toBe(owner.email);
    expect(res.body.home).toBeUndefined(); // still never home — approved follower or not.
  });

  test('the owner always sees their own email AND home when viewing their own profile', async () => {
    const user = await createUser('BE018 SelfE');
    await makePrivate(user);
    await setHome(user, 19.076, 72.8777);

    const res = await request(baseURL).get(`/api/users/${user.id}`).set('Cookie', user.cookie);
    expect(res.status).toBe(200);
    expect(res.body.email).toBe(user.email);
    expect(res.body.home).toEqual({ lat: 19.076, lng: 72.8777 });
  });
});
