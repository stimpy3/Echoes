# Implement next

The README's §5.3 "Message flow" and the code it describes are no longer out of sync —
the last discrepancy between them (persist-then-emit) closed on 2026-08-19. See Stale notes.

## Backlog (README already lists these as open — no discrepancy)

- Wrap the Message-insert + Chat-counter-update in a Mongo session transaction
- k-means++ seeding so Explore results stop shifting between identical requests
- Persist per-user cluster profiles instead of clustering on every Explore request —
  `utils/cache.js` (Redis cache-aside) is now the mechanism this would use; see the README's
  §3 Redis section and `FUTURE_SCOPE.md`'s recsys scalability note. Not built yet, just unblocked.
- Cloudinary transformations on upload: `quality: auto`, `fetch_format: auto`, max-width cap
- Pagination on Explore
- Rate limiting on upload routes (auth routes are done — see Stale notes below)
- Token revocation (refresh-token pair or denylist)
- Tests — there are none
- CI — no `.github/workflows` exists; nothing runs automatically on push
- Backfill embeddings for old memories via batch job — the queue to do this with now
  exists (see Stale notes below), the actual backfill script doesn't
- Migrate the remaining `console.error` calls to `req.log.error` — done for `memoryRoutes.js`,
  `authRoutes.js`, and `messageRoutes.js` (picked up as part of the persist-then-emit fix
  below) plus the shared utils (see Stale notes below), **not yet done** for `chatRoutes.js`,
  `followRequestRoutes.js`, `locationRoutes.js`, `userRoutes.js`, `analyticsRoutes.js`. Same
  mechanical pattern in each — `console.error(err)` → `req.log.error({ err }, 'message')` —
  just not swept yet.
- `server/update_routes.js` — a one-off script (string-patches `memoryRoutes.js`'s Explore
  route by marker text) found while auditing `console.*` calls. Not required by anything in
  the running app (verified: nothing `require()`s it). Left alone, unaudited — noted here so
  it doesn't look like an overlooked file next time someone greps for `console.log`.

## Stale notes (already done, kept for history)

