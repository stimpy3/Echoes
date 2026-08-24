const pino = require('pino');

/*
Single base logger for everything that isn't inside an HTTP request (boot messages, the
embedding worker, Redis error listeners). Anything inside a request should use req.log
instead (see index.js's pino-http wiring) — that's a CHILD of this same logger with the
request's id already bound, so its output still lands in the same stream/format, it just
also carries reqId without every call site having to pass it manually.

Pretty-printing only outside production: colorized, human-readable output is what you want
staring at a local terminal, but it costs CPU to format and produces one prettified line
per JSON field for something like a log-aggregation service to re-parse. Plain JSON lines
(pino's default) are what those tools actually want, and it's the cheaper format to emit
under real request load.
*/
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport:
    process.env.NODE_ENV === 'production'
      ? undefined
      : { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss' } },
});

module.exports = logger;
