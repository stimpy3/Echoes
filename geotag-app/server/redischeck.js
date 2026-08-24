// Read-only Upstash connectivity test using the same ioredis client redisClient.js builds.
// Sets a key, reads it back, deletes it, exits. No lasting writes.
require('dotenv').config();
const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']); // same fix already applied for Mongo's SRV lookup

const Redis = require('ioredis');

const url = process.env.REDIS_URL;
if (!url) { console.log('RESULT: REDIS_URL is empty in .env'); process.exit(1); }

const redis = new Redis(url, { maxRetriesPerRequest: 1, connectTimeout: 8000 });

const started = Date.now();

redis.on('error', (err) => {
  console.log(`RESULT: FAILED after ${Date.now() - started}ms`);
  console.log('name   :', err.name);
  console.log('message:', err.message);
  process.exit(1);
});

(async () => {
  await redis.set('echoes:connectivity-check', 'ok', 'EX', 30);
  const value = await redis.get('echoes:connectivity-check');
  await redis.del('echoes:connectivity-check');
  console.log(`RESULT: CONNECTED in ${Date.now() - started}ms, round-trip value = "${value}"`);
  await redis.quit();
})().catch((err) => {
  console.log(`RESULT: FAILED after ${Date.now() - started}ms`);
  console.log('name   :', err.name);
  console.log('message:', err.message);
  process.exit(1);
});
