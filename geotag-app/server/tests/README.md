# Phase 0 regression suite

This is the safety net described in Phase 0 of the co-presence rollout plan: before any
new feature code is written, there needs to be a mechanical way to prove the app's
existing hot paths still behave the same, rather than relying on clicking through the
UI by hand.

## What it covers

Signup, duplicate-signup rejection, login (success + wrong password), an unauthenticated
request being rejected, creating a memory (a **real** signed Cloudinary upload, cleaned
up at the end of the run), fetching your own memories, Explore returning `200` for both
a cold-start user and one with history, follow/unfollow, a real WebSocket
`sendMessage` → persist → emit → ack round trip, and confirming an unauthenticated
socket handshake is rejected rather than trusting a client-supplied identity.

## What it does NOT touch

- **The real Atlas cluster** — tests run against an in-memory MongoDB
  (`mongodb-memory-server`), started and torn down automatically. There is no network
  path from the test run to production data at all.
- **The real production Redis (Upstash)** — tests point at a local, disposable Redis
  instance instead (see prerequisites below).
- **Google OAuth** — not covered here; it needs a real Google-issued ID token, which
  can't be produced in an automated run. Email/password auth is fully covered.

The one deliberate exception: the create-memory test uses your **real** Cloudinary
account (via `server/.env`) to exercise the actual signed-upload path end to end, and
deletes what it created via the app's own delete route immediately afterward — the same
cleanup path a real user's delete goes through. Cost is one small (287-byte) test image,
briefly.

## Prerequisites

A local, test-only Redis instance on port `6380` (deliberately different from the
default `6379`, so it's obviously not your production `REDIS_URL`):

```bash
# one-time install
brew install redis

# start it, in the background, for testing only — no persistence, nothing written to disk
redis-server --port 6380 --daemonize yes --save "" --appendonly no
```

## Running it

```bash
cd geotag-app/server
npm test
```

`globalSetup.js` forks a real copy of `index.js` (the actual app) with its environment
pointed at the in-memory Mongo and the test Redis above, waits for its "Server running"
log line, and hands the running instance's URL to the test file. `globalTeardown.js`
kills that process and stops the in-memory Mongo when the run finishes — nothing is
left running afterward.

## Proving it actually catches something

A test suite that always passes isn't proof of anything. To confirm this one really
detects a regression rather than passing trivially: temporarily comment out the
`isPrivate` check in `routes/memoryRoutes.js`'s `GET /user/:id`, or the ownership check
in `editmemory`/`deletememory`, run `npm test`, confirm the relevant assertion fails,
then revert the change. This suite doesn't have a dedicated test for every privacy rule
yet (that's this project's next test-writing task, not Phase 0's job) — Phase 0's job
was only to prove the *mechanism* works before Phase 1 starts building on top of it.
