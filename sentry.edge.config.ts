import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN || "",
  tracesSampleRate: process.env.SENTRY_DSN ? 0.1 : 0,
  debug: false,
  enabled: !!process.env.SENTRY_DSN,
});
