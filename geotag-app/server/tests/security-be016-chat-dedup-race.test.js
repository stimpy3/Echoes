// Fix for audit finding BE-016 (surfaced while verifying BE-009's fix): the socket
// sendMessage handler's find-or-create for a brand-new conversation was a plain
// findOne-then-create with no protection against two concurrent first-messages between
// the same two users — both could read "no Chat yet" before either finished creating
// one, splitting a single conversation's history across two separate Chat documents,
// each with its own independent unreadCount/lastMessage.
//
// The fix: Chat.findOrCreateForPair (models/chat.js), an atomic upsert backed by a
// unique index on a deterministic pairKey. This suite fires the very first messages
// between two users from BOTH sides at once — genuinely concurrent, no existing chatId
// on either request — and proves only one Chat document ever results.

const fs = require('fs');
const path = require('path');
const os = require('os');
const request = require('supertest');
const mongoose = require('mongoose');
const { io: ioClient } = require('socket.io-client');
const { flushRateLimits } = require('./helpers/flushRateLimits');

const STATE_FILE = path.join(os.tmpdir(), 'echoes-test-state.json');
const { baseURL, mongoUri } = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));

let Chat;

beforeAll(async () => {
  await mongoose.connect(mongoUri);
  Chat = require('../models/chat');
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
  return `be016-${tag}-${Date.now()}-${seq}@example.test`;
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

function connectSocket(cookie) {
  return new Promise((resolve, reject) => {
    const socket = ioClient(baseURL, {
      transports: ['websocket'],
      extraHeaders: { Cookie: cookie },
    });
    socket.on('connect', () => resolve(socket));
    socket.on('connect_error', reject);
  });
}

function emitSendMessage(socket, { receiverId, message }) {
  return new Promise((resolve, reject) => {
    socket.timeout(8000).emit('sendMessage', { receiverId, message }, (err, response) => (
      err ? reject(err) : resolve(response)
    ));
  });
}

describe('BE-016 fix — concurrent first-messages between two users never split into two Chats', () => {
  beforeEach(flushRateLimits);

  test('firing both sides\' very first message at once still ends in exactly one Chat document', async () => {
    const userA = await createUser('BE016 UserA');
    const userB = await createUser('BE016 UserB');
    const socketA = await connectSocket(userA.cookie);
    const socketB = await connectSocket(userB.cookie);

    try {
      // Neither side has a chatId yet — this is the exact scenario that used to race:
      // both requests hitting the find-or-create path for the same pair at once.
      const [ackA, ackB] = await Promise.all([
        emitSendMessage(socketA, { receiverId: userB.id, message: 'BE-016 from A' }),
        emitSendMessage(socketB, { receiverId: userA.id, message: 'BE-016 from B' }),
      ]);

      expect(ackA.success).toBe(true);
      expect(ackB.success).toBe(true);

      // Both messages must have landed in the SAME chat, not two different ones.
      expect(ackA.message.chatId).toBe(ackB.message.chatId);

      const chats = await Chat.find({ participants: { $all: [userA.id, userB.id] } });
      expect(chats.length).toBe(1);
    } finally {
      socketA.disconnect();
      socketB.disconnect();
    }
  });

  test('a single, non-concurrent conversation start is unaffected (no regression)', async () => {
    const userA = await createUser('BE016 SoloA');
    const userB = await createUser('BE016 SoloB');
    const socketA = await connectSocket(userA.cookie);

    try {
      const ack1 = await emitSendMessage(socketA, { receiverId: userB.id, message: 'first' });
      const ack2 = await emitSendMessage(socketA, { receiverId: userB.id, message: 'second' });

      expect(ack1.success).toBe(true);
      expect(ack2.success).toBe(true);
      expect(ack1.message.chatId).toBe(ack2.message.chatId);

      const chats = await Chat.find({ participants: { $all: [userA.id, userB.id] } });
      expect(chats.length).toBe(1);
    } finally {
      socketA.disconnect();
    }
  });
});
