// Production web server for the AQUENORA seller app and store pages. No dependencies.
//
//   app.<ROOT_DOMAIN>, www.<ROOT_DOMAIN>, <ROOT_DOMAIN>  -> seller app (index.html)
//   <shop>.<ROOT_DOMAIN>                                  -> that shop's store page (store.html)
//   a seller's own domain (e.g. adirehouse.com)           -> store page; it asks the backend which shop
//   localhost, IPs, *.up.railway.app                      -> seller app; stores via /store.html?shop=<shop>
//
// Env: PORT (default 8080), ROOT_DOMAIN (e.g. aquenora.com; leave unset until the domain is live).
//      VITE_API_URL and VITE_MEDUSA_PUBLISHABLE_KEY (the same public values the app is built with)
//      let store pages carry link previews (photo, name, price) for WhatsApp, Instagram and others.

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const DIST = join(fileURLToPath(new URL('.', import.meta.url)), 'dist');
const PORT = Number(process.env.PORT) || 8080;
const ROOT_DOMAIN = (process.env.ROOT_DOMAIN ?? '').toLowerCase().replace(/^\.+|\.+$/g, '');
/** Subdomains that are never shop addresses. Shops can't take these names. */
const RESERVED = new Set(['app', 'www', 'api', 'admin', 'mail', 'static', 'cdn', 'stores', 'store', 'shop', 'help', 'support', 'status', 'blog', 'docs', 'billing', 'pay', 'checkout', 'account', 'login', 'signup', 'aquenora', 'aqenora']);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
  '.zip': 'application/zip',
  '.txt': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2',
};
const COMPRESSIBLE = new Set(['.html', '.js', '.css', '.svg', '.json', '.txt']);

/** Which page a host shows: the seller app or the store page. */
export function pageForHost(hostHeader, rootDomain = ROOT_DOMAIN) {
  const host = (hostHeader || '').toLowerCase().split(':')[0];
  if (!host || host === 'localhost' || /^[\d.]+$/.test(host) || host.endsWith('.up.railway.app') || host.endsWith('.railway.internal')) return 'app';
  if (!rootDomain) return 'app';
  if (host === rootDomain) return 'app';
  if (host.endsWith('.' + rootDomain)) {
    const sub = host.slice(0, -(rootDomain.length + 1));
    if (sub === 'stores') return 'store'; // the address sellers point their own domains at
    return RESERVED.has(sub) || !/^[a-z0-9-]+$/.test(sub) ? 'app' : 'store';
  }
  return 'store'; // a seller's own domain
}

// ---- link previews (Open Graph) for store and product links ----

const API_URL = (process.env.VITE_API_URL ?? process.env.API_URL ?? '').replace(/\/+$/, '');
const PUBLISHABLE_KEY = process.env.VITE_MEDUSA_PUBLISHABLE_KEY ?? '';
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const SYMBOLS = { ngn: '₦', ghs: 'GH₵', zar: 'R', kes: 'KSh ', usd: '$', gbp: '£', eur: '€', cad: 'CA$', xof: 'CFA ' };
export const money = (n, cur) => `${SYMBOLS[cur] ?? (cur ?? '').toUpperCase() + ' '}${Math.round(Number(n) || 0).toLocaleString('en')}`;

/** Lowest and highest price of a product with options (the first option sets the price). */
function priceRange(p) {
  const choices = p.options?.groups?.[0]?.choices;
  if (!choices?.length) return [p.price, p.price];
  const prices = choices.map((c) => (c.price == null ? p.price : c.price));
  return [Math.min(...prices), Math.max(...prices)];
}

