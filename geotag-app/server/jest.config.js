// Phase 0 test harness config (see tests/README.md).
// globalSetup boots an isolated in-memory MongoDB + a forked copy of the real app
// pointed at it and at a local, test-only Redis instance; globalTeardown tears both down.
module.exports = {
  testEnvironment: 'node',
  globalSetup: '<rootDir>/tests/globalSetup.js',
  globalTeardown: '<rootDir>/tests/globalTeardown.js',
  testMatch: ['<rootDir>/tests/**/*.test.js'],
  // One shared forked server instance for the whole run (see globalSetup.js) — tests
  // must run serially, not spread across parallel workers that would race each other
  // against the same instance. `npm test` also passes --runInBand for the same reason.
  maxWorkers: 1,
  verbose: true,
};
