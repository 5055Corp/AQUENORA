// Error alerts for the app and store pages: crashes go to Sentry, which emails AQUENORA.
// Only when VITE_SENTRY_DSN is set (Railway web variables); loaded after start so the app stays fast.
// No personal details are sent.

export function startErrorAlerts(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
  if (!dsn) return;
  import('@sentry/react').then(Sentry => {
    Sentry.init({
      dsn,
      release: __BUILD_ID__,
      environment: import.meta.env.MODE === 'ios' ? 'iphone' : 'web',
      sendDefaultPii: false,
      tracesSampleRate: 0,
      beforeSend(event) {
        delete event.user;
        if (event.request) {
          delete event.request.cookies;
          delete event.request.headers;
          // Tracking links and resets carry secrets in the address: keep only the page.
          if (event.request.url) event.request.url = event.request.url.split('?')[0];
          delete event.request.query_string;
        }
        return event;
      },
    });
  }).catch(() => {});
}