/** The <head> tags for a store or one of its products. Exported for tests. */
export function previewTags(data, productSlug, pageUrl) {
  const store = data.store;
  const verified = store.verified ? ' ✓ Verified seller on AQUENORA.' : ' On AQUENORA.';
  const product = productSlug ? data.products.find((p) => p.handle === productSlug || p.id === productSlug) : null;
  let title, description, image;
  if (product) {
    const [lo, hi] = priceRange(product);
    const cur = product.currency_code ?? store.currency_code;
    title = `${product.title} · ${lo === hi ? money(lo, cur) : `${money(lo, cur)} – ${money(hi, cur)}`}`;
    description = `${store.name}${verified}${product.description ? ' ' + product.description : ''}`;
    image = product.images?.[0] ?? product.thumbnail;
  } else {
    title = store.name;
    description = `${store.design?.banner?.headline || 'Shop online'} · ${store.name}${verified}`;
    image = store.design?.banner?.image || data.products.find((p) => p.images?.[0])?.images[0] || store.design?.logo;
  }
  description = description.replace(/\s+/g, ' ').trim().slice(0, 200);
  return [
    `<title>${esc(title)}</title>`,
    `<meta name="description" content="${esc(description)}" />`,
    `<meta property="og:type" content="${product ? 'product' : 'website'}" />`,
    `<meta property="og:site_name" content="AQUENORA" />`,
    `<meta property="og:title" content="${esc(title)}" />`,
    `<meta property="og:description" content="${esc(description)}" />`,
    pageUrl ? `<meta property="og:url" content="${esc(pageUrl)}" />` : '',
    image ? `<meta property="og:image" content="${esc(image)}" />` : '',
    `<meta name="twitter:card" content="${image ? 'summary_large_image' : 'summary'}" />`,
  ].filter(Boolean).join('\n    ');
}

/** The shop a store request is for: its subdomain, its own domain, or ?shop= on the plain address. */
async function shopHandleFor(req, url) {
  const host = (req.headers['x-aquenora-shop-domain'] || req.headers.host || '').toLowerCase().split(':')[0];
  const q = url.searchParams.get('shop');
  if (q) return q.toLowerCase().replace(/[^a-z0-9-]/g, '');
  if (ROOT_DOMAIN && host.endsWith('.' + ROOT_DOMAIN)) {
    const sub = host.slice(0, -(ROOT_DOMAIN.length + 1));
    return RESERVED.has(sub) || sub === 'stores' ? '' : sub;
  }
  if (ROOT_DOMAIN && host && host !== ROOT_DOMAIN && !host.endsWith('.' + ROOT_DOMAIN)) {
    const r = await backend(`/store/domains/${encodeURIComponent(host)}`);
    return r?.handle ?? '';
  }
  return '';
}

const previewCache = new Map();
async function backend(path) {
  if (!API_URL) return null;
  const hit = previewCache.get(path);
  if (hit && hit.until > Date.now()) return hit.data;
  try {
    const res = await fetch(API_URL + path, { headers: { 'x-publishable-api-key': PUBLISHABLE_KEY }, signal: AbortSignal.timeout(2500) });
    const data = res.ok ? await res.json() : null;
    previewCache.set(path, { data, until: Date.now() + 5 * 60_000 });
    if (previewCache.size > 2000) previewCache.delete(previewCache.keys().next().value);
    return data;
  } catch {
    return null;
  }
}

/** store.html with link-preview tags for this store or product, or null to send the plain page. */
async function storePageWithPreview(req, url, file) {
  const handle = await shopHandleFor(req, url);
  if (!handle) return null;
  const data = await backend(`/store/sellers/${encodeURIComponent(handle)}`);
  if (!data?.store) return null;
  const slug = url.pathname.match(/^\/p\/([a-z0-9-]+)\/?$/i)?.[1] ?? null;
  const proto = req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
  const pageUrl = `${proto}://${(req.headers['x-aquenora-shop-domain'] || req.headers.host || '').split(',')[0]}${url.pathname}${url.search}`;
  const html = (await load(file)).body.toString('utf8');
  return html.replace(/<title>[^<]*<\/title>/, previewTags(data, slug, pageUrl)).replace(/<meta name="description"[^>]*>\s*/, '');
}

const cache = new Map();
async function load(file) {
  if (cache.has(file)) return cache.get(file);
  const body = await readFile(file);
  const ext = extname(file);
  const entry = { body, gz: COMPRESSIBLE.has(ext) && body.length > 1024 ? gzipSync(body) : null, type: TYPES[ext] ?? 'application/octet-stream' };
  cache.set(file, entry);
  return entry;
}

