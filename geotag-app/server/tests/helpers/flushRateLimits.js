// Test-only helper. As more phases add more test files, each hitting signup/login from
// the same IP, the (correctly independent, since the Phase 0 fix) per-route rate
// limiters will otherwise accumulate across files within one `npm test` run and start
// rejecting requests that have nothing to do with abuse — that's the limiter doing its
// job correctly against real traffic, and the wrong thing to weaken in application code
// just to make tests convenient. This resets ONLY the rate-limit keys (the "rl:" prefix
// used exclusively by middleware/rateLimiter.js) on the disposable test Redis instance,
// leaving cache/BullMQ state alone. Call it from a `beforeAll` in any test file that
// exercises auth routes more than a couple of times.
const Redis = require('ioredis');

const TEST_REDIS_URL = 'redis://127.0.0.1:6380';

async function flushRateLimits() {
  const redis = new Redis(TEST_REDIS_URL, { maxRetriesPerRequest: 1, connectTimeout: 5000 });
  try {
    const keys = await redis.keys('rl:*');
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } finally {
    redis.disconnect();
  }
}

module.exports = { flushRateLimits };
