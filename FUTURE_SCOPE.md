# Future scope

Design decisions and research notes for the next phase of Echoes.
Written 2026-08-18. Line references are against commit `7600db4`.

The organising thesis: **Echoes is a digital memory store, not a feed.** Every item below is
evaluated against whether it helps a person *get a memory back out*, or make a new one worth
keeping — not against engagement.

---

## Committed

### 1. People on memories 🟢

`Memory` currently has a *where* and a *when* and no **who**. That's half a memory missing.

Add `people[]` — free text, or a `User` ref when they're on the app.

Unlocks immediately:

- filter timeline and map by person ("everything with Dad")
- co-presence edges as a recommendation signal (see §4)
- personal-CRM surface — "you haven't seen X in 8 months"

**Do not rely on manual tagging.** Features like this die when they need typing. The intent is
that §4 *proposes* the tag and the user confirms it.

### 2. Fog of war 🟢

Store visited cells as geohashes; render the world dark with holes where you've been.

- **Precision 7** (~150 m) for storage. Geohashes are prefix-nested, so truncating to 4–5 chars
  gives coarse cells for zoomed-out rendering for free — aggregation is a substring op.
- A coarse cell counts as explored if any child is.
- Feeds Analytics with real numbers: % of a country explored, new cells per month.

⚠️ **Do not implement as a world polygon with holes punched in it.**
[maplibre-gl-js#4367](https://github.com/maplibre/maplibre-gl-js/issues/4367) — polygons with holes
produce clipping artifacts that flicker in and out at certain zooms. Open, unfixed, maintainers
asking for a PR. This is exactly the naive fog/mask pattern.

**Instead: draw the fog, not the anti-fog.** Emit one quad per *unvisited* cell in the viewport,
regenerated on `moveend`. No holes, no bug. Make them `fill-extrusion` so fog renders as *walls*
at the frontier of explored territory when the camera is pitched — that's the entire emotional
payload of the feature, and it only exists in 2.5D.

### 3. 2.5D map — MapLibre migration 🟢

Leaflet is DOM/raster and is the wrong substrate for §2. SVG-with-holes dies under thousands of
rings; a canvas overlay means hand-managing projection math on every `move` event. MapLibre is
WebGL, so fog becomes a layer in the same render pass as the basemap.

**The creative unlock is time as the Z axis.** Extrude memory markers by age — recent at ground
level, older rising as columns. Solves the real overlapping-pin problem at places visited
repeatedly, and shows *where* and *when* in one view without scrubbing. Impossible on a flat map.

**Tiles — preserves the zero-cost constraint:**

- [OpenFreeMap](https://openfreemap.org/) — no API key, no registration, no request limits.
- Use the **Liberty** style; it has the `fill-extrusion` building layer. **Bright does not.**
- **Positron** is the vector equivalent of the CARTO raster currently in
  `MapView.jsx:19` (`light_all`/`dark_all`), so `ThemeContext` dark/light ports cleanly.
- Fallback if OpenFreeMap (single-maintainer, donation-funded) goes away: Protomaps `.pmtiles`
  served off Cloudflare R2's free tier.
- Terrain: free Terrarium tiles from AWS Open Data, no key. ⚠️ `encoding` defaults to `'mapbox'`;
  the free sources are `'terrarium'` — wrong value gives silently wrong elevations, not an error.
  Make terrain an opt-in toggle on trip/timeline views only; it costs real frames and is pointless
  in cities.

**Migration notes:**

| File | Lines | Actually changes |
| --- | --- | --- |
| `MapView.jsx` | 106 | ~all, but it's thin |
| `TimelineMapView.jsx` | 314 | ~60 — the rest is ruler/scrubber logic, map-agnostic React |
| `CustomMarker` + `Friend` + `Home` | 231 | the real work |

- **Keep DOM markers.** MapLibre's `Marker` takes an arbitrary HTML element, same as Leaflet's
  `divIcon` — the GSAP enter/exit animations in `TimelineMapView` survive intact. Symbol layers are
  faster but that's a separate PR.
- **Skip `react-map-gl`.** Only two map components, and fog layers + terrain need imperative map
  access anyway. Use `maplibre-gl` directly behind a thin hook.
- ⚠️ **`map.setStyle()` destroys custom layers** — the dark/light toggle will silently nuke the fog
  layer. Re-add on the `styledata` event.
- Bundle: `maplibre-gl` ~800 KB vs Leaflet ~150 KB. Lazy-load the map route.
- Pitched vector + extrusions + fog is heavy on low-end Android. Needs a "reduce effects" fallback.

**Sequence — do not big-bang:**

1. Port flat, at parity (MapLibre + Positron, DOM markers, zero pitch). Nothing looks different.
   This is the boring PR that de-risks everything.
2. Fog of war as extruded unvisited cells.
3. Then pitch, buildings, time-extruded markers.

### 4. Collab memories — co-presence detection 🟢

Two memories, two users, within radius R and time window T → candidate co-presence event.

**GPS alone is too weak.** R = 200 m at a mall means "same building," not "same table"; everyone in
a stadium is a false positive.

**Confirm with the photos.** People at the same event take visually similar pictures — same stage,
same light, same food. Score co-presence as spatial proximity × temporal proximity ×
**visual similarity of the two images**. That third term is what separates "both in Bandra" from
"together." Requires image embeddings — see §7, and this is one of the strongest arguments for CLIP.

Value, in order:

- **People tagging without tagging** — the app proposes "was Rohan with you?" instead of demanding
  typed names. This is what makes §1 survive contact with real users.
- **A social graph from physical reality.** "People you were repeatedly near" is revealed
  preference; "people you followed once" is noisy and stale. This alone may outperform the current
  Explore engine.
- **Shared memory objects** — one event, two viewpoints, merged. Structurally impossible in a feed.

⚠️ **Privacy is the whole design, not a footnote.** This feature leaks where you were and when.
Non-negotiable: mutual-follow only, opt-in per user, and co-presence candidates surfaced
**symmetrically to both parties after both opt in** — never reveal one person's location to the
other to confirm a match. Get this wrong and it's a stalking tool.

### 5. Hot recommendations — places trending among your people 🟢

**Why this works when item-level CF wouldn't:** `RecommnedationSystem.md` rules out collaborative
filtering for lack of users. True *per memory* — each is a unique item seen by ~3 people. But a
**place** is dense: dozens of memories collapse into one spot. Quantizing space is a dimensionality
reduction that makes CF viable at small scale. This is the social-proof leg the system has zero of.

**Stay on-thesis: places, not posts.** "Trending posts" is Instagram. "Three people you follow have
been somewhere you haven't" is a memory store — recommending *somewhere to go make a memory*, not
content to consume. The output unit is a `Place`, not a ranked photo list.

**What is a spot?** DBSCAN over coordinates (eps ≈ 50–100 m) to derive canonical `Place` entities
offline, with geohash as the cheap lookup index. Watch the geohash boundary problem — memories 5 m
apart can straddle a cell edge; needs a neighbour-cell check. The `Place` entity pays for itself
elsewhere: rarity for significance scoring (§7), names for fog of war.

**Hot is a rate, not a count.** Raw counts make famous places permanently "hot" — that's *famous*,
not hot. Compare a place's recent visit rate against **its own** trailing baseline (anomaly
detection, k sigma), not Reddit-style `log(score) + decay`, which still rewards absolute volume.

**Whose hot?**

| Tier | Signal | Problem |
| --- | --- | --- |
| Global | everyone | tourist traps; useless here |
| Friend | people you follow | high signal, sparse for new users |
| **Cohort** | people whose history clusters like yours | the real CF play; fixes friend-hot sparsity |

**Novelty gate:** exclude or heavily downrank places the user has already visited, or it confidently
recommends their own neighbourhood back to them.

⚠️ **Aggregation is an attack surface** even when every contributing memory is public. "2 friends
visited X" when you follow 3 people de-anonymizes. Needs a **k-anonymity floor** (~3–5 distinct
contributors) before surfacing, and contributors are never named unless already visible under
existing privacy rules. Private accounts must not contribute to counts visible to non-followers.

