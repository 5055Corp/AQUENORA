// Tests for server.mjs. Run: npm run build && npm run test:server
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { request } from 'node:http';

process.env.ROOT_DOMAIN = 'aquenora.com';
const { server, pageForHost } = await import('./server.mjs');
let port;

before(() => new Promise(r => server.listen(0, () => { port = server.address().port; r(); })));
after(() => new Promise(r => server.close(r)));

function get(path, host, headers = {}, method = 'GET') {
  return new Promise((resolve, reject) => {
    const req = request({ port, path, method, headers: { host, ...headers } }, res => {
      let body = '';
      res.on('data', c => (body += c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
    });
    req.on('error', reject);
    req.end();
  });
}

test('which page each address shows', () => {
  assert.equal(pageForHost('aquenora.com'), 'app');
  assert.equal(pageForHost('app.aquenora.com'), 'app');
  assert.equal(pageForHost('www.aquenora.com'), 'app');
  assert.equal(pageForHost('api.aquenora.com'), 'app');
  assert.equal(pageForHost('adirehouse.aquenora.com'), 'store');
  assert.equal(pageForHost('ADIREHOUSE.aquenora.com:443'), 'store');
  assert.equal(pageForHost('stores.aquenora.com'), 'store');
  assert.equal(pageForHost('www.adirehouse.com'), 'store');
  assert.equal(pageForHost('aquenora-web.up.railway.app'), 'app');
  assert.equal(pageForHost('localhost:8080'), 'app');
  assert.equal(pageForHost('10.0.0.5'), 'app');
  assert.equal(pageForHost('adirehouse.com', ''), 'app'); // no ROOT_DOMAIN set: everything is the seller app
});

test('serves the seller app and store pages by address', async () => {
  const app = await get('/', 'app.aquenora.com');
  assert.equal(app.status, 200);
  assert.match(app.body, /<title>AQUENORA: Seller<\/title>/);
  assert.equal(app.headers['cache-control'], 'no-cache');
  assert.equal(app.headers['x-frame-options'], 'DENY');

  const shop = await get('/', 'adirehouse.aquenora.com');
  assert.match(shop.body, /<title>AQUENORA store<\/title>/);
  const deep = await get('/some/page', 'www.adirehouse.com');
  assert.match(deep.body, /<title>AQUENORA store<\/title>/);
  // A shop address never serves the seller app, even when asked for index.html directly.
  const sneaky = await get('/index.html', 'adirehouse.aquenora.com');
  assert.match(sneaky.body, /<title>AQUENORA store<\/title>/);
  // Through the Cloudflare Worker: Railway's own address, but a seller's domain was visited.
  const viaWorker = await get('/', 'web-production-1234.up.railway.app', { 'x-aquenora-shop-domain': 'www.adirehouse.com' });
  assert.match(viaWorker.body, /<title>AQUENORA store<\/title>/);
  assert.match((await get('/', 'web-production-1234.up.railway.app')).body, /<title>AQUENORA: Seller<\/title>/);
});

test('assets, 404s, health, compression, HTTPS header and path tricks', async () => {
  const health = await get('/health', 'x');
  assert.equal(health.status, 200);
  assert.equal((await get('/assets/nope.js', 'app.aquenora.com')).status, 404);
  assert.equal((await get('/../server.mjs', 'app.aquenora.com')).status, 404);
  assert.equal((await get('/%2e%2e/server.mjs', 'app.aquenora.com')).status, 404);
  assert.equal((await get('/', 'app.aquenora.com', {}, 'POST')).status, 405);

  const html = await get('/', 'app.aquenora.com');
  const asset = html.body.match(/assets\/[^"]+\.js/)[0];
  const js = await get('/' + asset, 'app.aquenora.com', { 'accept-encoding': 'gzip' });
  assert.equal(js.status, 200);
  assert.equal(js.headers['content-encoding'], 'gzip');
  assert.equal(js.headers['cache-control'], 'public, max-age=31536000, immutable');

  const https = await get('/', 'app.aquenora.com', { 'x-forwarded-proto': 'https' });
  assert.match(https.headers['strict-transport-security'], /max-age=/);
  const head = await get('/', 'app.aquenora.com', {}, 'HEAD');
  assert.equal(head.status, 200);
  assert.equal(head.body, '');
});
