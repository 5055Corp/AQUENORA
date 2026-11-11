// Production web server for the AQUENORA seller app and store pages. No dependencies.
//
//   app.<ROOT_DOMAIN>, www.<ROOT_DOMAIN>, <ROOT_DOMAIN>  -> seller app (index.html)
//   <shop>.<ROOT_DOMAIN>                                  -> that shop's store page (store.html)
//   a seller's own domain (e.g. adirehouse.com)           -> store page; it asks the backend which shop
//   localhost, IPs, *.up.railway.app                      -> seller app; stores via /store.html?shop=<shop>
//
// Env: PORT (default 8080), ROOT_DOMAIN (e.g. aquenora.com; leave unset until the domain is live).

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
    // Hashed files in assets/ never change; pages must always be fresh so new deploys show up.
    'Cache-Control': isAsset ? 'public, max-age=31536000, immutable' : 'no-cache',
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
    const page = join(DIST, shop ? 'store.html' : 'index.html');

    // On a shop subdomain every page path shows the store; real files (assets) are still served.
    const file = await fileFor(url.pathname === '/' ? '/__none__' : url.pathname);
    if (file && !(shop && file.endsWith('.html'))) return send(req, res, file);

    // Paths that look like files but don't exist are real 404s; anything else is a page
    // (on a shop's address, .html requests always get the store page).
    if (extname(url.pathname) && !(shop && extname(url.pathname) === '.html')) {
      res.writeHead(404, { ...securityHeaders(req), 'Content-Type': 'text/plain' });
      return res.end('Not found');
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
