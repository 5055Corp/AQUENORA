// Live updates for the iPhone app: after `vite build`, packs dist/ into dist/live/<build>.zip and
// writes dist/live/manifest.json. The app checks the manifest on start and downloads newer bundles
// (JavaScript, styles and pictures only; anything native still needs an App Store update).
//
//   node scripts/live-bundle.mjs <build id> [min native version]
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { crc32, deflateRawSync } from 'node:zlib';

const DIST = new URL('../dist/', import.meta.url).pathname;
const build = process.argv[2];
const minNative = process.argv[3] ?? '1.2';
if (!/^\d{8,20}$/.test(build ?? '')) throw new Error('Usage: live-bundle.mjs <numeric build id>');

const files = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const rel = relative(DIST, full).split(sep).join('/');
    if (rel === 'live' || rel.startsWith('live/')) continue;
    if (statSync(full).isDirectory()) walk(full);
    else files.push([rel, readFileSync(full)]);
  }
})(DIST);

/** A plain .zip (deflate), built with Node's own zlib. */
function zip(entries) {
  const parts = [];
  const central = [];
  let offset = 0;
  for (const [name, data] of entries) {
    const n = Buffer.from(name);
    const packed = deflateRawSync(data, { level: 9 });
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x0800, 6); local.writeUInt16LE(8, 8);
    local.writeUInt32LE(crc, 14); local.writeUInt32LE(packed.length, 18); local.writeUInt32LE(data.length, 22); local.writeUInt16LE(n.length, 26);
    const head = Buffer.alloc(46);
    head.writeUInt32LE(0x02014b50, 0); head.writeUInt16LE(20, 4); head.writeUInt16LE(20, 6); head.writeUInt16LE(0x0800, 8); head.writeUInt16LE(8, 10);
    head.writeUInt32LE(crc, 16); head.writeUInt32LE(packed.length, 20); head.writeUInt32LE(data.length, 24); head.writeUInt16LE(n.length, 28);
    head.writeUInt32LE(offset, 42);
    parts.push(local, n, packed);
    central.push(head, n);
    offset += 30 + n.length + packed.length;
  }
  const dir = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(dir.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, dir, end]);
}

if (!files.some(([n]) => n === 'index.html')) throw new Error('dist/index.html is missing: run vite build first');
mkdirSync(join(DIST, 'live'), { recursive: true });
const name = `bundle-${build}.zip`;
writeFileSync(join(DIST, 'live', name), zip(files));
writeFileSync(join(DIST, 'live', 'manifest.json'), JSON.stringify({ version: build, url: `/live/${name}`, min_native: minNative }, null, 2));
console.log(`Live update ${build}: ${files.length} files → dist/live/${name}`);
