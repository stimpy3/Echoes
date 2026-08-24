const { redis } = require('./redisClient');
const logger = require('./logger');

/*
Cache-aside: check Redis, on a miss call fetchFn and populate Redis for next time, on a
hit skip fetchFn entirely. Same pattern this app will want later for the recsys "materialize
don't derive" profile (see FUTURE_SCOPE.md) — that's a second caller of this same helper,
not a second cache mechanism.

Fails OPEN, not closed: if Redis is unreachable, callers still get a correct answer (by
falling through to fetchFn), just without the speedup. A cache should never be able to take
the app down — losing the cache should cost latency, not correctness or availability.

`log` defaults to the base logger but is meant to be overridden with `req.log` when called
from inside a request handler (see userRoutes.js) — a cache miss is a downstream effect of
whatever request triggered it, and it should show up tagged with that request's id, not as
an anonymous line with no way to tell which request it came from.
*/
async function getOrSetCache(key, ttlSeconds, fetchFn, log = logger) {
  try {
    const cached = await redis.get(key);
    if (cached !== null) {
      return JSON.parse(cached);
    }
  } catch (err) {
    log.error({ err, key }, '[cache] read failed, falling through to source');
  }

  const fresh = await fetchFn();

  //Don't cache a miss — an absent user shouldn't get a false "not found" served back
  //for the next `ttlSeconds` if it was created moments after the first request.
  if (fresh !== null && fresh !== undefined) {
    try {
      await redis.set(key, JSON.stringify(fresh), 'EX', ttlSeconds);
    } catch (err) {
      log.error({ err, key }, '[cache] write failed, continuing without caching it');
    }
  }

  return fresh;
}

//Call after any write that would make a cached value stale — a cache with no invalidation
//path just serves wrong data with more steps.
async function invalidateCache(key, log = logger) {
  try {
    await redis.del(key);
  } catch (err) {
    log.error({ err, key }, '[cache] invalidate failed');
  }
}

module.exports = { getOrSetCache, invalidateCache };