async function fileFor(urlPath) {
  let decoded;
  try {
    decoded = decodeURIComponent(urlPath);
  } catch {
    return null;
  }
  const full = normalize(join(DIST, decoded));
  if (full !== DIST && !full.startsWith(DIST + sep)) return null; // no ../ escapes
  try {
    return (await stat(full)).isFile() ? full : null;
  } catch {
    return null;
  }
}

function securityHeaders(req) {
  const h = {
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-Frame-Options': 'DENY',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  };
  if (req.headers['x-forwarded-proto'] === 'https') h['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains';
  return h;
}

async function send(req, res, file, status = 200) {
  const { body, gz, type } = await load(file);
  const isAsset = file.includes(`${sep}assets${sep}`);
  const headers = {
    ...securityHeaders(req),
    'Content-Type': type,
    // Hashed files in assets/ (and live-update bundles) never change; pages must always be fresh so new deploys show up.
    'Cache-Control': isAsset || /bundle-\d+\.zip$/.test(file) ? 'public, max-age=31536000, immutable' : 'no-cache',
    // The iPhone app reads the live-update manifest from capacitor://localhost.
    ...(file.includes(`${sep}live${sep}`) ? { 'Access-Control-Allow-Origin': '*' } : {}),
    Vary: 'Accept-Encoding',
  };
  const useGz = gz && /\bgzip\b/.test(req.headers['accept-encoding'] ?? '');
  if (useGz) headers['Content-Encoding'] = 'gzip';
  const out = useGz ? gz : body;
  headers['Content-Length'] = out.length;
  res.writeHead(status, headers);
  res.end(req.method === 'HEAD' ? undefined : out);
}

export const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', 'http://x');
    if (url.pathname === '/health') {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      return res.end('OK');
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { Allow: 'GET, HEAD' });
      return res.end();
    }

    // Sellers' own domains arrive through the Cloudflare Worker (cloudflare/store-worker.js),
    // which says which domain was visited. It only ever chooses the store page over the app.
    const shop = pageForHost(req.headers.host) === 'store' || !!req.headers['x-aquenora-shop-domain'];
    // app.aquenora.com/interview: the seller interview (market research).
    const interview = !shop && /^\/interview\/?$/.test(url.pathname);
    // app.aquenora.com/privacy, /support and /seller-agreement: public pages (linked from the App Store listing and Settings).
    const info = !shop && url.pathname.match(/^\/(privacy|support|seller-agreement|help)\/?$/)?.[1];
    const page = join(DIST, shop ? 'store.html' : interview ? 'interview.html' : info ? `${info}.html` : 'index.html');

    // On a shop subdomain every page path shows the store; real files (assets) are still served.
    const file = await fileFor(url.pathname === '/' ? '/__none__' : url.pathname);
    if (file && !(shop && file.endsWith('.html'))) return send(req, res, file);

    // Paths that look like files but don't exist are real 404s; anything else is a page
    // (on a shop's address, .html requests always get the store page).
    if (extname(url.pathname) && !(shop && extname(url.pathname) === '.html')) {
      res.writeHead(404, { ...securityHeaders(req), 'Content-Type': 'text/plain' });
      return res.end('Not found');
    }
    if (shop) {
      const html = await storePageWithPreview(req, url, page).catch(() => null);
      if (html) {
        const body = Buffer.from(html);
        const useGz = /\bgzip\b/.test(req.headers['accept-encoding'] ?? '');
        const out = useGz ? gzipSync(body) : body;
        res.writeHead(200, {
          ...securityHeaders(req),
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-cache',
          Vary: 'Accept-Encoding',
          ...(useGz ? { 'Content-Encoding': 'gzip' } : {}),
          'Content-Length': out.length,
        });
        return res.end(req.method === 'HEAD' ? undefined : out);
      }
    }
    return send(req, res, page);
  } catch (err) {
    console.error(err);
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Server error');
  }
});

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  server.listen(PORT, () => console.log(`AQUENORA web on :${PORT}${ROOT_DOMAIN ? ` (stores at *.${ROOT_DOMAIN})` : ''}`));
}
