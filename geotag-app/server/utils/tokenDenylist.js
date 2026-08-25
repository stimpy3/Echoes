const { redis } = require('./redisClient');
const logger = require('./logger');

/*
Audit finding BE-013: logout only ever cleared the cookie client-side — a captured JWT
(stolen from a device, leaked in a log, whatever) remained cryptographically valid for
its full 7-day expiry regardless of the legitimate user logging out. This is the fix: a
Redis-backed denylist keyed by each token's own `jti` (see routes/authRoutes.js's
createToken, which now mints one per token), checked at verify time in both
middleware/verifyToken.js and the Socket.IO handshake in index.js.

Not a full refresh-token architecture (a short-lived access token + long-lived refresh
token pair) — that's a real redesign of the auth flow, out of scope for closing this
specific gap. A denylist is the minimal fix that makes logout actually revoke the token
that was logged out of, which is the concrete risk this finding describes.

Same fail-open policy as the rest of this app's Redis usage (see cache.js's own
reasoning, and the rate limiter's passOnStoreError): if Redis is unreachable, a check
here treats the token as NOT revoked rather than rejecting every request in the app.
Losing Redis should cost this one specific protection, not take the whole app down —
consistent with how every other Redis-backed feature here already degrades.
*/

function denylistKey(jti) {
  return `denylist:${jti}`;
}

/**
 * Denylists a token by its jti until `expSeconds` from now (normally the token's own
 * remaining lifetime, so the denylist entry never outlives the token it's blocking —
 * once the token would have expired naturally anyway, there's nothing left to deny).
 */
async function denylistToken(jti, expSeconds, log = logger) {
  if (!jti) return; // a pre-fix token (no jti claim) has nothing to key a denylist entry on.
  const ttl = Math.max(1, Math.floor(expSeconds));
  try {
    await redis.set(denylistKey(jti), '1', 'EX', ttl);
  } catch (err) {
    log.error({ err, jti }, '[token-denylist] failed to denylist token');
  }
}

/**
 * Returns true only if this exact token was explicitly denylisted (a real logout of
 * THIS token) — never throws; a Redis error is treated as "not denylisted."
 */
async function isTokenDenylisted(jti, log = logger) {
  if (!jti) return false;
  try {
    const value = await redis.get(denylistKey(jti));
    return value !== null;
  } catch (err) {
    log.error({ err, jti }, '[token-denylist] check failed, treating as not revoked');
    return false;
  }
}

module.exports = { denylistToken, isTokenDenylisted };
