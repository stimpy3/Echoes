/*
Audit finding BE-011: several list routes (messages in a chat, a user's memories,
followers/following, notifications) had no upper bound at all on how many documents a
single request could return — the query, the response payload, and the client's
render cost all grow with however much history exists, unboundedly. Real accounts
accumulate exactly this kind of unbounded history over time.

This is deliberately NOT full page-based pagination (page numbers, total counts, a
`hasMore` cursor) — that would change every affected route's response shape, which
would break the existing client against no benefit for THIS finding's actual risk,
which is unbounded result size, not the lack of a "next page" UI. Callers may still opt
into a smaller page via ?limit=, but the response shape and default behavior for
existing callers is unchanged apart from now being capped.
*/

/**
 * Resolves a safe `limit` for a list query from `req.query.limit`, clamped to
 * (0, maxLimit]. Falls back to defaultLimit for a missing, non-numeric, or
 * non-positive value — never trusts the client to request "everything."
 */
function resolveLimit(req, { defaultLimit, maxLimit }) {
  const requested = parseInt(req.query?.limit, 10);
  if (Number.isFinite(requested) && requested > 0) {
    return Math.min(requested, maxLimit);
  }
  return defaultLimit;
}

module.exports = { resolveLimit };
