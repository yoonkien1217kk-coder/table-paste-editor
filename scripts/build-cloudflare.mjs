import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const output = path.join(root, 'dist');
const staging = await fs.mkdtemp(path.join(root, '.cloudflare-build-'));
const files = [
  'JODIT-LICENSE.txt', 'RHWP-LICENSE.txt', 'RHWP-THIRD-PARTY-LICENSES.md', 'FFLATE-LICENSE.txt', 'emoji/LICENSE', 'emoji/emojis-ko.json',
  'node_modules/@rhwp/core/rhwp.js',
  'node_modules/fflate/esm/browser.js',
  'node_modules/jodit/es2021/jodit.min.css',
  'node_modules/jodit/es2021/jodit.min.js',
  'src/app.js', 'src/hwp-worker.js', 'src/hwp3-graphic-char.mjs', 'src/large-draft.js', 'src/paste.js', 'src/table-tools.mjs', 'style.css',
];

try {
  for (const file of files) {
    const destination = path.join(staging, file);
    await fs.mkdir(path.dirname(destination), { recursive:true });
    await fs.copyFile(path.join(root, file), destination);
  }
  const wasmPath = 'node_modules/@rhwp/core/rhwp_bg.wasm.gz';
  const wasmDestination = path.join(staging, wasmPath);
  await fs.mkdir(path.dirname(wasmDestination), { recursive:true });
  await fs.writeFile(wasmDestination, gzipSync(await fs.readFile(path.join(root, 'node_modules/@rhwp/core/rhwp_bg.wasm')), { level:9 }));
  const source = await fs.readFile(path.join(root, 'index.html'), 'utf8');
  const marker = '    <script type="module" src="./src/app.js?v=20261118-blank-input-left"></script>';
  if (!source.includes(marker)) throw new Error('편집기 스크립트 위치가 변경되어 배포 화면을 만들지 못했습니다.');
  await fs.writeFile(path.join(staging, 'index.html'), source.replace(marker,
    "    <script>window.EDITOR_HWP_IMPORT='browser'</script>\n" + marker));
  await fs.rm(output, { recursive:true, force:true });
  await fs.rename(staging, output);
  console.log(`Cloudflare 배포 파일 준비: ${output}`);
} catch (error) {
  await fs.rm(staging, { recursive:true, force:true });
  throw error;
}
