const rateLimit = require('express-rate-limit');
const { RedisStore } = require('rate-limit-redis');
const { redis } = require('../utils/redisClient');
const logger = require('../utils/logger');

/*
Backed by Redis rather than express-rate-limit's default in-memory store for the same
reason the Socket.IO adapter had to move off a local object: an in-memory counter only
sees requests that landed on THIS instance. Run two servers behind a load balancer and a
plain in-memory limiter effectively doubles the real limit — an attacker's requests get
split across instances, each with its own fresh counter. Redis makes the counter shared,
so the limit is the limit regardless of which instance answers a given request.

sendCommand is the documented rate-limit-redis v6 adapter for an ioredis client — ioredis
exposes .call() for arbitrary commands, which is what the store uses under the hood.

passOnStoreError: true is the fix for a real gap — without it, express-rate-limit's own
source re-throws whatever error the store produced (verified against the installed
package: node_modules/express-rate-limit/dist/index.cjs, the `if (config.passOnStoreError)`
branch), which with no global Express error handler in this app means a Redis blip would
take down login/signup entirely rather than degrade. That directly contradicted the "losing
Redis costs latency, never correctness" principle the cache helper (utils/cache.js) already
follows — this makes the rate limiter match it: a Redis error here now logs and lets the
request through unlimited for that one request, rather than failing the request outright.

logger: passed through so a store failure logs via the same structured pino pipeline as
everything else (see utils/logger.js) instead of the library's console.error default — its
call shape, logger.error(err, message), is exactly pino's.

prefix: MUST be distinct per limiter. rate-limit-redis's RedisStore defaults `prefix` to
the same "rl:" for every instance, and express-rate-limit's default keyGenerator is just
the request IP — with no override, all three limiters below were writing to and reading
from the exact same Redis key per IP (verified directly against
node_modules/rate-limit-redis/dist/index.cjs's `this.prefix = options.prefix ?? "rl:"`).
That meant they were never actually independent: enough login attempts from one IP could
silently trip signup's much stricter 5/hour ceiling (or vice versa), even though each
limiter's own configured `limit` implied otherwise. Found via the Phase 0 regression
suite (server/tests/), which happened to exercise signup and login back-to-back and hit
exactly this. Each limiter now gets its own namespaced prefix so its counter is truly its
own.
*/
function createRateLimiter({ windowMs, limit, message, prefix }) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    passOnStoreError: true,
    logger,
    message: { message },
    store: new RedisStore({
      prefix,
      sendCommand: (...args) => redis.call(...args),
    }),
  });
}

//Deliberately more generous than a typical login limiter: a real user fat-fingering
//their password a few times shouldn't get locked out. Still low enough to make credential
//stuffing / brute force impractical — 10 attempts per 15 min per IP.
const loginLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  message: 'Too many login attempts. Please try again in a few minutes.',
  prefix: 'rl:login:',
});

//Tighter than login: account creation is rarer and abuse (mass fake accounts) is cheap
//to attempt and disproportionately costly to clean up after.
const signupLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  message: 'Too many accounts created from this address. Please try again later.',
  prefix: 'rl:signup:',
});

//Google sign-in can't be brute-forced the way password login can — it requires a real,
//signed Google ID token — but jwt verification against Google's endpoint still costs a
//real network round trip per attempt, so a loose limit is still worth having against
//naive request flooding.
const googleAuthLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  message: 'Too many requests. Please try again in a few minutes.',
  prefix: 'rl:google:',
});

//Co-presence rollout, Phase 4. Confirm/reject take an arbitrary :id — unlike
//GET /pending or /matches (which are already scoped to the caller's own rows and have
//nothing to probe), a bad actor could otherwise hammer confirm/reject with guessed
//candidate ids to fish for which ones exist via status-code differences. Not tied to
//login/signup's counters — this has its own prefix from the start, precisely because
//sharing one by accident is the exact bug the Phase 0 regression suite caught here.
const coPresenceActionLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  message: 'Too many requests. Please try again in a few minutes.',
  prefix: 'rl:copresence:',
});

module.exports = { loginLimiter, signupLimiter, googleAuthLimiter, coPresenceActionLimiter };
