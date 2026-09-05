// Loose end closed: jobs/coPresenceCandidateJob.js had real logic and real tests but no
// scheduler anywhere — nothing outside the test suite ever actually triggered it, so in
// a real deployment it would simply never run. queues/coPresenceCandidateQueue.js adds
// a BullMQ repeatable schedule (workers/coPresenceCandidateWorker.js consumes it).
//
// First attempt used the older `queue.add(..., { repeat })` shape and it silently did
// NOT register a recurring schedule under the installed BullMQ version (6.x) — confirmed
// by checking queue.getJobSchedulers() after calling it: empty, even though the job
// itself fired once. Switched to the explicit Job Scheduler API
// (upsertJobScheduler), which IS idempotent by scheduler id. This test exists so that
// regression is never silent again.

// This file connects to Redis directly, in the Jest process itself — unlike the forked
// app (tests/globalSetup.js), which gets REDIS_URL injected into ITS env only. Point at
// the same disposable local Redis instance globalSetup started, matching the pattern
// tests/helpers/flushRateLimits.js already uses for the same reason.
process.env.REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6380';

const { coPresenceCandidateQueue, scheduleCoPresenceCandidateJob } = require('../queues/coPresenceCandidateQueue');

afterAll(async () => {
  await coPresenceCandidateQueue.obliterate({ force: true });
  await coPresenceCandidateQueue.close();
});

describe('Co-presence candidate job scheduler', () => {
  test('registers exactly one recurring scheduler with the configured interval', async () => {
    await scheduleCoPresenceCandidateJob(1234);

    const schedulers = await coPresenceCandidateQueue.getJobSchedulers();
    expect(schedulers.length).toBe(1);
    expect(schedulers[0].key).toBe('copresence-candidate-schedule');
    expect(schedulers[0].every).toBe(1234);
  });

  test('calling it again (simulating a restart) updates in place, never duplicates', async () => {
    await scheduleCoPresenceCandidateJob(1234);
    await scheduleCoPresenceCandidateJob(1234);
    await scheduleCoPresenceCandidateJob(1234);

    const schedulers = await coPresenceCandidateQueue.getJobSchedulers();
    expect(schedulers.length).toBe(1); // still exactly one, not three.
  });

  test('a changed interval updates the existing scheduler rather than adding a second one', async () => {
    await scheduleCoPresenceCandidateJob(1234);
    await scheduleCoPresenceCandidateJob(5678);

    const schedulers = await coPresenceCandidateQueue.getJobSchedulers();
    expect(schedulers.length).toBe(1);
    expect(schedulers[0].every).toBe(5678);
  });
});
