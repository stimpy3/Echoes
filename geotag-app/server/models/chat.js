const mongoose = require("mongoose");

/*
Audit finding BE-016 (surfaced while fixing BE-009). The socket handler's find-or-create
for a brand-new conversation used to be a plain findOne-then-create with no protection
at all against two concurrent first-messages between the same two users: both requests
could read "no Chat yet" before either finished creating one, and each would create its
own Chat document for the same pair — silently splitting one conversation's history
across two rows, each with its own separate unreadCount/lastMessage.

pairKey is the fix: a single deterministic string for an unordered pair of user ids
(smaller id first, see buildPairKey below), backed by a unique index. That turns
"two requests race to create a Chat for this pair" into an atomic decision the database
itself enforces, the same way the CoPresenceCandidate/CoPresenceMatch unique indexes
already do for their own race elsewhere in this codebase — not something application
code has to get right on every call site.

sparse: true because existing Chat documents created before this fix have no pairKey at
all — a plain unique index would refuse to insert even the FIRST new-style document once
more than one old document exists (all of them sharing the same "missing field" value).
Sparse indexes only enforce uniqueness among documents that actually have the field, so
old rows are left alone; only chats created through the new path get deduplicated.
*/
function buildPairKey(userIdA, userIdB) {
    return [String(userIdA), String(userIdB)].sort().join('_');
}

const chatSchema = new mongoose.Schema({
    participants: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    }],
    pairKey: {
        type: String,
    },
    lastMessage: {
        type: String,
        default: ""
    },
    unreadCount: {
        type: Map,   //key = userId, value = count
        of: Number,
        default: {}
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

chatSchema.index({ pairKey: 1 }, { unique: true, sparse: true });

/*
Atomic find-or-create for a 1:1 chat between two users. Callers should always prefer
this over a manual findOne+create for a NEW conversation (an existing chat's own _id,
once known, can still be looked up directly via findById as usual).

findOneAndUpdate with upsert:true is atomic per document, but MongoDB's guarantee only
holds because of the unique index above — without it, this same code would have the
exact race it's meant to fix, just moved one layer down. Even with the index, a genuine
concurrent race can still surface as a duplicate-key error on the LOSING request (the
server detects the conflict after the fact rather than serializing the two upserts) —
that's not a bug to propagate to the caller, it means "the other request already created
this exact chat," so this catches it and fetches what the winner created.
*/
chatSchema.statics.findOrCreateForPair = async function findOrCreateForPair(userIdA, userIdB) {
    const pairKey = buildPairKey(userIdA, userIdB);
    try {
        return await this.findOneAndUpdate(
            { pairKey },
            { $setOnInsert: { participants: [userIdA, userIdB], pairKey } },
            { upsert: true, new: true }
        );
    } catch (err) {
        if (err.code === 11000) {
            const existing = await this.findOne({ pairKey });
            if (existing) return existing;
        }
        throw err;
    }
};

module.exports = mongoose.model("Chat", chatSchema);
