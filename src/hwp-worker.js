import init, { HwpDocument } from '../node_modules/@rhwp/core/rhwp.js';

const toPixels = value => value * 96 / 7200;
let ready;

function fragment(html) {
  const start = html.indexOf('<!--StartFragment-->');
  const end = html.indexOf('<!--EndFragment-->');
  if (start < 0 || end < start) throw new Error('HWP 변환 결과의 HTML 경계를 찾지 못했습니다.');
  return html.slice(start + 20, end).trim();
}

function tableHtml(doc, control, pageLeft) {
  const { para, controlIndex } = control;
  const bounds = JSON.parse(doc.getTableBBox(0, para, controlIndex));
  const dimensions = JSON.parse(doc.getTableDimensions(0, para, controlIndex));
  if (!Number.isFinite(bounds.width) || bounds.width <= 0 || bounds.width > 5000) {
    throw new Error(`문단 ${para + 1}의 표 폭을 확인할 수 없습니다.`);
  }
  let html = fragment(doc.exportControlHtml(0, para, '[]', controlIndex));
  if (!/<table\b/i.test(html)) throw new Error(`문단 ${para + 1}의 표를 내보내지 못했습니다.`);
  const left = bounds.x - pageLeft;
  if (!Number.isFinite(left) || left < -10 || left > 5000) throw new Error(`문단 ${para + 1}의 표 위치를 확인할 수 없습니다.`);
  html = html.replace(/(<table\b[^>]*\bstyle=")([^"]*)"/i,
    (_, opening, style) => `${opening}${style}width:${bounds.width.toFixed(2)}px;margin-left:${Math.max(0, left).toFixed(2)}px;"`);
  if (dimensions.colCount >= 50 && dimensions.cellCount >= 1000) {
    html = html.replaceAll('padding:1px 5px', 'padding:1px 4px');
  }
  return html;
}

function convert(bytes, format) {
  const doc = new HwpDocument(bytes);
  try {
    if (doc.getSectionCount() !== 1) throw new Error('여러 구역으로 된 HWP 문서는 아직 가져올 수 없습니다.');
    const page = JSON.parse(doc.getPageDef(0));
    const width = toPixels(page.width);
    const left = toPixels(page.marginLeft);
    const right = toPixels(page.marginRight);
    if (![width, left, right].every(Number.isFinite) || width < 200 || width > 5000
      || left < 0 || right < 0 || left + right >= width) throw new Error('HWP 용지 폭이나 여백을 확인할 수 없습니다.');

    const controls = new Map();
    const warnings = [];
    for (const control of JSON.parse(doc.getControls())) {
      if (control.list !== 0 || ['secd', 'cold', 'pgnp'].includes(control.ctrlId)) continue;
      if (control.ctrlId === 'foot') { warnings.push(`꼬리말을 가져오지 못했습니다 (문단 ${control.para + 1}).`); continue; }
      if (!['tbl', 'gso'].includes(control.ctrlId)) {
        if (control.ctrlId) warnings.push(`일부 개체(${control.ctrlId})를 가져오지 못했습니다 (문단 ${control.para + 1}).`);
        continue;
      }
      if (!controls.has(control.para)) controls.set(control.para, []);
      controls.get(control.para).push(control);
    }

    const blocks = [];
    let tableCount = 0;
    for (let para = 0; para < doc.getParagraphCount(0); para++) {
      const length = doc.getParagraphLength(0, para);
      const text = doc.getTextRange(0, para, 0, length);
      if (text.length !== length) throw new Error(`문단 ${para + 1}의 문자 길이가 맞지 않습니다.`);
      const objects = controls.get(para) || [];
      const positions = [...text.matchAll(/\ufffc/g)].map(match => match.index);
      if (positions.length && positions.length !== objects.length) {
        throw new Error(`문단 ${para + 1}의 개체 자리와 개체 수가 다릅니다.`);
      }
      const emit = control => {
        if (control.ctrlId === 'tbl') { blocks.push(tableHtml(doc, control, left)); tableCount++; }
        else {
          const html = fragment(doc.exportControlHtml(0, para, '[]', control.controlIndex));
          if (!/<img\b/i.test(html)) throw new Error(`문단 ${para + 1}의 그림을 내보내지 못했습니다.`);
          blocks.push(html);
        }
      };
      if (!positions.length) {
        for (const control of objects) emit(control);
        if (length) blocks.push(fragment(doc.exportSelectionHtml(0, para, 0, para, length)));
        else if (!objects.length) blocks.push('<p><br></p>');
        continue;
      }
      let start = 0;
      for (const [index, position] of positions.entries()) {
        if (position > start) blocks.push(fragment(doc.exportSelectionHtml(0, para, start, para, position)));
        emit(objects[index]);
        start = position + 1;
      }
      if (start < length) blocks.push(fragment(doc.exportSelectionHtml(0, para, start, para, length)));
    }
    const html = `<div style="width:${width.toFixed(2)}px;max-width:none;padding-left:${left.toFixed(2)}px;padding-right:${right.toFixed(2)}px;margin-left:auto;margin-right:auto">\n${blocks.join('\n')}\n</div>`;
    if ((html.match(/<table\b/gi) || []).length !== tableCount || html.includes('\ufffc')) {
      throw new Error('변환된 HTML의 표 개수나 본문 구조가 맞지 않습니다.');
    }
    return { format, html, table_count:tableCount, preview_text:JSON.parse(doc.getTextFileText()), warnings };
  } finally { doc.free(); }
}

self.onmessage = async ({ data }) => {
  try {
    const bytes = new Uint8Array(data);
    const format = bytes.slice(0, 8).every((value, index) => value === [208, 207, 17, 224, 161, 177, 26, 225][index])
      ? 'hwp5' : new TextDecoder().decode(bytes.slice(0, 17)) === 'HWP Document File' ? 'hwp3' : null;
    if (!format) throw new Error('HWP 5 또는 HWP 3.0 형식의 파일을 선택해 주세요.');
    ready ||= (async () => {
      const response = await fetch('../node_modules/@rhwp/core/rhwp_bg.wasm.gz');
      if (!response.ok) throw new Error('HWP 변환기를 내려받지 못했습니다.');
      const wasm = await new Response(response.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
      await init({ module_or_path:new Uint8Array(wasm) });
    })();
    await ready;
    self.postMessage({ result:convert(bytes, format) });
  } catch (error) {
    self.postMessage({ error:error instanceof Error ? error.message : 'HWP 변환에 실패했습니다.' });
  }
};
