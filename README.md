# Echoes — Geotagged Memories

> Capture a moment, pin it to the place it happened, and relive it on a map and a timeline.

Echoes is a full-stack social journaling app built around one idea: **a memory is not just a photo — it's a photo attached to a place and a moment in time.** Every post ("memory") carries a title, description, image, category, and a GPS coordinate. Those coordinates turn the whole app into something a normal feed can't be: a personal world map, a scrubbable timeline, a proximity-aware discovery engine.

On top of that core the app layers a social graph (follow / follow-requests / public-private accounts), real-time 1:1 chat, an analytics dashboard, and an **Explore** feed powered by a locally-run sentence-embedding model and k-means clustering of your own interaction history.

**Live:** frontend on Vercel — `https://echoes-nine-kappa.vercel.app` · API on Render — `https://echoes-vmc2.onrender.com`

---

## Table of contents

1. [Why this project exists](#1-why-this-project-exists)
2. [Tech stack & why each piece](#2-tech-stack--why-each-piece)
3. [Architecture](#3-architecture)
4. [Running it locally](#4-running-it-locally)
5. [Feature deep-dives](#5-feature-deep-dives)
   - [5.1 Memories & the map](#51-memories--the-map)
   - [5.2 The recommendation engine (Explore)](#52-the-recommendation-engine-explore)
   - [5.3 Real-time chat](#53-real-time-chat)
   - [5.4 Social graph & privacy](#54-social-graph--privacy)
   - [5.5 Timeline with map scrubber](#55-timeline-with-map-scrubber)
6. [Data model & why MongoDB](#6-data-model--why-mongodb)
7. [Media pipeline & why Cloudinary](#7-media-pipeline--why-cloudinary)
8. [Auth & security](#8-auth--security)
9. [Performance decisions](#9-performance-decisions)
10. [Known limitations & roadmap](#10-known-limitations--roadmap)
11. [Interview cheat sheet](#11-interview-cheat-sheet)

---

## 1. Why this project exists

Most photo-sharing apps treat location as metadata — a small grey line under the caption. Echoes inverts that: **location and time are first-class dimensions of the content**, which unlocks three things a chronological feed can't do:

| Problem with a plain feed | What Echoes does instead |
| --- | --- |
| Old posts are unreachable — you scroll forever | **Map view**: every memory is a pin; you navigate by place, not by scroll depth |
| No sense of "when" beyond a timestamp | **Timeline scrubber**: drag a time ruler and watch pins appear month by month, like playing back your own history |
| Discovery is either "people you follow" or a global algorithmic firehose | **Hybrid Explore**: blends semantic similarity to *your* interests with geographic proximity to places you actually go |

The secondary goal was engineering-driven: build a recommendation system end-to-end **without paying for anything** — no OpenAI embeddings API, no Pinecone, no paid CDN. Everything runs on free tiers or locally in-process (see [§5.2](#52-the-recommendation-engine-explore) and [§7](#7-media-pipeline--why-cloudinary)).

---

## 2. Tech stack & why each piece

### Frontend — `geotag-app/client`

| Tech | Why |
| --- | --- |
| **React 19 + Vite 7** | Vite's dev server uses native ESM, so HMR is near-instant compared to a Webpack/CRA setup. React 19 for the app's component model. |
| **React Router v7** | Client-side routing; the app is an SPA so page transitions don't round-trip the server. |
| **Tailwind CSS 3** (+ `tailwind-merge`, `class-variance-authority`) | Utility-first styling keeps the design consistent without a growing CSS file. `tailwind-merge` resolves class conflicts when composing variants. |
| **Leaflet + React-Leaflet 5** | Open-source map rendering. **Why not Google Maps?** Google Maps JS API requires a billing-enabled key and meters map loads. Leaflet is free, and tiles come from CARTO's free basemap service. |
| **Socket.IO client** | Real-time chat transport (see [§5.3](#53-real-time-chat)). |
| **Recharts / @nivo/circle-packing / d3** | Analytics dashboard visualizations. |
| **GSAP + Lottie** | Marker enter/exit animations on the timeline map, and loading animations. |
| **@react-oauth/google** | Google Sign-In button + ID-token retrieval. |

### Backend — `geotag-app/server`

| Tech | Why |
| --- | --- |
| **Node.js + Express 5** | Same language as the frontend (one mental model, shared JSON handling). Express is unopinionated — right for an API this size. |
| **MongoDB Atlas + Mongoose 8** | See [§6](#6-data-model--why-mongodb) for the full rationale. Short version: geospatial queries + vector search + flexible documents in one database. |
| **Socket.IO 4** | WebSockets with automatic transport fallback (see [§5.3](#53-real-time-chat)). |
| **@huggingface/transformers** (Transformers.js) | Runs `all-MiniLM-L6-v2` **locally in the Node process via ONNX** — zero API cost, zero network latency, no rate limits. |
| **jsonwebtoken + bcryptjs** | Stateless auth in an httpOnly cookie; bcrypt for password hashing. |
| **google-auth-library** | Server-side verification of Google ID tokens (never trust the client's claim). |
| **multer + multer-storage-cloudinary** | Streams uploads straight to Cloudinary — the image never touches the API server's disk. |
| **ioredis + @socket.io/redis-adapter + BullMQ** | Shared Redis backs three unrelated jobs — see [§3](#3-architecture)'s dedicated Redis section for the full "why," including why it's kept despite running as a single instance today. |
| **express-rate-limit + rate-limit-redis** | Per-IP request caps on auth endpoints, Redis-backed so the limit is real across more than one instance (see [§8](#8-auth--security)). |
| **pino + pino-http** | Structured (JSON) logging with one auto-generated id per request, attached as `req.log` — every log line in a request's lifecycle shares that id, so a slow or failing request is traceable end to end instead of being a pile of unconnected `console.log` lines. |

**Language note:** the codebase is plain JavaScript (JSX on the client, CommonJS on the server) — not TypeScript.

---

## 3. Architecture

```
┌──────────────────────────────┐
│  React SPA (Vercel)          │
│  ├─ pages/  Home, Explore,   │
│  │          Timeline, Chat,  │
│  │          Profile,Analytics│
│  ├─ Leaflet map components   │
│  └─ socket.io-client         │
└───────┬──────────────┬───────┘
        │ HTTPS        │ WebSocket
        │ (axios,      │ (upgrade, falls back
        │  cookies)    │  to HTTP long-polling)
┌───────▼──────────────▼───────┐
│  Express 5 API (Render)      │
│  ├─ routes/    REST endpoints│
│  ├─ middleware/ verifyToken, │
│  │              rateLimiter  │
│  ├─ socket/     room relay + │
│  │              typing       │
│  │              (Redis)      │
│  └─ utils/embeddingHelper    │
│       └── MiniLM (in-process)│
└───┬──────────────────────┬───┘
    │                      │
┌───▼──────────────┐  ┌────▼─────────┐
│ MongoDB Atlas    │  │  Cloudinary  │
│ ├ 2dsphere index │  │  (images)    │
│ └ vector_index   │  └──────────────┘
└──────────────────┘
```

Two things worth noticing in that diagram:

- **The ML model lives inside the API process.** There is no separate Python service, no model server, no vector database. `Xenova/all-MiniLM-L6-v2` is loaded once at boot (`utils/embeddingHelper.js:172-177`) and reused for every request. This is only viable because MiniLM is tiny (~22M params, 384-dim output) and quantized ONNX inference on CPU takes tens of milliseconds.
- **Vector search happens in MongoDB, not in Node.** Embeddings are stored on the `Memory` document and queried through Atlas `$vectorSearch`. No second datastore to keep in sync.

### Redis — one shared store, three unrelated jobs

Added after the diagram above was first drawn, so it's called out separately here rather
than redrawn into it. Redis sits alongside MongoDB and Cloudinary as a third datastore:

```
                    REDIS
                      │
       ┌──────────────┼──────────────┐
       ▼              ▼              ▼
   Socket.IO        Cache         Rate limit
```

- **Socket.IO coordination** (`@socket.io/redis-adapter`, wired in `index.js`) — every
  socket joins a room named after its own user id. The adapter makes `io.to(userId)`
  reach that user's sockets regardless of which server instance answered *this* request.
  This replaced a plain in-process `onlineUsers` object that could only ever see sockets
  connected to the same instance — with more than one instance behind a load balancer, a
  message from a user on instance A would silently never reach a recipient on instance B.
  Adding the adapter alone would not have fixed that; the bug was in *where presence was
  tracked*, not in how events were transported, so the fix was moving presence into
  Socket.IO rooms (adapter-aware) rather than a local object (not).
- **Cache** (`utils/cache.js`, cache-aside) — `GET /api/users/:id` is the first thing
  cached: hit on every profile view, memory card, and follower list. 5 min TTL,
  invalidated explicitly on the one write that changes it (`PATCH /user/privacy`). Same
  mechanism the recommendation engine's materialized user-profile cache will reuse (see
  `RecommnedationSystem.md`'s "Suggested Next Improvements").
- **Rate limit counters** (`express-rate-limit` + `rate-limit-redis`) — login, signup,
  and Google auth are capped per IP (see §8 for the current numbers). Backed by Redis for
  the same reason the socket state is: an in-memory counter only sees requests that
  landed on this instance, so it silently doubles the real limit the moment there's more
  than one server answering traffic.

**Why it's safe to lose:** nothing in Redis is the source of truth for anything. A cache
miss just costs one extra Mongo read; an emptied rate-limit counter briefly under-limits;
lost Socket.IO coordination state only matters while sockets are actively connected and
self-heals as they reconnect. If Redis is unreachable, the cache helper (`utils/cache.js`)
fails open — callers still get a correct answer, just without the speedup, rather than an
error. Losing it costs latency, never correctness.

**Why the Socket.IO adapter is here at all, deployed as a single Render instance.**
Fair question — cache and rate limiting pay for themselves regardless of instance count,
but the adapter's entire reason to exist is cross-instance delivery, which a single
instance doesn't need; the default in-memory Socket.IO adapter is already correct there.
Kept anyway, deliberately, for one reason: Render's horizontal scaling is a checkbox on
a paid plan, not a redeploy — the day someone flips it on, an app *without* the adapter
doesn't error, it just silently drops messages between instances, which is a far worse
failure mode to debug in production than a few extra milliseconds per emit today. The
marginal cost of keeping it is close to zero — Redis is already a hard dependency for the
other two jobs, so this adds two more connections and a pub/sub round-trip, not a new
service. If this app were guaranteed to stay single-instance forever, the honest call
would be to cut it; "might scale out" is a real enough possibility here to keep it.

### Repository layout

```
geotag-app/
├── client/                       # React 19 + Vite SPA
│   ├── src/pages/                # route-level pages
│   ├── src/components/           # Map/, Memories/, Layout/, Charts/
│   ├── src/context/              # ThemeContext, HomeContext
│   └── src/utils/socket.js       # singleton Socket.IO client
├── server/
│   ├── index.js                  # bootstrap: CORS allowlist, Mongo+Redis connect, routes, http+io server
│   ├── routes/                   # auth, memory, user, follow, chat, message, analytics, navbar, location
│   ├── models/                   # users, memories, chat, message, follower, followRequest
│   ├── middleware/               # verifyToken.js, cloudinaryConfig.js, rateLimiter.js
│   ├── socket/index.js           # room-based relay + typing (Redis adapter, see §3)
│   ├── queues/embeddingQueue.js  # BullMQ producer — enqueues embedding jobs
│   ├── workers/embeddingWorker.js # BullMQ consumer — runs in-process (see §3)
│   └── utils/
│       ├── embeddingHelper.js    # MiniLM embeddings + custom k-means + cosine similarity
│       ├── redisClient.js        # shared ioredis connection
│       ├── cache.js              # generic cache-aside helper (fails open if Redis is down)
│       └── logger.js             # base pino instance (req.log is a per-request child of this)
├── docs/                         # design notes (partly stale — schema has drifted)
└── RecommnedationSystem.md       # authoritative spec for the Explore engine
```

---

## 4. Running it locally

### Prerequisites

- Node.js 18+
- A **MongoDB Atlas** cluster — *not* a local `mongod`. Explore depends on an Atlas Search **vector index** (`$vectorSearch`), which self-hosted community MongoDB does not provide.
- A free Cloudinary account
- A Google OAuth 2.0 Client ID

### Atlas vector index (required, and not created by code)

Mongoose can declare normal indexes but **cannot** create an Atlas Search index. Create it manually in the Atlas UI on the `memories` collection, named exactly `vector_index`:

```json
{
  "fields": [
    {
      "type": "vector",
      "path": "embedding",
      "numDimensions": 384,
      "similarity": "cosine"
    }
  ]
}
```

If this index is missing, Explore still works — `$vectorSearch` throws, the error is caught, and the feed degrades to the geo stream and the fallback ladder ([§5.2](#52-the-recommendation-engine-explore)).

### Environment variables

`geotag-app/server/.env`:

```
MONGO_URI=
JWT_SECRET=
PORT=5000
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
GOOGLE_CLIENT_ID=
NODE_ENV=development
```

`geotag-app/client/.env`:

```
VITE_BASE_URL=http://localhost:5000
VITE_GOOGLE_CLIENT_ID=
```

### Start

```bash
# terminal 1 — API
cd geotag-app/server
npm install
node index.js        # no dev script defined; add nodemon yourself if you want reload

# terminal 2 — client
cd geotag-app/client
npm install
npm run dev
```

First boot downloads the MiniLM weights (~25 MB) into the Transformers.js cache; you'll see `✅ AI Embedding Model loaded and ready!` when it's warm.

---

## 5. Feature deep-dives

### 5.1 Memories & the map

A memory is created via `POST /api/memory/creatememory` as `multipart/form-data`: text fields plus one image. Multer streams the file to Cloudinary and hands back the hosted URL; the document stores only that URL.

Location is stored as **GeoJSON**, not two loose numbers:

```js
location: {
  type: { type: String, enum: ['Point'], default: 'Point', required: true },
  coordinates: { type: [Number], required: true },  // [lng, lat] — note the order
  address:     { type: String, required: true }
}
```

`memorySchema.index({ location: '2dsphere' })` makes this queryable. **Why 2dsphere specifically:** a normal B-tree index sorts scalars; it has no concept of "within 50 km." A 2dsphere index understands spherical (Earth) geometry, so `$geoNear` / `$near` / `$geoWithin` can answer distance queries by index rather than by scanning and computing haversine on every document.

> **Gotcha worth knowing for interviews:** GeoJSON coordinates are `[longitude, latitude]` — the reverse of how humans say it, and the reverse of what Leaflet's `LatLng` expects. Getting this backwards silently puts every pin in the wrong hemisphere.

### 5.2 The recommendation engine (Explore)

This is the most substantial system in the project. Endpoint: `GET /api/memory/explore` (`server/routes/memoryRoutes.js:513-829`). Spec doc: `RecommnedationSystem.md`.

#### The problem

Given a user with a handful of posts and likes, and a corpus of other users' memories, produce a feed that feels personal — **without** collaborative filtering (there aren't enough users for that to work), **without** a paid embeddings API, and **without** a separate vector database.

#### Step 1 — Turn text into vectors

Every memory's `title + description` is embedded into a **384-dimensional vector** by `Xenova/all-MiniLM-L6-v2` running in-process:

```js
const output = await pipe(text, { pooling: 'mean', normalize: true });
return Array.from(output.data);
```

- **Why sentence embeddings and not keyword search?** "Sunset over the harbour" and "golden hour by the docks" share zero keywords but are semantically near-identical. Lexical search can't see that; an embedding can.
- **Why MiniLM-L6-v2?** It's the standard quality/size sweet spot for semantic similarity: 6 transformer layers, ~22M params, 384 dims. Small enough to run on a free Render instance, good enough to cluster meaningfully.
- **Why mean pooling + L2 normalization?** Mean pooling collapses per-token vectors into one sentence vector. Normalizing to unit length means **cosine similarity reduces to a dot product**, which is both cheaper and what Atlas's cosine similarity metric expects.
- **Why store `embedding` with `select: false`?** A 384-float array is ~3 KB of JSON per memory. Ordinary reads (profile grid, feed, timeline) never need it, so it's excluded by default and pulled in explicitly with `.select('+embedding')` only where clustering happens. This keeps normal API payloads small.

Embeddings are generated **asynchronously after the write responds**, via a BullMQ job
queued right after `res.json()` in `memoryRoutes.js` (`creatememory` and `editmemory`) and
processed by `server/workers/embeddingWorker.js`. The user's "create memory" request is
never blocked on model inference. Trade-off: a brand-new memory is briefly un-recommendable
— accepted, because a slow POST is much more visible than a few seconds of recommendation
lag. This used to be a raw fire-and-forget async call with its own hand-rolled retry loop
(`generateEmbeddingWithRetry`); moved to a queue so a job survives a server restart mid-
generation instead of silently vanishing, and so retries are BullMQ's job (4 attempts,
exponential backoff) rather than nested inside the function that also gets retried by the
queue. `generateEmbeddingWithRetry` still exists and is still used — for Explore's search-
query embedding ([§5.2](#52-the-recommendation-engine-explore)), which needs an answer in
the same request and has no job to queue it as.

#### Step 2 — Cluster the user's history with k-means

Rather than averaging all of a user's interactions into a single "taste vector," the engine clusters them. `kMeansCluster()` in `utils/embeddingHelper.js:110-170` is a hand-written implementation:

```
1. Pick k distinct random embeddings as initial centroids
2. Assign each embedding to the centroid with highest COSINE SIMILARITY
3. Recompute each centroid as the mean of its members, then re-normalize
4. Repeat until assignments stop changing, or 10 iterations
```

**Why k-means at all?**

A single averaged vector destroys multi-interest users. If someone posts mountain hikes *and* street food, the mean of those embeddings lands in an empty region of vector space that represents neither — and the feed returns bland, irrelevant results. Clustering preserves the modes instead of collapsing them: each centroid is a coherent "interest" the user actually has.

**Why k-means and not something else?**

| Alternative | Why not here |
| --- | --- |
| **DBSCAN / HDBSCAN** | Density-based, needs an `eps` parameter that's hard to tune in 384-d where distances concentrate; also discards points as noise, and with 5–30 interactions we can't afford to throw data away. |
| **Hierarchical / agglomerative** | O(n²)–O(n³); fine at this scale but gives a dendrogram we'd still have to cut, and no natural centroid to feed into vector search. |
| **Collaborative filtering (matrix factorization)** | Requires a dense user-item interaction matrix. With a small user base it's a cold-start disaster. Content-based embeddings work from post #1. |
| **Just take the top-N most recent** | That's recency, not taste — it's the fallback tier, not the primary signal. |

k-means wins because it's **O(n·k·d·i)** (trivial for n ≤ 50), it's deterministic to implement, and — critically — **it produces centroids**, which are exactly the query vectors `$vectorSearch` needs. The output of the algorithm plugs directly into the next stage.

**Why cosine similarity instead of Euclidean distance?** Text embeddings encode meaning in *direction*, not magnitude. Two vectors pointing the same way describe the same topic regardless of length. Since vectors are already L2-normalized, cosine and Euclidean actually rank identically here — but cosine is the semantically honest metric and matches the Atlas index configuration.

**Adaptive `k`** (`memoryRoutes.js:113-119`) — a fixed `k=3` is wrong for a user with 4 posts *and* wrong for one with 40:

| Interaction embeddings | k |
| --- | --- |
| ≥ 30 | 5 |
| ≥ 18 | 4 |
| ≥ 8 | 3 |
| ≥ 3 | 2 |
| otherwise | 1 |

Guard: `if (embeddings.length <= k) return embeddings` — with fewer points than clusters, every point *is* its own centroid.

**Picking the "active mood."** Multiple centroids means multiple candidate query vectors. The engine picks one by averaging the **5 most recent** interaction embeddings into a recency profile, then selecting the centroid with the highest cosine similarity to it (`memoryRoutes.js:596-612`). So the feed follows what you're into *right now*, while still drawing from a stable long-term cluster rather than raw recent noise.

#### Step 3 — Two streams, blended

| | Stream A — "Mood Market" | Stream B — "Local Explorer" |
| --- | --- | --- |
| Signal | Semantic | Geographic |
| Query | `$vectorSearch` on `vector_index`, `numCandidates: 100`, `limit: 30`, queryVector = active-mood centroid | `$geoNear` within `maxDistance: 50000` (50 km) of the most recent interaction that has coordinates |
| Answers | "posts about things you like" | "posts from where you actually are" |

`numCandidates: 100` vs `limit: 30` is the ANN recall knob: Atlas explores 100 approximate neighbours and returns the best 30. Higher candidates = better recall, more work.

Both pipelines `$lookup` the author, then apply `buildPrivacyMatch()` **inside the aggregation** — privacy is enforced in the database query, never by filtering in JS afterwards.

**Blending** is round-robin interleaving with de-duplication by `_id` (`memoryRoutes.js:740-753`) — take item 0 from each stream, then item 1 from each, and so on. This is deliberately a **heuristic, not a weighted scorer**: the two streams' scores (cosine similarity vs. metres) aren't on a comparable scale, and inventing a fusion weight without engagement data to tune it would be false precision. A proper weighted ranker is the Phase 2 item ([§10](#10-known-limitations--roadmap)).

**Search mode.** When the user types a query, Stream A's clustering is skipped entirely — the query string itself is embedded and used as the target vector. If vector search fails or returns nothing, a **lexical fallback** kicks in: a regex match on title/description, with regex metacharacters escaped (`escapeRegex`) so a user typing `.*` doesn't cause a ReDoS-flavoured surprise.

#### Step 4 — The fallback ladder (never return an empty feed)

If blending produces zero results, the engine walks down three tiers (`memoryRoutes.js:756-820`), each still privacy-filtered:

1. Recent memories in the selected **category** from eligible authors
2. Recent memories from eligible authors, **category relaxed**
3. Recent **global public** memories

This is what makes the cold-start path acceptable: a brand-new user with no posts and no likes still gets a populated Explore page.

#### Step 5 — Explainability

Every returned memory carries `recommendationReason` (human-readable) and `recommendationSource` (machine tag), attached by `attachReason()` / `buildReasonText()` (`memoryRoutes.js:121-156`). Sources: `semantic_search`, `semantic_profile`, `geo`, `lexical_search`, `fallback_category`, `fallback_recent`, `fallback_public`.

The client renders an "ⓘ" button on each Explore tile that reveals the reason — *"Recommended because it is near places you recently interacted with."* This exists for two reasons: user trust (an unexplained algorithmic feed feels arbitrary), and **debuggability** — when the feed looks wrong, the tags immediately show which stream produced it. The response also carries a `diagnostics` object recording per-stream counts, whether vector search errored, and which fallback tier fired.

---

### 5.3 Real-time chat

#### What a WebSocket is, and why HTTP isn't enough

Plain HTTP is **request/response and client-initiated**: the server has no way to push. To make chat feel live over HTTP you'd have to poll — `GET /messages` every second — which burns a request per second per user whether or not anything happened, and still shows messages up to a second late.

A **WebSocket** starts as a normal HTTP request carrying `Upgrade: websocket`. If the server agrees (`101 Switching Protocols`), the same TCP connection is repurposed into a **full-duplex, persistent** channel: either side can send frames at any time, with a few bytes of framing overhead instead of a full HTTP header block per message. That's what makes sub-100 ms delivery and typing indicators practical.

#### Why Socket.IO instead of raw `ws`

Socket.IO is a protocol *on top of* WebSockets that adds what a production chat needs and raw WebSockets don't provide:

- **Transport fallback.** This is the big one. Corporate proxies, some mobile carriers, and older load balancers still break or strip WebSocket upgrades. Socket.IO's Engine.IO layer detects the failure and transparently falls back to **HTTP long-polling** — the client holds a request open until the server has data, responds, and immediately reissues. Slower and chattier, but the chat *works*. The app relies on this built-in fallback; there is no hand-rolled polling path in application code.
- **Automatic reconnection** with exponential backoff after a network drop or a Render cold start.
- **Heartbeats** (ping/pong) so a half-open connection is detected rather than silently hanging.
- **Event-based API** — `socket.emit("sendMessage", …)` instead of hand-rolling a JSON envelope and a switch statement over `message.type`.

#### Handshake authentication

The socket connection is authenticated the same way every REST route is — the identity is **derived from a verified JWT, never accepted from the client**. An `io.use()` middleware runs before the connection is established: it parses the `token` cookie off the handshake headers, verifies it against `JWT_SECRET`, and attaches the decoded id to the socket. A connection with a missing or invalid token is rejected at the handshake, so it never reaches an event handler.

This matters more than it looks. If the server took `userId` from `socket.handshake.auth` as a client-supplied value, anyone could open a socket claiming to be someone else's id and receive their live messages — a full read compromise of every conversation, invisible in the access logs because it looks like a normal connection. Transport-layer identity has to come from the same trust root as the HTTP layer, or the weaker of the two defines your actual security.

#### Presence tracking

`server/socket/index.js` joins each authenticated socket to a **room named after its own
user id**:

```js
socket.join(userId);
```

That single line replaces what used to be a hand-rolled in-memory map (`onlineUsers = {
userId: [socketId, ...] }`) with manual push-on-connect / filter-on-disconnect bookkeeping.
Socket.IO rooms already solve "one person, three tabs and a phone" — every socket a user
opens joins the same room, so `io.to(userId).emit(...)` reaches all of them, and a
disconnected socket leaves its room automatically with no cleanup code to write or forget.

The reason this changed: rooms are **adapter-aware** (see [§3](#3-architecture)'s Redis
section) and a plain JS object is not. With more than one server instance, an in-memory
map on instance A has no way to know a user is connected to instance B — `io.to()` would
silently reach nobody. `@socket.io/redis-adapter` makes room membership and delivery work
across instances; that only pays off because presence itself now lives in a room the
adapter can see, not in memory the adapter can't.

#### Message flow — server-authoritative, persist-then-emit

```
User A types and hits send
  │
  ├─ optimistic render locally (pending state)
  │
  └─ socket.emit("sendMessage")
        │
        ▼
     server: find-or-create Chat
             insert Message           ◄── single source of truth
             update lastMessage / unreadCount
        │
        ├─► emit "newMessage" to B's sockets   (isOwn: false)
        └─► emit "newMessage" to A's other sockets + ack to A (isOwn: true)
```

The **server owns the write and the broadcast**, in that order. A message is only relayed after it exists in MongoDB, so the real `_id` and `createdAt` go out with the event rather than a client-side placeholder — the id the recipient renders is the id that's actually in the database, which matters for read receipts and for replying to a specific message.

**Why persist before emitting?** The alternative — broadcasting first and writing in parallel — is faster by one database round-trip but has no atomicity: if the write fails, the recipient has already seen a message that doesn't exist and will vanish on refresh. Two users end up with permanently divergent transcripts and nothing detects it. Ordering the write first makes failure honest: nothing is delivered, the sender's optimistic bubble is rolled back, and both clients agree.

**Where the latency went.** The cost is one Mongo insert (single-digit milliseconds on an indexed collection) before fan-out. The perceived cost to the sender is zero, because their own message renders optimistically the instant they hit send and is reconciled against the server's acknowledgement. Consistency was worth more than a few milliseconds on the recipient's side.

#### Typing indicators

`typing` / `stopTyping` events are relayed to the recipient's sockets as `userTyping`, with a 2-second debounce on the client so the indicator doesn't flicker between keystrokes.

---

### 5.4 Social graph & privacy

The follow graph is modelled as an **edge list**, not as arrays embedded on the user document:

```js
// models/follower.js
{ follower: ObjectId(User), following: ObjectId(User) }
followerSchema.index({ follower: 1, following: 1 }, { unique: true });
```

**Why an edge collection instead of `user.following = [ids]`?**

- MongoDB documents have a **16 MB limit**; an unbounded array on a hot document is a growth hazard.
- Repeatedly `$push`-ing into a large array causes document relocation and index churn.
- The compound **unique index** makes duplicate follows impossible at the database level — no read-check-write race where two concurrent requests both see "not following" and both insert.
- Queries work cleanly in both directions (followers *and* following) off the same collection.

**Public vs. private accounts** (`User.isPrivate`, default `false`) changes the follow flow:

- **Public target:** `POST /api/follow/request` creates the `Follower` edge immediately — following is instant.
- **Private target:** a `FollowRequest` document is created instead (its own collection, its own `{sender, receiver}` unique index). It only becomes a `Follower` edge when the recipient calls `POST /api/follow/confirm`, at which point the request is deleted.

Enforcement is layered, which is the point — a privacy feature that's only checked on one route isn't a privacy feature:

| Surface | Enforcement |
| --- | --- |
| Viewing a profile's memories | `GET /api/memory/user/:id` returns **403** for a private account you don't follow |
| Explore feed | `buildPrivacyMatch()` is injected into *every* aggregation pipeline — vector, geo, lexical, and all three fallback tiers |
| Follow status UI | `GET /api/users/status/:userId` never reports a "requested" state for public accounts |

`buildPrivacyMatch` is a single shared function so the rule is defined once:

```js
$match: { $or: [
  { "userDoc._id": { $in: followingIds } },   // you follow them
  { "userDoc.isPrivate": { $ne: true } }      // or they're public
]}
```

Legacy users created before the field existed are lazily backfilled with `isPrivate: false` on profile read.

---

### 5.5 Timeline with map scrubber

`TimelinePage` has a list/map toggle. The map view (`components/Map/TimelineMapView.jsx`) is a custom-built **time scrubber**: a horizontal, draggable ruler of month ticks sits under a Leaflet map, and as the cursor advances, memories with a `createdAt` before the current cutoff are progressively revealed as pins.

Implementation notes: `activeMemories` is derived from `currentCutoffDate`; a separate `renderedMemories` state plus timers keep markers mounted through their exit animation so pins animate *out* instead of popping, and `CustomMarker` was extended with enter/exit animation states and click-through to the post modal. Basemap tiles are CARTO light/dark, switched off the app's `ThemeContext`.

---

## 6. Data model & why MongoDB

### Why MongoDB (and where a relational DB would have been better)

**The honest answer is that one requirement decided it: MongoDB Atlas is the only free-tier database that gives geospatial indexing *and* vector search in the same engine.** Everything else follows from that.

| Reason | Detail |
| --- | --- |
| **Geospatial is native** | `2dsphere` indexes and `$geoNear` are built in. In PostgreSQL this needs the PostGIS extension; in MySQL, spatial support is clunkier. |
| **Vector search is in the same database** | Atlas `$vectorSearch` means embeddings live on the same document as the content. A Postgres equivalent needs `pgvector`; the alternative is a separate vector DB (Pinecone/Weaviate) and a sync problem — two stores that can drift, two failure modes, two bills. |
| **`$geoNear` and `$vectorSearch` compose with the rest of the pipeline** | Privacy filtering, author `$lookup`, and projection all happen in one round trip. |
| **Document shape matches the domain** | A memory *is* a nested object — location sub-document, embedded comments array, likes array. Storing it as one document means one read, no joins. |
| **Schema flexibility during iteration** | `category`, `embedding`, `likes`, `comments`, and `isPrivate` were all added after the initial schema. In SQL each is a migration; here it's a field addition with a lazy backfill. |

**Where SQL would genuinely have been better:** the follow graph (`Follower`, `FollowRequest`) is a textbook join table with foreign keys — Postgres would give real referential integrity and cascading deletes, which Mongoose can't. And the chat write path — insert the `Message`, then update the `Chat`'s `lastMessage` and `unreadCount` ([§5.3](#53-real-time-chat)) — spans two documents, which a relational `BEGIN … COMMIT` would make atomic for free. (Mongo supports multi-document transactions on a replica set, so this is fixable, but it's an explicit opt-in rather than the default.) That's the trade accepted for having geo + vector under one roof.

### Collections

#### `User` — `models/users.js`

| Field | Notes |
| --- | --- |
| `name` | required |
| `email` | required, `unique`, regex-validated |
| `password` | **not required** — Google accounts have no password |
| `profilePic` | Cloudinary URL |
| `googleId` | `null` for password accounts. Stored because Google's `sub` is stable forever, while email can change — matching on `googleId` survives an email change and makes multi-provider auth clean later |
| `home` | `{ lat, lng }` — the user's map home position |
| `isPrivate` | `Boolean`, default `false` |

> `unique: true` is an **index, not a validator** — Mongoose won't catch it pre-save, so duplicate inserts surface as MongoDB error code `11000` and must be handled in the route.

#### `Memory` — `models/memories.js`

| Field | Notes |
| --- | --- |
| `userId` | ref `User`, required |
| `title`, `description` | required; concatenated as the embedding input |
| `category` | enum: Travel, Nature, Food, Events, People, Milestones, Culture, Other |
| `location` | embedded GeoJSON Point + `address` string |
| `photoUrl` | Cloudinary URL |
| `embedding` | `[Number]`, **`select: false`** — 384 floats, excluded from normal reads |
| `likes` | `[ObjectId ref User]` — **embedded array** |
| `comments` | **embedded subdocuments** `{ userId, text, createdAt }` |
| `createdAt` | `Date`, defaults to now |

Indexes: `{ location: '2dsphere' }` in code; `vector_index` on `embedding` created in Atlas.

**Embed vs. reference — the decisions and their reasoning:**

- **Comments are embedded** because they are *always* fetched with their parent memory, never queried independently, and bounded in practice. One read instead of a join. The classic risk is the 16 MB document ceiling — irrelevant at this scale, a real problem for a viral-comments platform, where comments would move to their own collection with `{ memoryId, createdAt }` indexed.
- **Likes are an array of user ids**, not a separate `Like` collection. Cheap toggle (`indexOf` / `splice`), cheap "did I like this" check with no extra query, and the count is `likes.length`. Same unbounded-array caveat — and note there's no unique constraint enforcing one like per user, only application logic.
- **Followers are referenced** (their own collection) precisely because they're *not* bounded and *are* queried independently — the opposite call from comments, for the opposite reasons. Same database, different modelling, driven by access pattern and cardinality.

#### `Chat` / `Message` — `models/chat.js`, `models/message.js`

```js
// Chat
{ participants: [ObjectId ref User],
  lastMessage: String,            // denormalized
  unreadCount: Map<userId, Number>,
  updatedAt: Date }

// Message
{ chatId: ObjectId ref Chat, sender: ObjectId ref User,
  text: String, readBy: [ObjectId ref User], createdAt: Date }
```

Messages are **referenced, not embedded** — unbounded growth, and the chat list needs to render without loading message history. `lastMessage` and `unreadCount` are **denormalized onto `Chat`** so the conversations list renders from N chat documents with zero message queries. That's the read/write trade-off stated plainly: every send does one extra write to keep the list read cheap, because the list is read far more often than messages are sent.

`unreadCount` is a `Map` keyed by user id rather than two scalar fields — it generalizes to group chats without a schema change.

#### `Follower` / `FollowRequest`

Both are thin edge documents with `timestamps: true` and a compound unique index (`{follower, following}` and `{sender, receiver}` respectively). See [§5.4](#54-social-graph--privacy).

### Indexes present, and the ones that are missing

| Index | Status |
| --- | --- |
| `User.email` unique | ✅ |
| `Memory.location` 2dsphere | ✅ |
| `Memory.embedding` → Atlas `vector_index` | ✅ (created manually in Atlas) |
| `Follower {follower, following}` unique | ✅ |
| `FollowRequest {sender, receiver}` unique | ✅ |
| `Memory.userId` | ❌ **missing** — every profile-grid fetch is a collection scan |
| `Memory.createdAt` | ❌ **missing** — every fallback-ladder `$sort: { createdAt: -1 }` sorts in memory |
| `Message.chatId` | ❌ **missing** — loading a conversation scans the collection |

These are the clearest next wins; they're called out rather than hidden because index selection follows from query patterns, and the query patterns here are unambiguous.

---

## 7. Media pipeline & why Cloudinary

### The constraint

Images are the one part of this app that can't live in MongoDB. Atlas's free tier is 512 MB — a few hundred phone photos would exhaust it. And the API server runs on Render's free tier, whose filesystem is **ephemeral**: it's wiped on every deploy and every cold start, so writing uploads to local disk means losing every image on the next restart. Object storage was mandatory.

### Why Cloudinary over S3

| | Cloudinary free tier | AWS S3 |
| --- | --- | --- |
| Cost | 25 credits/month (≈25 GB storage + bandwidth combined), no card required | Free for 12 months, then charged; **billing details required upfront** |
| CDN | Included | Needs CloudFront set up separately |
| Transformations | URL-based, on the fly | Needs Lambda@Edge or a separate image service |
| Setup | Three env vars | IAM policies, bucket policy, CORS config, signed URL logic |

For a portfolio project that must cost **₹0 indefinitely** and stay live for people to visit, Cloudinary's permanent free tier beats a trial that starts billing. It also collapses "storage + CDN + image processing" into one dependency.

### How it's wired

`middleware/cloudinaryConfig.js` composes `multer` with `multer-storage-cloudinary` so the upload **streams straight through the API to Cloudinary** — the file never lands on the server's disk (which, on an ephemeral filesystem, is exactly what you want). The route is just `upload.single('photo')`, and `req.file.path` comes back as the hosted URL.

```js
const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'memories',
    allowed_formats: ['jpg', 'jpeg', 'png'],
    public_id: (req, file) => `memory-${Date.now()}`,
  },
});
```

Free-tier-conscious choices visible here:

- **One fixed folder** (`memories`) — predictable organization, easy to audit or purge.
- **Format allowlist** — `jpg/jpeg/png` only. No video (video burns credits an order of magnitude faster), no SVG (which is an XSS vector when served from your own domain).
- **Signed server-side uploads**, not unsigned client-direct uploads. Unsigned presets are convenient but let anyone who reads your JS bundle upload to your account — the fastest way to burn a free quota. Here, credentials stay on the server and every upload passes through an authenticated route.

### Deletion is explicit, and that's the point

Storage quota only stays under control if deletes actually free space. On memory delete (`memoryRoutes.js:333-360`) and on edit-with-a-new-photo (`:270-292`), the code reconstructs the `public_id` from the stored URL and calls `cloudinary.uploader.destroy()` — so replacing an image doesn't silently orphan the old one forever.

Both calls are wrapped in `try/catch`: **a Cloudinary failure must not block the database operation.** Worst case is an orphaned image (recoverable via a cleanup script); the unacceptable case would be a user unable to delete their own post because a third-party API was down.

**Known gap:** no transformation parameters are configured — images are stored and served at original resolution. Adding `quality: auto`, `fetch_format: auto`, and a max-width transformation on upload would cut both storage and bandwidth substantially. This is the top item on the media-pipeline to-do list.

---

## 8. Auth & security

**Scheme:** JWT in an httpOnly cookie. No session store, no Passport.

```js
jwt.sign({ id: userId }, JWT_SECRET, { expiresIn: '7d' });

res.cookie('token', token, {
  httpOnly: true,
  secure:   process.env.NODE_ENV === 'production',
  sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  maxAge:   7 * 24 * 60 * 60 * 1000,
});
```

Design rationale:

- **Why JWT over server-side sessions?** A signed JWT is verified with a local cryptographic check — no I/O, no lookup. The cost is that tokens can't be revoked before expiry, which is why the TTL is capped at 7 days. (Redis is now a dependency anyway — see [§3](#3-architecture) — but that's a recent addition for caching/rate-limiting/Socket.IO coordination, not a reason to move sessions there; a JWT still costs zero I/O per request against a session lookup that costs one, regardless of which store backs it.)
- **Why httpOnly cookie and not `localStorage`?** A token in `localStorage` is readable by any JavaScript on the page, so a single XSS becomes full account takeover. `httpOnly` makes the cookie invisible to JS entirely.
- **Why `sameSite: 'none'` in production?** The frontend (Vercel) and API (Render) are on different domains, so the cookie is cross-site and must be `SameSite=None; Secure`. In development both are `localhost` and `lax` works. The CORS config uses an explicit origin allowlist with `credentials: true` — a wildcard origin is illegal with credentialed requests, which is the browser enforcing exactly the right thing.
- **Passwords** are hashed with `bcryptjs` — `genSalt(10)` then `hash`. bcrypt is deliberately slow and salted per-user, so rainbow tables are useless and brute-forcing a leaked hash is expensive.
- **Google OAuth** — the client sends a Google **ID token**, and the server verifies it with `OAuth2Client.verifyIdToken()` before trusting anything in it. The client's claim of "I am alice@gmail.com" is never taken at face value; Google's signature is checked server-side. On success the app issues its *own* JWT, so downstream authorization has exactly one code path regardless of how the user signed in.
- **Authorization middleware** — `verifyToken` reads the cookie, verifies it, and sets `req.userId`. It distinguishes **401 (no token)** from **403 (invalid/expired token)**, which lets the client tell "log in" apart from "your session expired." It's applied **per route**, not globally, so public endpoints stay public by explicit choice rather than by accident.
- **Logout** clears the cookie. (With stateless JWTs the token remains cryptographically valid until expiry — the honest limitation of this design; a denylist or short-lived access token + refresh token pair is the fix.)
- **The WebSocket layer shares the same trust root.** An `io.use()` handshake middleware verifies the same JWT cookie and derives the socket's identity from it, so there is no second, weaker authentication path into the system (see [§5.3](#53-real-time-chat)).

**Rate limiting:** `/api/auth/login`, `/signup`, and `/google` are capped per IP via `express-rate-limit` backed by the shared Redis store (see [§3](#3-architecture)) — login 10/15min, signup 5/hour, Google auth 30/15min. Upload endpoints (`/api/memory/creatememory`) are **not** rate limited yet — tracked in [§10](#10-known-limitations--roadmap).

**Remaining gap, stated honestly:** logout can't invalidate an already-issued token before its 7-day expiry — tracked in [§10](#10-known-limitations--roadmap).

---

## 9. Performance decisions

A summary of the deliberate trade-offs, since these are usually what gets probed:

| Decision | Trade-off made |
| --- | --- |
| **Embeddings generated after the response is sent** | Write latency stays low; the memory is briefly un-recommendable. Chose invisible lag over a visibly slow POST. |
| **Model pre-loaded at boot** | ~25 MB of memory held permanently, and slower cold start; but the first user request doesn't pay model-load time. |
| **`select: false` on `embedding`** | ~3 KB × N saved on every list response; the two places that need vectors opt in explicitly. |
| **`lastMessage` / `unreadCount` denormalized on `Chat`** | One extra write per message; the chat list renders with zero message queries. Reads dominate. |
| **Privacy filtering inside aggregation pipelines** | The database does the filtering — no over-fetching then discarding in JS, and no risk of a route forgetting the check. |
| **Chat persists before it broadcasts** | Recipients wait one Mongo insert (~ms) for delivery; in exchange no one ever sees a message that isn't in the database. Optimistic rendering hides the cost from the sender. |
| **k-means computed per request, not cached** | Always fresh, no invalidation logic; costs CPU on every Explore load and makes results non-deterministic across requests. A persisted profile is Phase 2. |
| **Vector + geo in the same database** | One round trip, no sync problem; couples the app to Atlas specifically. |
| **Log pretty-printing gated to non-production** | Colorized output costs CPU to format and produces a harder-to-parse shape for log aggregators; plain JSON lines (pino's default) are what those tools actually want. Local dev keeps the readable version, production gets the cheaper one. |

---

## 10. Known limitations & roadmap

Stated plainly, because knowing what's wrong with your own system is the more useful signal.

**Correctness / security**
- 🟠 **Chat's two-document write isn't transactional** — the `Message` insert and the `Chat` counter update are separate operations; a crash between them leaves `lastMessage` stale. Fix: wrap in a Mongo session transaction.
- 🟡 **No token revocation** — logout clears the cookie but the JWT stays valid until it expires. Fix: short-lived access token + refresh token, or a revocation list.

**Recommendations**
- 🟠 **Non-deterministic k-means** — random centroid initialization means two identical requests can produce different feeds. Fix: k-means++ seeding, or persist the user's cluster profile.
- 🟠 **Interleaving instead of weighted ranking** — no unified relevance score across the semantic and geo streams.
- 🟡 **No engagement signals** — CTR, dwell time, and likes-after-impression aren't fed back into ranking.
- 🟡 **Clustering recomputed on every Explore request** — should be a persisted, incrementally-updated niche profile.

**Infrastructure / quality**
- 🟠 **No automated tests** anywhere in the repo.
- 🟡 **No Cloudinary transformations** — images served at full resolution.
- 🟡 **No pagination** on the Explore feed — it returns a fixed slice.
- 🟡 **No rate limiting** on upload endpoints (`/api/memory/creatememory`) — auth endpoints are covered (see [§8](#8-auth--security)).
- 🟡 `implementNext.md` and `docs/memory-model.md` are **stale** — the former lists password hashing as a to-do when bcrypt is already implemented, the latter predates the `category` / `embedding` / `likes` / `comments` fields. Treat `RecommnedationSystem.md` as the only current design doc.

---

## 11. Interview cheat sheet

Short answers to the questions this codebase invites.

**"Walk me through what happens when a user opens Explore."**
`GET /api/memory/explore` → fetch the user's follow list → load their own + liked memories *with* embeddings → adaptive `k` from the interaction count → k-means with cosine similarity → pick the centroid closest to the last-5-interaction average → `$vectorSearch` with that centroid (Stream A) and `$geoNear` 50 km from the most recent located interaction (Stream B) → both pipelines `$lookup` the author and apply the privacy `$match` → round-robin interleave with de-dup → if empty, walk the three-tier fallback ladder → attach a human-readable reason to each item → return with diagnostics.

**"Why k-means and not just averaging the user's embeddings?"**
Averaging destroys multi-modal taste. A user who likes both mountains and street food gets a mean vector that sits between the two clusters and represents neither, producing a feed that matches nothing. Clustering keeps the modes distinct and yields centroids that plug straight into vector search.

**"How would you scale this to a million users?"**
Precompute and persist per-user cluster profiles on a schedule instead of clustering per request; move embedding generation to a queue with dedicated workers (the model is currently in the API process — CPU-bound work colocated with I/O-bound serving); add the Redis adapter for Socket.IO so presence works across instances; add the missing indexes and cursor-based pagination; introduce a read-through cache for Explore results with a short TTL. And once there's real engagement data, replace the interleave with a learned ranker.

**"Why not use OpenAI embeddings?"**
Cost and latency. MiniLM in-process is free, has no rate limits, and adds no network hop. The quality gap is real but doesn't change the outcome at this corpus size — clustering only needs the vectors to be *relatively* ordered, not state-of-the-art.

**"What would you fix first?"**
The missing indexes on `Memory.userId`, `Memory.createdAt`, and `Message.chatId` — they're a one-line change each and they're on the hottest read paths in the app, so it's the best effort-to-impact ratio available. After that, the Redis adapter for Socket.IO, because it's the single thing blocking the API from running on more than one instance.

**"How do you stop one user from reading another user's messages?"**
Identity is never taken from the client on either transport. REST routes derive `req.userId` from a verified JWT cookie in `verifyToken`; the WebSocket does the same thing in an `io.use()` handshake middleware before the connection is accepted. Message delivery then fans out over a Socket.IO room keyed by that verified id — the client never names the socket it's delivering to.

**"What's the thing you're most happy with?"**
The fallback ladder and the explainability tags. Together they mean Explore never returns an empty page and never returns a result you can't trace back to a reason — which made the system debuggable while it was being built, not just presentable afterwards.

---

## Author

Built by **Sohan Bhadalkar**.