**Resolving precomputability vs privacy:** don't trade one for the other — use two signals.
Precompute place-hotness from **public memories only** (safe, cacheable, one table); compute
friend-hot on the fly over the follow set (cheap — follow sets are small). Combine at rank time.

⚠️ **Density floor.** With ~5 test users nothing clears a hotness threshold and the feature looks
broken in a demo. Mitigate with an adaptive time window (widen until something surfaces), lower k in
sparse regions, or seeded demo data. Unlike the rest of the stack, this gets *better* with scale.

### 6. Unification — §4 and §5 are one pipeline

Both are **clustering memories in space-time and thresholding differently**:

- tight cluster + 2 users + minutes apart + mutual follow → **co-presence**
- loose cluster + k users + rate spike over weeks → **hot spot**

Build the space-time clustering once; both features fall out of parameter choices. Implementing them
separately means writing the same DBSCAN twice.

**And it closes the fog-of-war loop:** hot places *inside your unexplored fog* — "three people you
follow have been to an area you've never cleared." Discovery nudge, gamification loop, and
recommendation in one, and specific to this app in a way no feed feature could be.

---

## Do later

Agreed in principle, deliberately deferred. Not blocking anything above.

### 7. Binary quantization of embeddings 🔵

The concrete answer to "scalability hasn't been thought about" on the vector side.