- ~~Make chat persist-then-emit~~ 🟠 — done. Was a dual write: `ChatSectionPage.jsx` fired
  `socket.emit("sendMessage")` and `axios.post('/api/messages/sendmessage')` in parallel,
  and the socket handler never touched Mongo — it broadcast a message with a faked `_id`
  (`Date.now()`) regardless of whether the parallel REST write actually succeeded. If it
  failed, the recipient had already seen a message that didn't exist, which vanished on
  refresh. Fixed by moving persistence (find-or-create `Chat`, create `Message`, update
  `lastMessage`/`unreadCount` — same logic the REST route had) into `socket/index.js`'s
  `sendMessage` handler itself, run and awaited *before* anything is emitted, carrying the
  real `_id`/`createdAt`. `POST /api/messages/sendmessage` is removed from
  `routes/messageRoutes.js` — leaving it mounted would have recreated the same race through
  a second caller; the file keeps only the GET history route.

  Two things worth knowing about the fix itself:
  - The client no longer fires a bare `socket.emit` — it's `socket.timeout(8000).emit(...)`
    with an ack callback, so the *originating* tab (which never receives its own broadcast —
    `socket.to()` deliberately excludes the sender) learns the real message details, or that
    the send failed/timed out, and reconciles or rolls back its optimistic bubble accordingly.
  - Fixed a second bug as a side effect: `chatId` can legitimately be `null` for a brand-new
    conversation (confirmed via `chatRoutes.js`'s `mark-read` route). The old handler required
    it truthy and silently dropped the message otherwise — a conversation's *first* message
    never broadcast live, only the parallel REST call saved it, so the recipient only saw it
    on next refresh. The handler now falls back to a participants-based `Chat` lookup (and
    creates one if that finds nothing too) when no `chatId` is given.
- ~~Missing indexes: `Memory.userId`, `Memory.createdAt`, `Memory.likes`, `Message.chatId`~~ —
  done, but as **two compound indexes**, not four separate single-field ones: every real
  query in this app filters on `userId` or `likes` AND sorts by `createdAt` together
  (`find({userId}).sort({createdAt:-1})` in `fetchmemory`, Explore's own-memories pull, and
  `GET /memory/user/:id`; `find({likes}).sort({createdAt:-1})` in Explore's liked-memories
  pull) — a compound index serves both parts of that query in one index, where separate
  single-field indexes would each only cover half of it. `{userId:1, createdAt:-1}` and
  `{likes:1, createdAt:-1}` on `Memory` (`models/memories.js`), `{chatId:1, createdAt:1}`
  on `Message` (`models/message.js`, matching `messageRoutes.js`'s actual query direction).
  The `likes` index is the one that mattered most: `Memory.find({ likes: currentUserId })`
  in the `/explore` route was a full collection scan on every single Explore page load.
- ~~Rate limiter doesn't fail open~~ — done. `middleware/rateLimiter.js` had no protection
  against a Redis error during the store's `increment()` call — verified against
  `express-rate-limit`'s own source that this re-throws by default, and with no global
  Express error handler in this app, a Redis blip would have taken down login/signup
  entirely rather than degrade. `passOnStoreError: true` fixes it, matching the fail-open
  principle `utils/cache.js` already followed. Also passes the app's pino `logger` through
  so a store failure logs structured, not to `console`.

- ~~Structured logging + request id~~ — done for the highest-value surfaces. `pino` +
  `pino-http` wired in `server/index.js` as the first middleware (before CORS) — every
  request gets an id, attached as `req.log`, a child logger that carries that id on every
  field it logs. `memoryRoutes.js` (all catch blocks, plus the Explore route's ~15
  diagnostic lines converted from string-interpolated `console.log` to structured fields —
  e.g. `{ streamAContentCount, fallbackReason }` instead of a formatted sentence, so they're
  individually queryable) and `authRoutes.js` (including two catch blocks — signup and
  login — that had **no** server-side logging at all before this; a failed login produced
  zero trace anywhere). `utils/cache.js`'s `getOrSetCache`/`invalidateCache` now accept an
  optional logger param so a cache miss inside a request logs under *that* request's id
  (see `userRoutes.js`'s `GET /:id`) rather than anonymously. Files with no request context
  (`index.js` boot messages, `embeddingHelper.js`, `redisClient.js`, `embeddingWorker.js`)
  use the base logger or a `.child({ component: '...' })` of it. Not done: the six route
  files listed above.
- ~~Job queue for embedding generation~~ — done. `server/queues/embeddingQueue.js` (BullMQ,
  Redis-backed) replaces the in-process fire-and-forget call in `creatememory`/`editmemory`;
  `server/workers/embeddingWorker.js` consumes jobs, currently in the same process as the API
  (see the README's §3 Redis section for why that's a deliberate single-instance choice, not
  an oversight). Retries are BullMQ's now (4 attempts, exponential backoff) — the old
  `generateEmbeddingWithRetry` internal loop is no longer used for this path, though the
  function itself is unchanged and still backs Explore's search-query embedding, which needs
  a same-request answer and was never a candidate for queueing.
- ~~Redis adapter for Socket.IO presence~~ — done, and the fix wasn't only "add the adapter."
  `onlineUsers` (an in-process object) was replaced with Socket.IO rooms (`socket.join(userId)`
  in `socket/index.js`) — rooms are adapter-aware, a plain JS object never was, so the adapter
  alone would not have fixed cross-instance delivery. `@socket.io/redis-adapter` is wired in
  `server/index.js`. See the README's §3 Redis section for the full "why."
- ~~Rate limiting on auth routes~~ — done. `express-rate-limit` + `rate-limit-redis` on
  `/login` (10/15min), `/signup` (5/hour), `/google` (30/15min) — see `middleware/rateLimiter.js`.
  Upload routes are still unlimited, tracked above.
- ~~Authenticate the Socket.IO handshake~~ 🔴 — done. `io.use()` in `server/index.js` parses the
  `token` cookie off `socket.handshake.headers.cookie`, verifies the JWT, and sets `socket.userId`;
  bad/missing token is rejected with `next(new Error('unauthorized'))`. `socket/index.js` reads
  `socket.userId` instead of the forgeable `handshake.auth.userId`. Client no longer sends an auth
  payload, and `Navbar.jsx` now calls `socket.disconnect()` on logout so a socket cannot outlive
  the session that authenticated it.
- ~~add hashing to password later~~ — bcryptjs `genSalt(10)` + `hash` is in `authRoutes.js`
- ~~sessions and cookies~~ — JWT in an httpOnly cookie, `middleware/verifyToken.js`
- `docs/memory-model.md` is out of date — predates `category`, `embedding`, `likes`, `comments`
