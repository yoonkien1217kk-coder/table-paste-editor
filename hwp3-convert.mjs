import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import init, { HwpDocument } from '@rhwp/core';
import { normalizeHwp3GraphicChars } from './src/hwp3-graphic-char.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const [source, output] = process.argv.slice(2);
if (!source || !output) throw new Error('사용법: node hwp3-convert.mjs INPUT OUTPUT_JSON');

function fragment(html) {
  const start = html.indexOf('<!--StartFragment-->');
  const end = html.indexOf('<!--EndFragment-->');
  if (start < 0 || end < start) throw new Error('rhwp HTML 조각 경계를 찾을 수 없습니다.');
  return html.slice(start + '<!--StartFragment-->'.length, end).trim();
}

const escapeHtml = text => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

const toPixels = hwpUnit => hwpUnit * 96 / 7200;

function sizeTable(html, document, paragraph, controlIndex, pageLeft) {
  const bounds = JSON.parse(document.getTableBBox(0, paragraph, controlIndex));
  const dimensions = JSON.parse(document.getTableDimensions(0, paragraph, controlIndex));
  if (!Number.isFinite(bounds.width) || bounds.width <= 0 || bounds.width > 5000) {
    throw new Error(`문단 ${paragraph + 1}의 표 폭을 확인할 수 없습니다.`);
  }
  const left = bounds.x - pageLeft;
  if (!Number.isFinite(left) || left < -10 || left > 5000) {
    throw new Error(`문단 ${paragraph + 1}의 표 가로 위치를 확인할 수 없습니다.`);
  }
  let sized = html.replace(/(<table\b[^>]*\bstyle=")([^"]*)"/i,
    (_, opening, style) => `${opening}${style}width:${bounds.width.toFixed(2)}px;margin-left:${Math.max(0, left).toFixed(2)}px;"`);
  if (sized === html) throw new Error(`문단 ${paragraph + 1}의 표 폭을 적용할 수 없습니다.`);
  // Dense graph grids have hundreds of empty columns. The exporter gives each
  // narrow cell 5px side padding, which alone expands the table beyond its HWP bbox.
  if (dimensions.colCount >= 50 && dimensions.cellCount >= 1000) {
    sized = sized.replaceAll('padding:1px 5px', 'padding:1px 4px');
  }
  return sized;
}