Atlas supports quantization natively in the vector index definition — no application-level work, no
second datastore. Each dimension is compared against a midpoint of 0 (valid precisely because the
embeddings are already L2-normalized, which they are) and stored as a single bit.

**The numbers for this project:**

| | Per vector | 100k memories |
| --- | --- | --- |
| Current — 384 × float32 | 1,536 B | ~154 MB |
| Binary — 384 × 1 bit | 48 B | ~4.8 MB |

A clean **32× reduction**. With **rescoring** — retrieve a wider candidate set using the binary
vectors, then re-rank the top-k against full-fidelity vectors — MongoDB reports ~96% less memory
while retaining ~95% of search accuracy.

**Why it's deferred, not dropped:** at the current corpus size this saves single-digit megabytes and
optimizes a resource that isn't scarce yet. Premature. **Trigger to revisit:** when the vector index
stops fitting comfortably in the Atlas tier's memory budget, or when `$vectorSearch` latency becomes
visible in Explore. Until then it's a documented plan, not a task.

⚠️ **Matryoshka truncation is *not* available as a free companion lever here.** MRL only works if the
model was trained for it — early dimensions deliberately carrying more information. `all-MiniLM-L6-v2`
is **not** MRL-trained, so chopping its 384 dims to 256 degrades quality unpredictably rather than
gracefully. If dimension reduction ever becomes desirable, it requires *switching to an MRL-trained
model*, which is a much larger decision than flipping on quantization. Don't conflate the two.

Note this interacts with the CLIP migration in the ML roadmap — CLIP ViT-B/32 emits 512 dims, so do
the quantization work *after* any embedding-model change, not before, or it gets redone.

---

## Recommendation engine — diagnosis

### Quality

1. **Single-cluster selection is the main problem.** `memoryRoutes.js:611` clusters history into k
   centroids, picks the one nearest recent interest, and searches only that. The feed is **monotone
   by construction** — a diversity mechanism was built and then discarded. Sample from multiple
   centroids proportionally, or ε-greedy (~70% dominant mood / 30% weaker). Biggest perceived
   quality gain per line changed.
2. **Vector search is post-filtered.** `memoryRoutes.js:642-650` takes the top 30 by `$vectorSearch`
   and *then* `$match`es on category/privacy/not-me. If those 30 are mostly private non-followed
   users the result is **zero** and it crashes down the fallback ladder — likely why fallbacks fire
   more than expected. Atlas `$vectorSearch` has a `filter` field that pre-filters inside the index.
   This is a bug, not tuning, and it degrades monotonically as the corpus grows.
3. **Interleaving isn't ranking.** The #1 geo result outranks the #2 semantic result by position
   alone, however bad it is. Needs one weighted score.
4. **No negative signal, no recency decay.** Likes and own-posts only; a like from two years ago
   weighs the same as yesterday's, and nothing learns from what was scrolled past.
5. **A photo app that ignores photos.** Everything embeds `title + description` — user-typed, often
   lazy or empty. The image carries most of the signal and none of it is used.

### Scalability

1. **`memoryRoutes.js:565` is O(entire corpus), every request.** `Memory.find({ likes: currentUserId })`
   with **no index on `likes`** (`models/memories.js:31` declares only `2dsphere`) is a full
   collection scan per Explore load. At 100k memories this one query is the whole latency budget.
   Note: `implementNext.md` lists missing indexes on `userId`/`createdAt` but misses `likes`, which
   is the expensive one.
2. **`memoryRoutes.js:564-565` is unbounded.** No `.limit()`, and `.select('+embedding')` drags
   ~3 MB of float arrays per page load for a user with 2,000 memories. Cap the history window — the
   recent ~200 interactions carry the same signal.
3. **k-means runs on every request** (`memoryRoutes.js:595`) — recomputing a profile that changes
   maybe once a day, on every page view.

**The fix for all three is one move: materialize the profile, don't derive it on read.** A
`UserProfile` doc holding centroid vectors + a location anchor, recomputed on interaction or
nightly, turns Explore from O(user history) into an O(1) lookup. More valuable than any model
upgrade.

