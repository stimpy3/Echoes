/*
Small, dependency-free geo helper. The co-presence candidate job (jobs/coPresenceCandidateJob.js)
already gets "is this pair within X meters" for free from MongoDB's 2dsphere index via
$near/$maxDistance — this function is only for computing the actual distance to STORE on
a candidate record once a pair has already passed that index-backed filter, the same way
the app already hand-writes its own cosine similarity in utils/embeddingHelper.js rather
than pulling in a math library for one formula.
*/

const EARTH_RADIUS_METERS = 6371000;

function toRadians(deg) {
  return (deg * Math.PI) / 180;
}

/**
 * Great-circle distance between two GeoJSON [lng, lat] coordinate pairs, in meters.
 * @param {[number, number]} coordsA
 * @param {[number, number]} coordsB
 */
function haversineMeters(coordsA, coordsB) {
  const [lngA, latA] = coordsA;
  const [lngB, latB] = coordsB;

  const dLat = toRadians(latB - latA);
  const dLng = toRadians(lngB - lngA);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(latA)) * Math.cos(toRadians(latB)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_METERS * c;
}

module.exports = { haversineMeters };
