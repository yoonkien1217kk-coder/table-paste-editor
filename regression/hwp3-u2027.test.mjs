import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { inflateRawSync } from 'node:zlib';
import test from 'node:test';
import init, { HwpDocument } from '@rhwp/core';
import { normalizeHwp3GraphicChars } from '../src/hwp3-graphic-char.mjs';

const source = process.env.HWP3_REGRESSION_FILE;
const expected = '□내화구조 및 불연\u2027준불연 또는 난연내장재의 것\n□그밖의 것';

test('HWP3 원본 0x3066을 5번째 표 8번째 셀의 U+2027로 보존한다', { skip: !source }, async () => {
  const bytes = await readFile(source);
  assert.ok(bytes.subarray(0, 24).toString().startsWith('HWP Document File V3.00'));
  const extra = bytes.readUInt16LE(30 + 126);
  const bodyStart = 30 + 128 + 1008 + extra;
  const body = bytes.subarray(bodyStart);
  const inflated = bytes[30 + 124] ? inflateRawSync(body, { info: true }) : null;
  const raw = inflated ? inflated.buffer : body;
  assert.ok(raw.includes(Buffer.from([0x65, 0xb5, 0x66, 0x30, 0x85, 0xba])), '원본 연·0x3066·준 코드가 있어야 합니다');

  await init({ module_or_path: await readFile(new URL('../node_modules/@rhwp/core/rhwp_bg.wasm', import.meta.url)) });
  const normalized = await normalizeHwp3GraphicChars(new Uint8Array(bytes));
  if (inflated) {
    assert.equal(Buffer.compare(Buffer.from(normalized.subarray(bodyStart + raw.length)), body.subarray(inflated.engine.bytesWritten)), 0,
      '압축 본문 뒤의 첨부 데이터를 보존해야 합니다');
  }
  const doc = new HwpDocument(normalized);
  const original = new HwpDocument(new Uint8Array(bytes));
  try {
    const tables = JSON.parse(doc.getControls()).filter(control => control.ctrlId === 'tbl');
    assert.equal(tables.length, 90);
    const { para, controlIndex } = tables[4];
    const cell = Array.from({ length: doc.getCellParagraphCount(0, para, controlIndex, 7) }, (_, paragraph) => {
      const length = doc.getCellParagraphLength(0, para, controlIndex, 7, paragraph);
      return doc.getTextInCell(0, para, controlIndex, 7, paragraph, 0, length);
    }).join('\n').trim();
    assert.equal(cell, expected);
    assert.equal(cell.codePointAt(cell.indexOf('불연') + 2), 0x2027);
    assert.ok(doc.exportControlHtml(0, para, '[]', controlIndex).includes('불연\u2027준불연'));

    const originalTables = JSON.parse(original.getControls()).filter(control => control.ctrlId === 'tbl');
    let cells = 0;
    for (let i = 0; i < tables.length; i++) {
      const before = originalTables[i];
      const after = tables[i];
      const dimensions = JSON.parse(doc.getTableDimensions(0, after.para, after.controlIndex));
      assert.deepEqual(dimensions, JSON.parse(original.getTableDimensions(0, before.para, before.controlIndex)));
      cells += dimensions.cellCount;
      for (let c = 0; c < dimensions.cellCount; c++) {
        assert.equal(doc.getCellInfo(0, after.para, after.controlIndex, c),
          original.getCellInfo(0, before.para, before.controlIndex, c));
        assert.equal(doc.getCellProperties(0, after.para, after.controlIndex, c),
          original.getCellProperties(0, before.para, before.controlIndex, c));
      }
    }
    assert.equal(cells, 7975);
    assert.equal(JSON.parse(doc.getTextFileText()).replaceAll('&#8231;', ''), JSON.parse(original.getTextFileText()));
  } finally {
    doc.free();
    original.free();
  }
});
