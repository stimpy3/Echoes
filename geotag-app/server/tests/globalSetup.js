// Jest globalSetup — runs ONCE, in its own process, before any test file.
//
// Phase 0 of the co-presence rollout plan: this repo has zero automated tests today,
// so before any new feature code exists, we need a mechanical way to prove "existing
// routes still behave the same" rather than relying on manual clicking.
//
// This spins up two things, both fully isolated from anything real:
//   1. An in-memory MongoDB instance (mongodb-memory-server) — structurally impossible
//      for a test run to touch the real Atlas cluster, because there is no network path
//      to it from here at all.
//   2. The actual server (`node index.js`), forked as a child process with its env
//      pointed at that in-memory Mongo and at a local, test-only Redis instance
//      (started separately on port 6380, never the real Upstash instance this project
//      uses in production) — so the tests exercise the real app, not a mocked stand-in.
//
// State is handed to the test files (a separate process) via a JSON file, since
// environment variables set here don't cross the process boundary to the workers.

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Redis = require('ioredis');

const STATE_FILE = path.join(os.tmpdir(), 'echoes-test-state.json');
const APP_PORT = 6055; // dedicated to this test run — distinct from dev (5000) and any local instance.
const TEST_REDIS_URL = 'redis://127.0.0.1:6380'; // started separately, see tests/README.md.

module.exports = async function globalSetup() {
  // Flush the disposable test-only Redis before every run so leftover rate-limit
  // counters (or anything else) from a previous run can't cascade into unrelated
  // failures on this one. Safe ONLY because this is the dedicated test instance on
  // 6380, never the real Upstash instance — flushing that would be destructive and
  // is never done here.
  const testRedis = new Redis(TEST_REDIS_URL, { maxRetriesPerRequest: 1, connectTimeout: 5000 });
  try {
    await testRedis.flushall();
  } finally {
    testRedis.disconnect();
  }

  const mongod = await MongoMemoryServer.create();
  const mongoUri = mongod.getUri('echoes_test');

  const serverEntry = path.join(__dirname, '..', 'index.js');

  const child = spawn(process.execPath, [serverEntry], {
    cwd: path.join(__dirname, '..'),
    env: {
      ...process.env,
      NODE_ENV: 'test',
      PORT: String(APP_PORT),
      MONGO_URI: mongoUri,
      REDIS_URL: TEST_REDIS_URL,
      JWT_SECRET: 'phase-0-test-secret-do-not-use-in-real-life',
      // Cloudinary/Google creds intentionally NOT overridden — inherited from the
      // real .env so the one test that uploads a photo exercises the real signed
      // upload path, and deletes it again immediately afterward (see regression.test.js).
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let readyLog = '';
  const ready = new Promise((resolve, reject) => {
    const onData = (buf) => {
      readyLog += buf.toString();
      if (readyLog.includes('Server running')) {
        child.stdout.off('data', onData);
        resolve();
      }
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', (buf) => { readyLog += buf.toString(); });
    setTimeout(() => reject(new Error('Server did not report ready in 30s:\n' + readyLog)), 30000);
  });

  await ready;

  fs.writeFileSync(
    STATE_FILE,
    JSON.stringify({
      baseURL: `http://localhost:${APP_PORT}`,
      mongoUri,
      appPid: child.pid,
    })
  );

  // Stash handles on globalThis isn't visible to worker processes, but IS visible to
  // globalTeardown (same process, run right after all test files finish).
  global.__ECHOES_TEST_MONGOD__ = mongod;
  global.__ECHOES_TEST_APP__ = child;
};