await init({ module_or_path: await fs.readFile(path.join(root, 'node_modules/@rhwp/core/rhwp_bg.wasm')) });
const doc = new HwpDocument(await normalizeHwp3GraphicChars(new Uint8Array(await fs.readFile(source))));
try {
  if (doc.getSectionCount() !== 1) throw new Error('여러 구역으로 된 HWP 3.0 문서는 아직 지원하지 않습니다.');
  const page = JSON.parse(doc.getPageDef(0));
  const pageWidth = toPixels(page.width);
  const pageLeft = toPixels(page.marginLeft);
  const pageRight = toPixels(page.marginRight);
  if (![pageWidth, pageLeft, pageRight].every(Number.isFinite)
    || pageWidth < 200 || pageWidth > 5000 || pageLeft < 0 || pageRight < 0
    || pageLeft + pageRight >= pageWidth) {
    throw new Error('HWP 3.0 용지 폭이나 좌우 여백을 확인할 수 없습니다.');
  }
  const controls = JSON.parse(doc.getControls());
  const byParagraph = new Map();
  const warnings = [];
  let hasFooter = false;
  for (const control of controls) {
    if (control.list !== 0) throw new Error(`중첩 컨트롤을 해석할 수 없습니다: ${control.ctrlId}`);
    if (control.ctrlId === 'foot') {
      hasFooter = true;
      continue;
    }
    if (control.ctrlId === 'secd' || control.ctrlId === 'cold') continue;
    if (control.ctrlId !== 'tbl') throw new Error(`지원하지 않는 HWP 3.0 개체입니다: ${control.ctrlId}`);
    if (!byParagraph.has(control.para)) byParagraph.set(control.para, []);
    byParagraph.get(control.para).push(control);
  }

  const blocks = [];
  let tableCount = 0;
  for (let paragraph = 0; paragraph < doc.getParagraphCount(0); paragraph++) {
    const length = doc.getParagraphLength(0, paragraph);
    const text = doc.getTextRange(0, paragraph, 0, length);
    if (text.length !== length) throw new Error(`문단 ${paragraph + 1}의 문자 길이가 맞지 않습니다.`);
    const placeholders = [...text.matchAll(/\ufffc/g)].map(match => match.index);
    const tables = byParagraph.get(paragraph) || [];
    if (placeholders.length !== tables.length) {
      throw new Error(`문단 ${paragraph + 1}의 표 자리 ${placeholders.length}개와 표 컨트롤 ${tables.length}개가 다릅니다.`);
    }
    if (!length) { blocks.push('<p><br></p>'); continue; }

    let start = 0;
    for (const [index, position] of placeholders.entries()) {
      if (position > start) {
        const html = fragment(doc.exportSelectionHtml(0, paragraph, start, paragraph, position));
        if (!html && text.slice(start, position).trim()) throw new Error(`문단 ${paragraph + 1}의 본문이 누락됐습니다.`);
        if (html) blocks.push(html);
      }
      const control = tables[index];
      const html = sizeTable(fragment(doc.exportControlHtml(0, paragraph, '[]', control.controlIndex)), doc, paragraph, control.controlIndex, pageLeft);
      if (!/<table\b/i.test(html)) throw new Error(`문단 ${paragraph + 1}의 표를 내보내지 못했습니다.`);
      blocks.push(html);
      tableCount++;
      start = position + 1;
    }
    if (start < length) {
      const html = fragment(doc.exportSelectionHtml(0, paragraph, start, paragraph, length));
      if (!html && text.slice(start).trim()) throw new Error(`문단 ${paragraph + 1}의 본문이 누락됐습니다.`);
      if (html) blocks.push(html);
    }
  }
  if (tableCount !== [...byParagraph.values()].reduce((count, list) => count + list.length, 0)) {
    throw new Error('표 컨트롤 일부가 본문에 배치되지 않았습니다.');
  }
  const footerTexts = [];
  if (hasFooter) {
    let imported = 0;
    for (const item of JSON.parse(doc.getHeaderFooterList(0, false, 0)).items || []) {
      if (item.isHeader) continue;
      const footer = JSON.parse(doc.getHeaderFooter(0, false, item.applyTo));
      if (!footer.ok || !footer.exists || typeof footer.text !== 'string' || !footer.text.trim()) continue;
      blocks.push(`<p style="text-align:center">${escapeHtml(footer.text.trim()).replaceAll('\n', '<br>')}</p>`);
      footerTexts.push(footer.text.trim());
      imported++;
    }
    warnings.push(imported
      ? '꼬리말 글자는 문서 끝에 한 번 표시했습니다. 페이지별 반복 배치는 재현하지 않았습니다.'
      : '꼬리말 글자를 가져오지 못했습니다.');
  }
  const html = `<div style="width:${pageWidth.toFixed(2)}px; max-width:none; padding-left:${pageLeft.toFixed(2)}px; padding-right:${pageRight.toFixed(2)}px; margin-left:auto; margin-right:auto">\n${blocks.join('\n')}\n</div>`;
  if ((html.match(/<table\b/gi) || []).length !== tableCount || html.includes('\ufffc')) {
    throw new Error('변환된 HTML에 표 개수 차이 또는 개체 자리 표시자가 남았습니다.');
  }
  const packageInfo = JSON.parse(await fs.readFile(path.join(root, 'node_modules/@rhwp/core/package.json'), 'utf8'));
  await fs.writeFile(output, JSON.stringify({
    format: 'hwp3', html, preview_text: [JSON.parse(doc.getTextFileText()), ...footerTexts].join('\n'),
    table_count: tableCount, warnings, parser_version: packageInfo.version,
  }), 'utf8');
} finally {
  doc.free();
}
