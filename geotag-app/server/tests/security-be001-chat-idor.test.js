// Fix for audit finding BE-001: GET /api/messages/:chatId previously returned any
// chat's full message history to any authenticated user, with no check that the caller
// was actually a participant. This suite proves the fix directly — a real chat between
// two real users, read by an uninvolved third user, must be rejected — and covers the
// edge cases the fix also had to get right (nonexistent chat, malformed id) without
// regressing the legitimate case (a real participant reading their own conversation).

const fs = require('fs');
const path = require('path');
const os = require('os');
const request = require('supertest');
const { io: ioClient } = require('socket.io-client');
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
  return `be001-${tag}-${Date.now()}-${seq}@example.test`;
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

// Creates a real Chat + Message via the actual Socket.IO path (the only way messages
// are created in this app — see messageRoutes.js's own comment on why POST /sendmessage
// was removed), the same way regression.test.js's chat test does, and returns the real
// chatId a genuine participant would have.
async function sendRealMessage(senderCookie, receiverId, text) {
  const socket = ioClient(baseURL, {
    transports: ['websocket'],
    extraHeaders: { Cookie: senderCookie },
  });

  try {
    await new Promise((resolve, reject) => {
      socket.on('connect', resolve);
      socket.on('connect_error', reject);
    });

    const ack = await new Promise((resolve, reject) => {
      socket.timeout(8000).emit('sendMessage', { receiverId, message: text }, (err, response) =>
        err ? reject(err) : resolve(response)
      );
    });

    return ack.message.chatId;
  } finally {
    socket.disconnect();
  }
}

describe('BE-001 fix — GET /api/messages/:chatId requires participation', () => {
  beforeEach(flushRateLimits); // this file creates several users per test.

  test('an uninvolved third user is rejected with 403, not given the messages', async () => {
    const userA = await createUser('BE001 A');
    const userB = await createUser('BE001 B');
    const stranger = await createUser('BE001 Stranger');

    const chatId = await sendRealMessage(userA.cookie, userB.id, 'a private message');

    const res = await request(baseURL).get(`/api/messages/${chatId}`).set('Cookie', stranger.cookie);
    expect(res.status).toBe(403);
    expect(Array.isArray(res.body)).toBe(false);
  });

  test('a real participant can still read the conversation normally (no regression)', async () => {
    const userA = await createUser('BE001 RegA');
    const userB = await createUser('BE001 RegB');

    const chatId = await sendRealMessage(userA.cookie, userB.id, 'hello there');

    const asA = await request(baseURL).get(`/api/messages/${chatId}`).set('Cookie', userA.cookie);
    expect(asA.status).toBe(200);
    expect(asA.body.some((m) => m.text === 'hello there')).toBe(true);

    const asB = await request(baseURL).get(`/api/messages/${chatId}`).set('Cookie', userB.cookie);
    expect(asB.status).toBe(200);
    expect(asB.body.some((m) => m.text === 'hello there')).toBe(true);
    // isOwn is per-caller, not a property of the message itself.
    expect(asA.body.find((m) => m.text === 'hello there').isOwn).toBe(true);
    expect(asB.body.find((m) => m.text === 'hello there').isOwn).toBe(false);
  });

  test('a well-formed but nonexistent chatId returns 404, not 500 or a message list', async () => {
    const user = await createUser('BE001 NoChat');
    const res = await request(baseURL)
      .get('/api/messages/000000000000000000000000')
      .set('Cookie', user.cookie);
    expect(res.status).toBe(404);
  });

  test('a malformed chatId returns 400, not a 500', async () => {
    const user = await createUser('BE001 Malformed');
    const res = await request(baseURL).get('/api/messages/not-a-real-id').set('Cookie', user.cookie);
    expect(res.status).toBe(400);
  });

  test('an unauthenticated request is rejected before any chat lookup happens', async () => {
    const res = await request(baseURL).get('/api/messages/000000000000000000000000');
    expect(res.status).toBe(401);
  });
});
