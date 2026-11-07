// Production web server for the AQENORA seller app and store pages. No dependencies.
//
//   app.<ROOT_DOMAIN>, www.<ROOT_DOMAIN>, <ROOT_DOMAIN>  -> seller app (index.html)
//   <shop>.<ROOT_DOMAIN>                                  -> that shop's store page (store.html)
//   any other host (e.g. *.up.railway.app)                -> seller app; stores via /store.html?shop=<shop>
//
// Env: PORT (default 8080), ROOT_DOMAIN (e.g. aqenora.com; leave unset until the domain is live).

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const DIST = join(fileURLToPath(new URL('.', import.meta.url)), 'dist');
const PORT = Number(process.env.PORT) || 8080;
const ROOT_DOMAIN = (process.env.ROOT_DOMAIN ?? '').toLowerCase().replace(/^\.+|\.+$/g, '');
/** Subdomains that are never shop addresses. Shops can't take these names. */
const RESERVED = new Set(['app', 'www', 'api', 'admin', 'mail', 'static', 'cdn']);

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

/** The shop handle for a store subdomain, or '' for the seller app. */
export function shopFromHost(hostHeader, rootDomain = ROOT_DOMAIN) {
  if (!rootDomain || !hostHeader) return '';
  const host = hostHeader.toLowerCase().split(':')[0];
  if (!host.endsWith('.' + rootDomain)) return '';
  const sub = host.slice(0, -(rootDomain.length + 1));
  if (!/^[a-z0-9-]+$/.test(sub) || RESERVED.has(sub)) return '';
  return sub;
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

    const shop = shopFromHost(req.headers.host);
    const page = join(DIST, shop ? 'store.html' : 'index.html');

    // On a shop subdomain every page path shows the store; real files (assets) are still served.
    const file = await fileFor(url.pathname === '/' ? '/__none__' : url.pathname);
    if (file && !(shop && file.endsWith('.html'))) return send(req, res, file);

    // Paths that look like files but don't exist are real 404s; anything else is a page.
    if (extname(url.pathname)) {
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
  server.listen(PORT, () => console.log(`AQENORA web on :${PORT}${ROOT_DOMAIN ? ` (stores at *.${ROOT_DOMAIN})` : ''}`));
}
