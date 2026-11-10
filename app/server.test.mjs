// Tests for server.mjs. Run: npm run build && npm run test:server
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { request } from 'node:http';

process.env.ROOT_DOMAIN = 'aqenora.com';
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
  assert.equal(pageForHost('aqenora.com'), 'app');
  assert.equal(pageForHost('app.aqenora.com'), 'app');
  assert.equal(pageForHost('www.aqenora.com'), 'app');
  assert.equal(pageForHost('api.aqenora.com'), 'app');
  assert.equal(pageForHost('adirehouse.aqenora.com'), 'store');
  assert.equal(pageForHost('ADIREHOUSE.aqenora.com:443'), 'store');
  assert.equal(pageForHost('stores.aqenora.com'), 'store');
  assert.equal(pageForHost('www.adirehouse.com'), 'store');
  assert.equal(pageForHost('aqenora-web.up.railway.app'), 'app');
  assert.equal(pageForHost('localhost:8080'), 'app');
  assert.equal(pageForHost('10.0.0.5'), 'app');
  assert.equal(pageForHost('adirehouse.com', ''), 'app'); // no ROOT_DOMAIN set: everything is the seller app
});

test('serves the seller app and store pages by address', async () => {
  const app = await get('/', 'app.aqenora.com');
  assert.equal(app.status, 200);
  assert.match(app.body, /<title>AQENORA: Seller<\/title>/);
  assert.equal(app.headers['cache-control'], 'no-cache');
  assert.equal(app.headers['x-frame-options'], 'DENY');

  const shop = await get('/', 'adirehouse.aqenora.com');
  assert.match(shop.body, /<title>AQENORA store<\/title>/);
  const deep = await get('/some/page', 'www.adirehouse.com');
  assert.match(deep.body, /<title>AQENORA store<\/title>/);
  // A shop address never serves the seller app, even when asked for index.html directly.
  const sneaky = await get('/index.html', 'adirehouse.aqenora.com');
  assert.match(sneaky.body, /<title>AQENORA store<\/title>/);
});

test('assets, 404s, health, compression, HTTPS header and path tricks', async () => {
  const health = await get('/health', 'x');
  assert.equal(health.status, 200);
  assert.equal((await get('/assets/nope.js', 'app.aqenora.com')).status, 404);
  assert.equal((await get('/../server.mjs', 'app.aqenora.com')).status, 404);
  assert.equal((await get('/%2e%2e/server.mjs', 'app.aqenora.com')).status, 404);
  assert.equal((await get('/', 'app.aqenora.com', {}, 'POST')).status, 405);

  const html = await get('/', 'app.aqenora.com');
  const asset = html.body.match(/assets\/[^"]+\.js/)[0];
  const js = await get('/' + asset, 'app.aqenora.com', { 'accept-encoding': 'gzip' });
  assert.equal(js.status, 200);
  assert.equal(js.headers['content-encoding'], 'gzip');
  assert.equal(js.headers['cache-control'], 'public, max-age=31536000, immutable');

  const https = await get('/', 'app.aqenora.com', { 'x-forwarded-proto': 'https' });
  assert.match(https.headers['strict-transport-security'], /max-age=/);
  const head = await get('/', 'app.aqenora.com', {}, 'HEAD');
  assert.equal(head.status, 200);
  assert.equal(head.body, '');
});
