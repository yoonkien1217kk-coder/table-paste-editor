import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const output = path.join(root, 'dist');

test('Cloudflare 배포본은 브라우저 HWP 변환기를 포함하고 원본 문서를 제외한다', async () => {
  await import('../scripts/build-cloudflare.mjs');
  const files = [];
  const visit = (directory, prefix = '') => {
    for (const entry of readdirSync(directory, { withFileTypes:true })) {
      const name = path.posix.join(prefix, entry.name);
      if (entry.isDirectory()) visit(path.join(directory, entry.name), name);
      else files.push(name);
    }
  };
  visit(output);
  assert.deepEqual(files.sort(), [
    'JODIT-LICENSE.txt', 'RHWP-LICENSE.txt', 'RHWP-THIRD-PARTY-LICENSES.md', 'FFLATE-LICENSE.txt', 'emoji/LICENSE', 'emoji/emojis-ko.json', 'index.html',
    'node_modules/@rhwp/core/rhwp.js', 'node_modules/@rhwp/core/rhwp_bg.wasm.gz',
    'node_modules/fflate/esm/browser.js',
    'node_modules/jodit/es2021/jodit.min.css', 'node_modules/jodit/es2021/jodit.min.js',
    'src/app.js', 'src/hwp-worker.js', 'src/hwp3-graphic-char.mjs', 'src/large-draft.js', 'src/paste.js', 'style.css',
  ].sort());
  assert.match(readFileSync(path.join(output, 'index.html'), 'utf8'), /window\.EDITOR_HWP_IMPORT='browser'/);
  assert.ok(readFileSync(path.join(output, 'node_modules/@rhwp/core/rhwp_bg.wasm.gz')).byteLength < 25 * 1024 * 1024);
  assert.ok(!existsSync(path.join(output, 'results')));
  assert.ok(!existsSync(path.join(output, 'server.py')));
});
