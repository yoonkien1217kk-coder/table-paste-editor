import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeLength, tableMenu } from '../src/table-tools.mjs';

test('표 길이 입력은 유효한 CSS 길이만 받고 원본 단위를 보존한다', () => {
  assert.equal(normalizeLength('100%'), '100%');
  assert.equal(normalizeLength('12pt'), '12pt');
  assert.equal(normalizeLength('3.5mm'), '3.5mm');
  assert.equal(normalizeLength('8'), '8px');
  assert.equal(normalizeLength('calc(100% - 1px)'), null);
  assert.equal(normalizeLength('1px;background:red'), null);
});

test('표 메뉴는 표 안에서만 편집 항목을 활성화한다', () => {
  assert.equal(tableMenu(false).find(group => group.label === '표 속성').disabled, true);
  assert.equal(tableMenu(true).find(group => group.label === '표 속성').disabled, false);
  assert.deepEqual(tableMenu(true).find(group => group.label === '셀').items.map(item => item.label), ['셀 속성', '셀 병합', '셀 분할']);
  assert.equal(tableMenu(true).find(group => group.label === '열').items.length, 7);
});