**Update (2026-08-19): the mechanism this needs now exists, the profile itself doesn't yet.**
`server/utils/cache.js` is a generic Redis cache-aside helper (`getOrSetCache`/`invalidateCache`,
fails open if Redis is down), currently proven on `GET /api/users/:id` — see the README's
[§3 Redis section](README.md#redis--one-shared-store-three-unrelated-jobs). This item is
now "compute the centroids and call `getOrSetCache('profile:<userId>', ttl, computeFn)`", not
"design a caching layer from scratch." Cuts real remaining work, doesn't complete the item.

**Adopt candidate generation → ranking.** These are currently conflated. Stage 1 retrieves ~500
cheap candidates from several sources; stage 2 scores them with something expensive. Every real
recsys is shaped this way, it scales cleanly, and it's legible in an interview.

Candidate generators: **vector · geo · social · hot** (§5).

---

## ML roadmap

**CLIP is the one that matters.** `Xenova/clip-vit-base-patch32` runs in transformers.js exactly
like the current MiniLM — same in-process, zero-cost pattern already built. One embedding space for
images and text, and it pays for itself four times:

- semantic search over photos using words
- recommendations driven by the actual image, not the caption
- **zero-shot categorization** against the existing 8 category labels, no training data — deletes a
  form field
- the visual-similarity term that makes co-presence (§4) work

**Trip / event segmentation.** DBSCAN over (lat, lng, time) with scaled axes clusters memories into
named events — "Goa, Dec 2024" — unsupervised, arbitrary cluster count, handles noise. Same
primitive as §6.

**Significance scoring — the interesting one.** The ML problem at the heart of a memory store:
*what deserves to be remembered?* Google Photos' Memories is roughly face-count plus aesthetics,
which is why it shows the same beach forever. Available signals: rarity of the place (first visit ≫
200th coffee shop), presence of people, time gap since the previous memory (discontinuities mark
events), whether it anchors a trip, engagement. A ranking problem with no labels — bootstrap labels
from what users actually re-open, once logging exists.

⚠️ **Prerequisite for all of the above: there is currently zero interaction logging.** No
impressions, clicks, dwell, or skips. "The recommendations are bad" is a vibe, not a measurement,
and every idea here is unfalsifiable until an `Interaction` collection exists. Not ML — plumbing —
but it gates all the ML.

**Deliberately not doing:** two-tower models, learned rankers, anything trained. Insufficient
interaction volume for them to beat heuristics; a well-tuned weighted score wins at this scale.

---

## Suggested order

1. **Interaction logging** — everything downstream is guesswork without it
2. **`$vectorSearch` pre-filter + index on `likes`** — bug fixes, tiny, immediate
3. **Multi-cluster sampling** — biggest felt quality jump per line changed
4. **Materialize `UserProfile`** — the scalability fix
5. **MapLibre flat port at parity** — de-risks the map work
6. **People on memories** + **fog of war**
7. **CLIP** — the unlock
8. **Space-time clustering** → co-presence + hot spots (§6)
9. **Significance scoring**
10. **Binary quantization** (§7) — *demand-driven, not scheduled.* Do it when the trigger fires, and
    only after the embedding model has settled.

Items 2 and 3 are an afternoon and would measurably change how the feed feels.

⚠️ **Blocker before any location-density work:** `implementNext.md` flags the Socket.IO handshake as
unauthenticated (`socket/index.js:24` trusts `handshake.auth.userId`). Co-presence and hot spots
both concentrate location data. Close that hole first.

---

## Parked — researched, not committed

Kept so the research isn't lost. None of these are agreed.

- **Semantic search over your own archive.** The infrastructure (MiniLM + `vector_index`) already
  exists and there is currently *no* search endpoint at all — the only ways to reach an old memory
  are scrolling, map pins, or the timeline. Cheapest large win available if retrieval ever becomes
  the priority.
- **Resurfacing engine** — on-this-day, "you stood here 3 years ago" (unique to geotagged data),
  cold-storage surfacing. Research shows people love *and* resent this; ship mute-by-person /
  date-range / place controls **with** it, not after.
- **Passive location trail + auto trip detection** — the Dawarich / Polarsteps space. Accept the
  OwnTracks HTTP format rather than building a tracking client. Note: a browser PWA **cannot**
  background-track on iOS.
- **Geo-unlocked time capsules** — a note sealed until you return to a place. The 2dsphere index
  makes it nearly free; nobody ships the geo-unlock variant.
- **Import / export** — Google Takeout import solves cold start (users arrive with 10 years of
  history instead of an empty map); ZIP export is the digital-legacy story.

---

## References

- [maplibre-gl-js#4367 — polygon hole clipping artifacts](https://github.com/maplibre/maplibre-gl-js/issues/4367)
- [OpenFreeMap](https://openfreemap.org/) · [quick start](https://openfreemap.org/quick_start/)
- [MapLibre — display buildings in 3D](https://maplibre.org/maplibre-gl-js/docs/examples/display-buildings-in-3d/)
- [MapLibre — 3D terrain](https://maplibre.org/maplibre-gl-js/docs/examples/3d-terrain/)
- [MapLibre — large GeoJSON performance guide](https://maplibre.org/maplibre-gl-js/docs/guides/large-data/)
- [Dawarich — self-hosted location history](https://github.com/Freika/dawarich)
- [Timelinize — personal data on one timeline](https://github.com/timelinize/timelinize)
- [Immich — self-hosted photo management](https://github.com/immich-app/immich)
