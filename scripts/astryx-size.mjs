/**
 * Measure generated production JS/CSS (raw bytes + gzip).
 * Run with: node scripts/astryx-size.mjs dist
 * Read-only, no network calls or deployment.
 */
import {readdirSync, readFileSync} from 'node:fs';
import {join, relative} from 'node:path';
import {gzipSync} from 'node:zlib';

const dir = process.argv[2] ?? 'dist';
const assets = [];
function visit(folder) {
  for (const item of readdirSync(folder, {withFileTypes: true})) {
    const path = join(folder, item.name);
    if (item.isDirectory()) visit(path);
    else if (item.isFile() && /\.(?:js|css)$/.test(item.name)) {
      const bytes = readFileSync(path);
      assets.push({
        file: relative(dir, path),
        type: item.name.endsWith('.js') ? 'js' : 'css',
        bytes: bytes.length,
        gzipBytes: gzipSync(bytes, {level: 9}).length,
      });
    }
  }
}
visit(dir);
assets.sort((a, b) => a.file.localeCompare(b.file));
const totals = {
  js: {bytes: 0, gzipBytes: 0},
  css: {bytes: 0, gzipBytes: 0},
};
for (const asset of assets) {
  totals[asset.type].bytes += asset.bytes;
  totals[asset.type].gzipBytes += asset.gzipBytes;
}
process.stdout.write(JSON.stringify({totals, assets}, null, 2) + '\n');
