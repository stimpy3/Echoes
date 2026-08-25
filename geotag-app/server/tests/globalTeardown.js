// Counterpart to globalSetup.js — stops the forked app process and the in-memory Mongo
// instance so a test run never leaves anything running behind it.

const fs = require('fs');
const path = require('path');
const os = require('os');

const STATE_FILE = path.join(os.tmpdir(), 'echoes-test-state.json');

module.exports = async function globalTeardown() {
  const child = global.__ECHOES_TEST_APP__;
  if (child && !child.killed) {
    // Wait for the actual exit, not just the signal being sent — otherwise Jest's
    // main process can still see the child's stdio pipes open when it checks for
    // lingering handles right after this function returns, and warns about a leak
    // that isn't one, just a race with an async kill.
    await new Promise((resolve) => {
      child.once('exit', resolve);
      child.kill('SIGTERM');
      // Belt-and-braces: don't hang teardown forever if the child ignores SIGTERM.
      setTimeout(() => {
        if (!child.killed) child.kill('SIGKILL');
        resolve();
      }, 5000);
    });
  }

  const mongod = global.__ECHOES_TEST_MONGOD__;
  if (mongod) {
    await mongod.stop();
  }

  if (fs.existsSync(STATE_FILE)) {
    fs.unlinkSync(STATE_FILE);
  }
};
