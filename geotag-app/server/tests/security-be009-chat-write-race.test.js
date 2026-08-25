// Fix for audit finding BE-009: the Socket.IO sendMessage handler (server/socket/
// index.js) persisted the Message, then updated the Chat's lastMessage/unreadCount via
// a classic read-modify-write (fetch the Chat, mutate the in-memory doc, .save()) — the
// exact shape of race BE-005 already fixed elsewhere in this codebase. Two messages
// sent into the SAME chat at nearly the same instant (a realistic scenario: someone
// double-tapping send, or messages from two different chats/tabs landing close
// together) could both read the same starting unreadCount, both compute their own
// +1 independently, and the second .save() would silently clobber the first — losing
// an unread-count increment with no error anywhere.
//
// The fix replaced that with a single atomic findByIdAndUpdate using $inc, which
// can't lose a concurrent increment the same way. This suite fires several sendMessage
// events at the SAME chat concurrently (Promise.all, not sequential awaits — the
// entire point) and proves the final unreadCount reflects every single one of them.
//
// It also separately proves the failure-isolation half of BE-009: a message is only
// ever reported successful once it's actually durably saved, which the ack response
// (carrying the real persisted _id) already demonstrates on every call below.

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
  return `be009-${tag}-${Date.now()}-${seq}@example.test`;
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

describe('BE-009 fix — concurrent messages into the same chat never lose an unreadCount increment', () => {
  beforeEach(flushRateLimits); // this file signs up two users per test.

  test('firing several sends at once, every single one is reflected in the final unread count', async () => {
    const userA = await createUser('BE009 SenderA');
    const userB = await createUser('BE009 ReceiverB');
    const socketA = await connectSocket(userA.cookie);

    try {
      // Establish the Chat document first, sequentially, and pin every concurrent send
      // below to its real chatId. The find-or-create path (no chatId given) has its
      // own separate, NOT-yet-fixed race — concurrent first messages between two users
      // can each fail to find the other's brand-new Chat and create their own — which
      // is a different bug than the one this test targets (losing an unreadCount
      // increment via a non-atomic update to an ALREADY-existing Chat). Isolating that
      // here keeps this test proving exactly the fix it's named for.
      const firstAck = await emitSendMessage(socketA, { receiverId: userB.id, message: 'BE-009 setup message' });
      expect(firstAck.success).toBe(true);
      const chatId = firstAck.message.chatId;

      const MESSAGE_COUNT = 10;
      const acks = await Promise.all(
        Array.from({ length: MESSAGE_COUNT }, (_, i) => (
          emitSendMessage(socketA, { chatId, receiverId: userB.id, message: `BE-009 concurrent message ${i}` })
        ))
      );

      // Every send must have actually succeeded and carried a real persisted _id —
      // this is the failure-isolation guarantee: a reported success always means a
      // real, durable message.
      for (const ack of acks) {
        expect(ack.success).toBe(true);
        expect(ack.message._id).toBeTruthy();
      }
      const distinctIds = new Set(acks.map((a) => a.message._id));
      expect(distinctIds.size).toBe(MESSAGE_COUNT); // no accidental duplicate/reused ids.

      const chatsRes = await request(baseURL).get('/api/chats/mychats').set('Cookie', userB.cookie);
      expect(chatsRes.status).toBe(200);
      const chat = chatsRes.body.find((c) => c.participants.some((p) => p._id === userA.id));
      expect(chat).toBeTruthy();

      // The property the old read-modify-write could lose: every one of the N
      // concurrent increments must actually be reflected, not just "some of them" —
      // plus the one sequential setup message above.
      expect(chat.unreadCount[userB.id]).toBe(MESSAGE_COUNT + 1);
    } finally {
      socketA.disconnect();
    }
  });
});
