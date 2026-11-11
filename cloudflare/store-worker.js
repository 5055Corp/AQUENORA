// Cloudflare Worker for sellers' own domains (Cloudflare for SaaS, "Worker as fallback origin").
//
// Visitors to www.adirehouse.com reach this Worker (route */* on aquenora.com). It sends:
//   /store/*        -> the backend (BACKEND_ORIGIN), so the store page's data requests stay on
//                      the seller's own address (no cross-site permission needed)
//   everything else -> the web service (WEB_ORIGIN), telling it which domain was visited so it
//                      serves the store page.
//
// Variables (Worker -> Settings -> Variables):
//   BACKEND_ORIGIN  e.g. https://api.aquenora.com
//   WEB_ORIGIN      the web service's Railway address, e.g. https://web-production-1234.up.railway.app

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const toBackend = url.pathname.startsWith('/store/');
    const origin = toBackend ? env.BACKEND_ORIGIN : env.WEB_ORIGIN;
    if (!origin) return new Response('Store routing is not configured yet.', { status: 503 });

    const upstream = new URL(url.pathname + url.search, origin);
    const headers = new Headers(request.headers);
    headers.set('x-forwarded-host', url.hostname);
    headers.set('x-aquenora-shop-domain', url.hostname);
    headers.delete('host');

    return fetch(upstream, {
      method: request.method,
      headers,
      body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body,
      redirect: 'manual',
    });
  },
};
