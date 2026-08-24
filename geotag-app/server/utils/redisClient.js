const Redis = require('ioredis');
const logger = require('./logger');

/*
Single source of truth for Redis connections in this app. Everything that needs Redis
(Socket.IO's adapter, the cache helper below, rate limiting) pulls from here instead of
each constructing its own client — one place to change the connection string, one place
to see every consumer.

REDIS_URL is provider-agnostic on purpose: `redis://localhost:6379` for a local/Docker
Redis, or a `rediss://...` URL from a free-tier host (Upstash, Redis Cloud) for anywhere
you don't want to run Redis yourself. Nothing downstream cares which.

maxRetriesPerRequest: null is required by BullMQ's own docs for any client it's handed —
without it, ioredis gives up on a command after a fixed number of retries instead of
letting BullMQ's own retry/backoff logic own that decision. Harmless for the adapter and
cache uses too, so one client config serves all three consumers.
*/
const connectionOptions = {
  maxRetriesPerRequest: null,
};

function createClient() {
  const url = process.env.REDIS_URL;
  if (!url) {
    throw new Error(
      'REDIS_URL is not set. Add it to .env — e.g. redis://localhost:6379 for a local ' +
      'Redis, or a rediss://... URL from a free-tier host like Upstash.'
    );
  }
  return new Redis(url, connectionOptions);
}

//A shared client for one-off commands (the cache helper). Socket.IO's adapter and BullMQ
//each need their OWN dedicated connections (pub/sub and blocking commands can't share a
//connection with regular commands) — they call createClient() themselves rather than
//reusing this one.
const redis = createClient();

redis.on('error', (err) => {
  //Redis being briefly unreachable should degrade the app (see cache.js), not crash it —
  //this listener exists so ioredis's own unhandled 'error' event doesn't take the process down.
  logger.error({ err }, '[redis] connection error');
});

module.exports = { redis, createClient };
