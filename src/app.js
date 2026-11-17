import { sanitizePastedHtml, tsvToTable } from './paste.js?v=20261113-hwp-copy-align';
import { readLargeDraft, writeLargeDraft, deleteLargeDraft } from './large-draft.js';

const element = document.querySelector('#editor');
const status = document.querySelector('#status');
const stats = document.querySelector('#stats');
const source = document.querySelector('#html-source');
const imageFile = document.querySelector('#image-file');
const documentName = new URLSearchParams(location.search).get('document');
const previewFile = { 강사기본: '강사기본-pasted.html', 제279기: '제279기-pasted.html' }[documentName];
const testSession = new URLSearchParams(location.search).get('migration-test');
const storageKey = testSession ? `table-paste-editor-test-${testSession}` : `table-paste-editor-draft-v1${previewFile ? `-${documentName}` : ''}`;
let editor;
let previewBaseline = '';

function announce(message) { status.textContent = message; }
function currentHtml() { return source.hidden ? (editor?.value ?? element.innerHTML) : sanitizePastedHtml(source.value); }
let largeDraftTimer;
let pendingLargeDraft;
let largeDraftWrites = Promise.resolve();
function flushLargeDraft() {
  clearTimeout(largeDraftTimer);
  largeDraftTimer = undefined;
  if (pendingLargeDraft === undefined) return largeDraftWrites;
  const html = pendingLargeDraft;
  pendingLargeDraft = undefined;
  largeDraftWrites = largeDraftWrites.catch(() => {}).then(() => writeLargeDraft(storageKey, html));
  return largeDraftWrites;
}
function persistDraft(html, immediate = false) {
  try {
    localStorage.setItem(storageKey, html);
    clearTimeout(largeDraftTimer);
    largeDraftTimer = undefined;
    pendingLargeDraft = undefined;
    return Promise.resolve();
  } catch {
    try { localStorage.removeItem(storageKey); } catch {}
    pendingLargeDraft = html;
    if (immediate) return flushLargeDraft();
    clearTimeout(largeDraftTimer);
    largeDraftTimer = setTimeout(() => {
      void flushLargeDraft().catch(() => announce('자동 저장에 실패했습니다. HTML 파일로 저장해 주세요.'));
    }, 300);
    return Promise.resolve();
  }
}
function update() {
  const body = editor?.editor ?? element;
  stats.textContent = `${body.innerText.trim().length.toLocaleString()}자 · 표 ${body.querySelectorAll('table').length}개`;
  void persistDraft(currentHtml()).catch(() => announce('자동 저장에 실패했습니다. HTML 파일로 저장해 주세요.'));
}
function insertHtml(html, asDocument = false) {
  if (!source.hidden) {
    source.setRangeText(html, source.selectionStart, source.selectionEnd, 'end');
    source.dispatchEvent(new Event('input', { bubbles: true }));
    source.focus();
    return;
  }
  editor.s.focus();
  if ((asDocument || html.includes('data-hwp-page-table="1"')) && editor.s.current()?.closest?.('table')) {
    editor.editor.insertAdjacentHTML('beforeend', html);
    editor.synchronizeValues();
    update();
    return;
  }
  editor.s.insertHTML(html);
  update();
}
function insertPlainText(text) {
  const span = document.createElement('span');
  span.style.whiteSpace = 'pre-wrap';
  span.textContent = text;
  insertHtml(span.outerHTML);
}
function insertImageFile(file, range) {
  if (!/^image\/(?:png|jpeg|webp|gif)$/.test(file.type) || file.size > 2 * 1024 * 1024) {
    announce('2MB 이하의 PNG, JPEG, WebP 또는 GIF 이미지를 사용해 주세요.');
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    if (range && editor.editor.contains(range.commonAncestorContainer)) {
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
    }
    const image = document.createElement('img');
    image.src = String(reader.result);
    image.alt = file.name;
    insertHtml(image.outerHTML);
    announce('이미지를 삽입했습니다.');
  };
  reader.onerror = () => announce('이미지를 읽지 못했습니다.');
  reader.readAsDataURL(file);
}
function syncDecorationColors() {
  if (!editor) return;
  for (const decoration of editor.editor.querySelectorAll('u,s,strike,span[style*="text-decoration"]')) {
    const colors = new Set([...decoration.querySelectorAll('[style*="color"]')]
      .filter(node => node.style.color)
      .map(node => getComputedStyle(node).color));
    if (colors.size === 1) decoration.style.textDecorationColor = [...colors][0];
  }
}
function syncBlockFontSizes() {
  if (!editor) return;
  const range = window.getSelection()?.rangeCount ? window.getSelection().getRangeAt(0) : null;
  if (!range) return;
  for (const block of editor.editor.querySelectorAll('p,h1,h2,h3,li,td,th')) {
    if (!range.intersectsNode(block)) continue;
    const oldSize = parseFloat(getComputedStyle(block).fontSize);
    const lineHeight = parseFloat(getComputedStyle(block).lineHeight);
    const minHeight = parseFloat(getComputedStyle(block).minHeight);
    let textSize = 0;
    const texts = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
    while (texts.nextNode()) {
      const node = texts.currentNode;
      if (node.textContent.trim()) textSize = Math.max(textSize, parseFloat(getComputedStyle(node.parentElement).fontSize));
    }
    if (!textSize || textSize >= oldSize - 0.5) continue;
    block.style.fontSize = `${textSize}px`;
    if (/^\d+(?:\.\d+)?(?:px|pt)$/i.test(block.style.lineHeight) && Number.isFinite(lineHeight)) {
      block.style.lineHeight = `${lineHeight * textSize / oldSize}px`;
    }
    if (/^\d+(?:\.\d+)?(?:px|pt)$/i.test(block.style.minHeight) && Number.isFinite(minHeight)) {
      block.style.minHeight = `${minHeight * textSize / oldSize}px`;
    }
  }
}

let saved;
try { saved = localStorage.getItem(storageKey); }
catch { announce('브라우저 저장 공간을 사용할 수 없습니다. HTML 파일로 저장해 주세요.'); }
if (!saved) {
  try { saved = await readLargeDraft(storageKey); }
  catch { announce('브라우저 저장 공간을 사용할 수 없습니다. HTML 파일로 저장해 주세요.'); }
}
if (saved) element.innerHTML = sanitizePastedHtml(saved);
async function loadPreview() {
  announce(`${documentName} 변환본 불러오는 중...`);
  try {
    const response = await fetch(`./results/${previewFile}`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const html = sanitizePastedHtml(await response.text());
    if (editor) editor.value = html;
    else element.innerHTML = html;
    if (!source.hidden) source.value = editor?.value ?? html;
    update();
    previewBaseline = editor?.value ?? html;
    announce(`${documentName} HWP 변환본을 붙여넣은 결과입니다.`);
  } catch {
    announce('HWP 결과를 불러오지 못했습니다.');
  }
}
if (previewFile) {
  document.querySelector('#reload-preview').hidden = false;
  document.querySelector('#reload-preview').addEventListener('click', () => {
    if (editor && (source.hidden ? editor.value : source.value) !== previewBaseline) {
      editor.confirm('편집한 내용이 변환본으로 바뀝니다. 새로고침하시겠습니까?', '', confirmed => {
        if (confirmed) loadPreview();
      });
    } else loadPreview();
  });
  if (!saved) await loadPreview();
}

function bindContentEvents(content) {
content.addEventListener('copy', event => {
  const selection = window.getSelection();
  if (!editor || !event.clipboardData || !selection || selection.isCollapsed || !selection.rangeCount) return;
  const fragment = document.createElement('div');
  fragment.append(selection.getRangeAt(0).cloneContents());
  if (!fragment.querySelector('table[data-hwp-page-table="1"]')) return;
  event.clipboardData.setData('text/html', fragment.innerHTML);
  event.clipboardData.setData('text/plain', selection.toString());
  event.preventDefault();
});

content.addEventListener('paste', event => {
  const file = [...(event.clipboardData?.files || [])].find(item => item.name.toLowerCase().endsWith('.hwp'));
  if (file) { event.preventDefault(); event.stopImmediatePropagation(); importHwp(file); return; }
  const clipboardImage = [...(event.clipboardData?.items || [])]
    .find(item => item.kind === 'file' && /^image\/(?:png|jpeg|webp|gif)$/.test(item.type))?.getAsFile()
    || [...(event.clipboardData?.files || [])].find(item => /^image\/(?:png|jpeg|webp|gif)$/.test(item.type));
  const imageRange = clipboardImage && window.getSelection()?.rangeCount ? window.getSelection().getRangeAt(0).cloneRange() : null;
  const html = event.clipboardData?.getData('text/html');
  const text = event.clipboardData?.getData('text/plain') || '';
  if (!html && /^[a-z]:\\[^\r\n]+\.hwp$/i.test(text.trim())) {
    event.preventDefault();
    event.stopImmediatePropagation();
    announce('브라우저가 파일 경로만 전달했습니다. HWP 파일 가져오기 버튼이나 끌어다 놓기를 사용해 주세요.');
    return;
  }
  if (html) {
    const cleaned = sanitizePastedHtml(html);
    const content = new DOMParser().parseFromString(cleaned, 'text/html').body;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (!content.textContent.trim() && !content.querySelector('table,img,hr,br')) {
      if (clipboardImage && !/<img\b/i.test(html)) { insertImageFile(clipboardImage, imageRange); return; }
      if (text) insertPlainText(text);
      announce(text ? '클립보드 HTML에 내용이 없어 문장을 붙여넣었습니다.' : /<img\b/i.test(html) ? '이미지 주소를 사용할 수 없어 삽입하지 않았습니다.' : '붙여넣을 수 있는 내용이 없습니다.');
      return;
    }
    insertHtml(cleaned);
    const count = content.querySelectorAll('table').length;
    const rawImages = /<img\b/i.test(html) ? new DOMParser().parseFromString(html, 'text/html').querySelectorAll('img').length : 0;
    const removedImages = rawImages - content.querySelectorAll('img').length;
    announce(`${count ? `표 ${count}개를 구조와 주요 서식을 유지해 붙여넣었습니다.` : '문서 내용을 붙여넣었습니다.'}${removedImages > 0 ? ` 이미지 ${removedImages}개는 주소를 사용할 수 없어 제외했습니다.` : ''}`);
    return;
  }
  const table = tsvToTable(text);
  if (table) {
    event.preventDefault();
    event.stopImmediatePropagation();
    insertHtml(table);
    announce('탭으로 구분된 내용을 표로 붙여넣었습니다.');
    return;
  }
  if (clipboardImage) {
    event.preventDefault();
    event.stopImmediatePropagation();
    insertImageFile(clipboardImage, imageRange);
  }
}, true);
content.addEventListener('dragover', event => {
  if ([...(event.dataTransfer?.items || [])].some(item => item.kind === 'file')) event.preventDefault();
});
content.addEventListener('drop', event => {
  const file = [...(event.dataTransfer?.files || [])].find(item => item.name.toLowerCase().endsWith('.hwp'));
  if (file) { event.preventDefault(); event.stopImmediatePropagation(); importHwp(file); }
}, true);
}

let savedRange;
function rememberSelection() {
  const selection = window.getSelection();
  if (selection?.rangeCount && editor.editor.contains(selection.anchorNode)) savedRange = selection.getRangeAt(0).cloneRange();
}
function restoreSelection() {
  editor.s.focus();
  if (!savedRange) return;
  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(savedRange);
  savedRange = undefined;
}

const controls = window.Jodit.defaultOptions.controls;
controls.paragraph.list = { p:'단락', h1:'제목 1', h2:'제목 2', h3:'제목 3' };
controls.font.list = { 'Pretendard,sans-serif':'Pretendard', 'Malgun Gothic,sans-serif':'맑은 고딕', 'Noto Sans KR,sans-serif':'Noto Sans KR', 'Arial,sans-serif':'Arial', 'Batang,serif':'바탕', 'Hamchorom Dotum,sans-serif':'함초롬돋움' };
controls.fontsize.list = [8,9,10,11,12,14,16,18,20,24,28,36];
controls.lineHeight.list = [1,1.2,1.3,1.5,1.6,1.7,2,2.5,3];
function spacingAtCursor(kind) {
  const selected = window.getSelection()?.anchorNode;
  const current = selected && editor?.editor.contains(selected) ? selected : editor?.s.current();
  const element = current?.nodeType === Node.ELEMENT_NODE ? current : current?.parentElement;
  const target = element && editor.editor.contains(element) ? element : editor.editor;
  const styled = kind === 'lineHeight' ? target.closest('p,h1,h2,h3,li,td,th,div') || target : target;
  const style = getComputedStyle(styled);
  if (kind === 'letterSpacing') return Number.parseFloat(style.letterSpacing) || 0;
  return Number((Number.parseFloat(style.lineHeight) / Number.parseFloat(style.fontSize) || 1.6).toFixed(2));
}
controls.paragraph.textTemplate = (jodit, value) => Object.values(controls.paragraph.list).includes(value) ? value : '단락';
controls.fontsize.value = jodit => {
  const current = jodit.s.current();
  const element = current?.nodeType === Node.ELEMENT_NODE ? current : current?.parentElement;
  const target = element && jodit.editor.contains(element) ? element : jodit.editor;
  return String(Math.round(parseFloat(getComputedStyle(target).fontSize) * 0.75));
};
for (const [name, tooltip] of Object.entries({
  undo:'실행 취소', redo:'다시 실행', paragraph:'단락', font:'글꼴', fontsize:'글자 크기',
  bold:'굵게', italic:'기울임', underline:'밑줄', strikethrough:'취소선',
  image:'이미지 삽입', link:'링크 삽입', table:'표 삽입', align:'정렬',
  lineHeight:'줄 간격', ol:'번호 목록', ul:'글머리 목록', indent:'들여쓰기 늘리기',
  outdent:'들여쓰기 줄이기', symbols:'특수문자', eraser:'서식 지우기'
})) controls[name] = { ...controls[name], tooltip };
controls.ol = { ...controls.ol, icon:'olThreeRows', list:undefined, exec:undefined };
controls.ul = { ...controls.ul, list:undefined, exec:undefined };
function markInsertedTable(event) {
  if (event.type === 'keydown' && event.key !== 'Enter') return;
  if (!event.target.closest?.('.jodit-form__table-creator-box [role="gridcell"]')) return;
  const existing = new Set(editor.editor.querySelectorAll('table'));
  setTimeout(() => {
    const inserted = [...editor.editor.querySelectorAll('table')].find(table => !existing.has(table));
    if (!inserted) return;
    inserted.setAttribute('border', '1');
    for (const cell of inserted.querySelectorAll('td,th')) cell.style.border = '1px solid #000';
    editor.synchronizeValues();
    update();
  });
}
for (const eventName of ['mousedown', 'touchstart', 'keydown']) document.addEventListener(eventName, markInsertedTable, true);
window.Jodit.modules.Icon.set('textColor', '<svg viewBox="0 0 24 24"><path d="M12 3 5.5 17h2.3l1.4-3.4h5.6l1.4 3.4h2.3L12 3zm-2 8.6L12 6.8l2 4.8z"/><path data-color-indicator d="M5 21h14v-2H5z"/></svg>');
window.Jodit.modules.Icon.set('highlightColor', '<svg viewBox="0 0 24 24"><path d="m5 16 9-11 5 4-9 11H5zm1.5 1.5h2.8l7.1-8.7-2-1.6z"/><path data-color-indicator d="M3 22h18v-2H3z"/></svg>');
window.Jodit.modules.Icon.set('olThreeRows', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path data-number-row d="M9 5h12"/><path data-number-row d="M9 12h12"/><path data-number-row d="M9 19h12"/><g fill="currentColor" stroke="none" font-family="Arial,sans-serif" font-size="7" font-weight="600"><text x="2" y="7.5">1</text><text x="2" y="14.5">2</text><text x="2" y="21.5">3</text></g></svg>');
window.Jodit.modules.Icon.set('emoji', '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="9" cy="10" r="1"/><circle cx="15" cy="10" r="1"/><path d="M8 15c1 2 7 2 8 0" fill="none" stroke="currentColor" stroke-width="2"/></svg>');
window.Jodit.modules.Icon.set('letterSpacing', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 18 7 6l4 12M4.4 14h5.2M15 18l4-12 4 12M16.4 14h5.2M11 11h6m-6 0 2-2m-2 2 2 2m4-2-2-2m2 2-2 2"/></svg>');
controls.letterSpacing = {
  icon:'letterSpacing', tooltip:'자간', list:[-1,0,0.5,1,1.5,2,3,4],
  exec:(jodit, _event, { control }) => {
    const value = Number(control.args?.[0]);
    if (!Number.isFinite(value) || spacingAtCursor('letterSpacing') === value) return;
    jodit.s.commitStyle({ attributes:{ style:{ letterSpacing:`${value}px` } } });
    update();
  }
};
function applyColor(inputId, command, fromPicker = false) {
  if (fromPicker) restoreSelection();
  else editor.s.focus();
  editor.execCommand(command, false, document.querySelector(`#${inputId}`).value);
  update();
}
function colorControl(icon, tooltip, inputId, command) {
  return {
    icon, tooltip,
    exec: () => applyColor(inputId, command),
    popup: () => false
  };
}
controls.textColor = colorControl('textColor', '글자색', 'text-color', 'forecolor');
controls.highlightColor = colorControl('highlightColor', '배경색', 'background-color', 'background');
controls.emoji = { icon:'emoji', tooltip:'이모지', exec:() => openEmojiDialog() };

editor = window.Jodit.make('#editor', {
  language: 'ko',
  toolbar: '#toolbar',
  toolbarAdaptive: false,
  toolbarButtonSize: 'middle',
  showTooltip: false,
  minHeight: 470,
  enter: 'p',
  defaultFontSizePoints: 'pt',
  askBeforePasteHTML: false,
  showCharsCounter: false,
  showWordsCounter: false,
  showXPathInStatusbar: false,
  addNewLine: false,
  buttons: ['undo','redo','|',{ name:'paragraph', component:'select' },{ name:'font', component:'select' },{ name:'fontsize', component:'select' },'|','bold','italic','underline','strikethrough','textColor','highlightColor','\n','image','link','table','|','align','lineHeight','letterSpacing','|','ol','ul','indent','outdent','|','emoji','symbols','eraser']
});
window.editorInstance = editor;
const toolbar = document.querySelector('#toolbar');
let spacingBeforeMenu;
toolbar.addEventListener('click', event => {
  const button = event.target.closest?.('#toolbar [data-ref="letterSpacing"] .jodit-toolbar-button__button');
  if (!button) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  button.parentElement.querySelector('.jodit-toolbar-button__trigger')?.click();
}, true);
toolbar.addEventListener('pointerdown', event => {
  const ref = event.target.closest?.('#toolbar [data-ref]')?.dataset.ref;
  spacingBeforeMenu = ['lineHeight','letterSpacing'].includes(ref)
    ? { ref, value:spacingAtCursor(ref) } : undefined;
}, true);
const tooltip = document.createElement('div');
tooltip.className = 'editor-tooltip';
tooltip.role = 'tooltip';
tooltip.hidden = true;
document.body.append(tooltip);
let popupOwner = '';
const menuLabels = {
  center:'가운데 정렬', left:'왼쪽 정렬', right:'오른쪽 정렬', justify:'양쪽 정렬',
  brushCell:'셀 배경색', valign:'셀 내용 수직 정렬', splitv:'셀 분할', align:'셀 텍스트 정렬',
  deleteTable:'삭제 및 셀 비우기', tableaddrowbefore:'현재 행 위에 삽입', tableaddrowafter:'현재 행 아래에 삽입',
  tableaddcolumnbefore:'현재 열 왼쪽에 삽입', tableaddcolumnafter:'현재 열 오른쪽에 삽입'
};
const backgroundPicker = document.createElement('section');
backgroundPicker.className = 'background-picker';
backgroundPicker.id = 'background-picker';
backgroundPicker.setAttribute('role', 'dialog');
backgroundPicker.setAttribute('aria-label', '배경색 상세 선택');
backgroundPicker.hidden = true;
backgroundPicker.innerHTML = '<strong>배경색 상세 선택</strong><div class="background-picker-area" role="slider" tabindex="0" aria-label="채도와 밝기"><span class="background-picker-cursor"></span></div><label>색조<input class="background-picker-hue" type="range" min="0" max="360" value="0" aria-label="색조"></label><div class="background-picker-fields"><span class="background-picker-preview" aria-hidden="true"></span><label>HEX<input class="background-picker-hex" type="text" maxlength="7" spellcheck="false" aria-label="배경색 HEX 값"></label></div><div class="background-picker-actions"><button type="button" data-action="cancel">취소</button><button type="button" data-action="apply">적용</button></div>';
document.body.append(backgroundPicker);
const backgroundArea = backgroundPicker.querySelector('.background-picker-area');
const backgroundHue = backgroundPicker.querySelector('.background-picker-hue');
const backgroundHex = backgroundPicker.querySelector('.background-picker-hex');
let backgroundHsv = { h: 0, s: 0, v: 1 };
function hexToHsv(hex) {
  const [r, g, b] = [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16) / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), delta = max - min;
  let h = 0;
  if (delta) h = max === r ? ((g - b) / delta) % 6 : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4;
  return { h: (h * 60 + 360) % 360, s: max ? delta / max : 0, v: max };
}
function hsvToHex({ h, s, v }) {
  const c = v * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = v - c;
  const rgb = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return `#${rgb.map(channel => Math.round((channel + m) * 255).toString(16).padStart(2, '0')).join('')}`;
}
function renderBackgroundColor() {
  const hex = hsvToHex(backgroundHsv);
  backgroundArea.style.setProperty('--picker-hue', `hsl(${backgroundHsv.h} 100% 50%)`);
  backgroundArea.querySelector('.background-picker-cursor').style.cssText = `left:${backgroundHsv.s * 100}%;top:${(1 - backgroundHsv.v) * 100}%`;
  backgroundArea.setAttribute('aria-valuetext', `채도 ${Math.round(backgroundHsv.s * 100)}%, 밝기 ${Math.round(backgroundHsv.v * 100)}%`);
  backgroundHue.value = Math.round(backgroundHsv.h);
  backgroundHex.value = hex;
  backgroundPicker.querySelector('.background-picker-preview').style.backgroundColor = hex;
}
function closeBackgroundPicker() {
  backgroundPicker.hidden = true;
  document.querySelectorAll('#toolbar [data-ref="textColor"] .jodit-toolbar-button__button,#toolbar [data-ref="textColor"] .jodit-toolbar-button__trigger,#toolbar [data-ref="highlightColor"] .jodit-toolbar-button__trigger')
    .forEach(trigger => trigger.setAttribute('aria-expanded', 'false'));
}
function openBackgroundPicker(trigger) {
  closeBackgroundPicker();
  rememberSelection();
  const isTextColor = trigger.closest('[data-ref]')?.dataset.ref === 'textColor';
  const label = isTextColor ? '글자색' : '배경색';
  backgroundPicker.dataset.owner = isTextColor ? 'textColor' : 'highlightColor';
  backgroundPicker.dataset.inputId = isTextColor ? 'text-color' : 'background-color';
  backgroundPicker.setAttribute('aria-label', `${label} 상세 선택`);
  backgroundPicker.querySelector('strong').textContent = `${label} 상세 선택`;
  backgroundHex.setAttribute('aria-label', `${label} HEX 값`);
  backgroundHsv = hexToHsv(document.querySelector(`#${backgroundPicker.dataset.inputId}`).value);
  renderBackgroundColor();
  backgroundPicker.hidden = false;
  trigger.setAttribute('aria-expanded', 'true');
  trigger.setAttribute('aria-controls', backgroundPicker.id);
  const rect = trigger.getBoundingClientRect();
  backgroundPicker.style.left = `${Math.max(8, Math.min(innerWidth - backgroundPicker.offsetWidth - 8, rect.right + 8))}px`;
  backgroundPicker.style.top = `${rect.bottom + backgroundPicker.offsetHeight + 8 <= innerHeight ? rect.bottom + 8 : Math.max(8, rect.top - backgroundPicker.offsetHeight - 8)}px`;
}
function pickBackgroundPoint(event) {
  const rect = backgroundArea.getBoundingClientRect();
  backgroundHsv.s = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
  backgroundHsv.v = 1 - Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));
  renderBackgroundColor();
}
backgroundArea.addEventListener('pointerdown', event => { backgroundArea.setPointerCapture(event.pointerId); pickBackgroundPoint(event); });
backgroundArea.addEventListener('pointermove', event => { if (backgroundArea.hasPointerCapture(event.pointerId)) pickBackgroundPoint(event); });
backgroundArea.addEventListener('keydown', event => {
  const step = event.shiftKey ? 0.1 : 0.01;
  if (event.key === 'ArrowLeft') backgroundHsv.s = Math.max(0, backgroundHsv.s - step);
  else if (event.key === 'ArrowRight') backgroundHsv.s = Math.min(1, backgroundHsv.s + step);
  else if (event.key === 'ArrowUp') backgroundHsv.v = Math.min(1, backgroundHsv.v + step);
  else if (event.key === 'ArrowDown') backgroundHsv.v = Math.max(0, backgroundHsv.v - step);
  else return;
  event.preventDefault();
  renderBackgroundColor();
});
backgroundHue.addEventListener('input', () => { backgroundHsv.h = Number(backgroundHue.value); renderBackgroundColor(); });
backgroundHex.addEventListener('input', () => {
  if (!/^#[0-9a-f]{6}$/i.test(backgroundHex.value)) return;
  backgroundHsv = hexToHsv(backgroundHex.value);
  renderBackgroundColor();
});
backgroundPicker.addEventListener('click', event => {
  const action = event.target.closest('[data-action]')?.dataset.action;
  if (action === 'cancel') closeBackgroundPicker();
  if (action === 'apply') {
    if (!/^#[0-9a-f]{6}$/i.test(backgroundHex.value)) { backgroundHex.focus(); return; }
    const input = document.querySelector(`#${backgroundPicker.dataset.inputId}`);
    input.value = backgroundHex.value;
    input.dispatchEvent(new Event('change', { bubbles: true }));
    closeBackgroundPicker();
  }
});
function showToolbarTooltip(event) {
  const button = event.target.closest?.('#toolbar [data-ref][aria-label],.jodit-popup[data-editor_id="editor"] [data-ref],.jodit-popup[data-editor_id="editor"] [role="gridcell"]');
  if (!button) return;
  const inPopup = !!button.closest('.jodit-popup');
  const gridSize = button.matches('[role="gridcell"]') ? button.getAttribute('aria-label')?.match(/^(\d+) by (\d+)$/) : null;
  const itemText = button.querySelector('.jodit-toolbar-button__text')?.textContent.trim();
  const label = button.dataset.tooltip || (gridSize ? `${gridSize[1]}행 ${gridSize[2]}열 표 삽입`
    : inPopup ? (menuLabels[button.dataset.ref] || (popupOwner === 'lineHeight' ? `줄 간격 ${itemText || button.dataset.ref}` : popupOwner === 'letterSpacing' ? `자간 ${itemText || button.dataset.ref}px` : popupOwner === 'font' ? `글꼴 ${itemText || button.dataset.ref}` : popupOwner === 'fontsize' ? `글자 크기 ${itemText || button.dataset.ref}pt` : itemText || button.getAttribute('aria-label')))
    : button.getAttribute('aria-label'));
  if (!label) return;
  if (inPopup) {
    button.setAttribute('aria-label', label);
    button.querySelector('button')?.setAttribute('aria-label', label);
  }
  tooltip.textContent = label;
  tooltip.hidden = false;
  const rect = button.getBoundingClientRect();
  const inToolbar = !!button.closest('#toolbar');
  const popupRect = button.closest('.jodit-popup')?.getBoundingClientRect();
  tooltip.style.transform = inToolbar ? 'translateX(-50%)' : 'none';
  tooltip.style.left = inToolbar ? `${Math.max(tooltip.offsetWidth / 2 + 8, Math.min(innerWidth - tooltip.offsetWidth / 2 - 8, rect.left + rect.width / 2))}px`
    : popupRect ? `${popupRect.right + tooltip.offsetWidth + 8 <= innerWidth ? popupRect.right + 8 : Math.max(8, popupRect.left - tooltip.offsetWidth - 8)}px`
    : `${Math.min(innerWidth - tooltip.offsetWidth - 8, rect.right + 8)}px`;
  tooltip.style.top = inToolbar ? `${rect.top >= tooltip.offsetHeight + 8 ? rect.top - tooltip.offsetHeight - 6 : rect.bottom + 6}px` : `${Math.max(8, Math.min(innerHeight - tooltip.offsetHeight - 8, rect.top))}px`;
}
function hideToolbarTooltip(event) {
  const button = event.target.closest?.('#toolbar [data-ref],.jodit-popup[data-editor_id="editor"] [data-ref],.jodit-popup[data-editor_id="editor"] [role="gridcell"]');
  if (button && button.contains(event.relatedTarget)) return;
  tooltip.hidden = true;
}
toolbar.addEventListener('pointerover', showToolbarTooltip);
toolbar.addEventListener('click', event => {
  const trigger = event.target.closest?.('#toolbar [data-ref="textColor"] .jodit-toolbar-button__button,#toolbar [data-ref="textColor"] .jodit-toolbar-button__trigger,#toolbar [data-ref="highlightColor"] .jodit-toolbar-button__trigger');
  if (!trigger) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  const owner = trigger.closest('[data-ref]').dataset.ref;
  if (backgroundPicker.hidden || backgroundPicker.dataset.owner !== owner) openBackgroundPicker(trigger);
  else closeBackgroundPicker();
}, true);
toolbar.addEventListener('pointerout', hideToolbarTooltip);
toolbar.addEventListener('focusin', showToolbarTooltip);
toolbar.addEventListener('focusout', hideToolbarTooltip);
toolbar.addEventListener('click', event => {
  const button = event.target.closest?.('#toolbar [data-ref]');
  if (!button) return;
  closeBackgroundPicker();
  popupOwner = button.dataset.ref;
  const owner = popupOwner;
  const spacing = ['lineHeight','letterSpacing'].includes(owner)
    ? spacingBeforeMenu?.ref === owner ? spacingBeforeMenu.value : spacingAtCursor(owner) : null;
  spacingBeforeMenu = undefined;
  setTimeout(() => {
    if (button.isConnected && spacing === null) showToolbarTooltip({ target:button });
    if (spacing === null) return;
    tooltip.hidden = true;
    const popup = [...document.querySelectorAll('.jodit-popup[data-editor_id="editor"]')].find(node => node.getClientRects().length);
    if (!popup) return;
    const title = document.createElement('div');
    title.className = 'spacing-current';
    title.textContent = owner === 'lineHeight' ? `현재 줄 간격: ${spacing}배` : `현재 자간: ${spacing}px`;
    popup.querySelector('.jodit-popup__content')?.prepend(title);
    for (const item of popup.querySelectorAll('[role="listitem"]')) {
      const selected = Number(item.dataset.ref) === spacing;
      item.setAttribute('aria-current', String(selected));
    }
  }, 0);
}, true);
document.addEventListener('pointerover', event => {
  if (event.target.closest?.('.jodit-popup[data-editor_id="editor"]')) showToolbarTooltip(event);
});
document.addEventListener('pointerout', event => {
  if (event.target.closest?.('.jodit-popup[data-editor_id="editor"]')) hideToolbarTooltip(event);
});
document.addEventListener('focusin', event => {
  if (event.target.closest?.('.jodit-popup[data-editor_id="editor"]')) showToolbarTooltip(event);
});
document.addEventListener('click', event => {
  if (!backgroundPicker.contains(event.target) && !event.target.closest?.('#toolbar [data-ref="textColor"],#toolbar [data-ref="highlightColor"]')) closeBackgroundPicker();
});
document.addEventListener('keydown', event => { if (event.key === 'Escape') closeBackgroundPicker(); });
bindContentEvents(editor.editor);
editor.e.on('change', () => { syncDecorationColors(); update(); });
editor.e.on('afterCommand', command => {
  if (command?.toLowerCase() === 'fontsize') queueMicrotask(() => { syncBlockFontSizes(); update(); });
});
editor.editor.addEventListener('input', update);
if (previewFile) previewBaseline = editor.value;
editor.s.focus();
window.scrollTo(0, 0);
update();

for (const [inputId, command] of [['text-color','forecolor'], ['background-color','background']]) {
  const input = document.querySelector(`#${inputId}`);
  const button = document.querySelector(`[data-ref="${inputId === 'text-color' ? 'textColor' : 'highlightColor'}"]`);
  const showColor = () => button?.style.setProperty('--indicator-color', input.value);
  showColor();
  input.addEventListener('change', () => {
    showColor();
    applyColor(inputId, command, true);
  });
}

const emojiDialog = document.querySelector('#emoji-dialog');
const emojiGrid = document.querySelector('#emoji-grid');
const emojiSearch = document.querySelector('#emoji-search');
const emojiCategories = document.querySelector('#emoji-categories');
const categoryLabels = {
  all:'전체', people:'표정·사람', animals_and_nature:'동물·자연', food_and_drink:'음식',
  activity:'활동', travel_and_places:'여행·장소', objects:'사물', symbols:'기호', flags:'국기'
};
let activeEmojiCategory = 'all';
let emojiEntries;
function renderEmojiCategories() {
  const fragment = document.createDocumentFragment();
  for (const [category, label] of Object.entries(categoryLabels)) {
    const button = document.createElement('button');
    button.type = 'button';
    button.role = 'tab';
    button.dataset.category = category;
    button.textContent = label;
    button.setAttribute('aria-selected', String(category === activeEmojiCategory));
    fragment.append(button);
  }
  emojiCategories.replaceChildren(fragment);
}
function renderEmojis() {
  const query = emojiSearch.value.trim().toLocaleLowerCase('ko');
  const fragment = document.createDocumentFragment();
  for (const [name, data] of emojiEntries) {
    if (activeEmojiCategory !== 'all' && data.category !== activeEmojiCategory) continue;
    if (query && !`${name} ${(data.keywords || []).join(' ')}`.toLocaleLowerCase('ko').includes(query)) continue;
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = data.char;
    button.title = name;
    button.setAttribute('aria-label', name);
    button.dataset.char = data.char;
    fragment.append(button);
  }
  emojiGrid.replaceChildren(fragment);
}
async function openEmojiDialog() {
  rememberSelection();
  if (!emojiEntries) {
    const response = await fetch('./emoji/emojis-ko.json');
    if (!response.ok) { announce('이모지 목록을 불러오지 못했습니다.'); return; }
    emojiEntries = Object.entries(await response.json());
  }
  emojiSearch.value = '';
  activeEmojiCategory = 'all';
  renderEmojiCategories();
  renderEmojis();
  emojiDialog.showModal();
  emojiSearch.focus();
}
emojiSearch.addEventListener('input', renderEmojis);
emojiCategories.addEventListener('click', event => {
  const button = event.target.closest('button[data-category]');
  if (!button) return;
  activeEmojiCategory = button.dataset.category;
  renderEmojiCategories();
  renderEmojis();
  emojiGrid.scrollTop = 0;
});
emojiGrid.addEventListener('click', event => {
  const button = event.target.closest('button[data-char]');
  if (!button) return;
  emojiDialog.close();
  restoreSelection();
  editor.s.insertHTML(button.dataset.char);
  update();
});
document.querySelector('#emoji-close').addEventListener('click', () => emojiDialog.close());

imageFile.addEventListener('change', () => {
  const file = imageFile.files?.[0];
  if (!file) return;
  insertImageFile(file);
  imageFile.value = '';
});

document.querySelector('#sample').addEventListener('click', () => {
  insertHtml('<h2>문서 표 붙여넣기 예제</h2><p>병합 셀, 배경색, 테두리, 정렬을 확인해 보세요.</p><table border="1" style="border-collapse:collapse;width:100%"><tbody><tr><th colspan="3" style="background-color:#176b55;color:#ffffff;text-align:center">채용 요건</th></tr><tr><td style="background-color:#e7f4ed;font-weight:bold;width:24%">구분</td><td style="background-color:#e7f4ed;font-weight:bold">내용</td><td style="background-color:#e7f4ed;font-weight:bold">비고</td></tr><tr><td rowspan="2">지원 조건</td><td>변호사 자격</td><td style="text-align:center">필수</td></tr><tr><td>경력 3년 이상</td><td style="text-align:center">우대</td></tr></tbody></table><p><br></p>');
  announce('예제 표를 넣었습니다.');
});

const importButton = document.querySelector('#import-hwp');
const hwpFile = document.querySelector('#hwp-file');
const hwpImportAvailable = window.EDITOR_HWP_IMPORT !== false;
if (!hwpImportAvailable) {
  importButton.disabled = true;
  importButton.title = '이 미리보기에서는 HWP 파일 가져오기를 사용할 수 없습니다.';
  document.querySelector('.intro > p:last-child').textContent = '한글·Word·Excel·웹 문서에서 내용을 복사해 붙여넣어 보세요.';
  document.querySelector('.hint').textContent = 'HWP 파일 가져오기는 현재 로컬 버전에서 사용할 수 있습니다. 이 미리보기에서는 다른 문서에서 복사한 표와 본문을 붙여넣어 시험해 주세요.';
}
importButton.addEventListener('click', () => hwpFile.click());
hwpFile.addEventListener('change', () => {
  const file = hwpFile.files?.[0];
  if (file) importHwp(file);
});
async function importHwp(file) {
  if (!file) return;
  if (!hwpImportAvailable) {
    announce('이 미리보기에서는 HWP 파일 가져오기를 사용할 수 없습니다.');
    hwpFile.value = '';
    return;
  }
  if (!file.name.toLowerCase().endsWith('.hwp') || file.size > 10 * 1024 * 1024) {
    announce('10MB 이하의 .hwp 파일을 선택해 주세요.');
    hwpFile.value = '';
    return;
  }
  importButton.disabled = true;
  announce(`${file.name} 변환 중...`);
  try {
    let result;
    if (window.EDITOR_HWP_IMPORT === 'browser') {
      result = await new Promise(async (resolve, reject) => {
        const worker = new Worker(new URL('./hwp-worker.js', import.meta.url), { type:'module' });
        const timer = setTimeout(() => { worker.terminate(); reject(new Error('HWP 변환 시간이 초과됐습니다.')); }, 120000);
        const finish = () => { clearTimeout(timer); worker.terminate(); };
        worker.onmessage = ({ data }) => { finish(); data.error ? reject(new Error(data.error)) : resolve(data.result); };
        worker.onerror = () => { finish(); reject(new Error('HWP 변환기를 실행하지 못했습니다.')); };
        try { const bytes = await file.arrayBuffer(); worker.postMessage(bytes, [bytes]); }
        catch (error) { finish(); reject(error); }
      });
    } else {
      const response = await fetch('/api/import-hwp', { method: 'POST', body: file });
      result = await response.json();
      if (!response.ok) throw new Error(result.error || 'HWP 변환에 실패했습니다.');
    }
    const cleaned = sanitizePastedHtml(result.html);
    const incomingTables = new DOMParser().parseFromString(cleaned, 'text/html').querySelectorAll('table').length;
    if (window.EDITOR_HWP_IMPORT === 'browser' && (!Number.isInteger(result.table_count) || incomingTables !== result.table_count || cleaned.includes('\ufffc'))) {
      throw new Error('HWP 변환 후 표 개수나 본문 구조가 맞지 않아 삽입하지 않았습니다.');
    }
    if (result.format === 'hwp3') {
      if (!source.hidden) throw new Error('HWP 3.0 파일은 시각적 편집기에서 가져와 주세요.');
    }
    const before = result.format === 'hwp3' ? editor.value : '';
    const beforeTables = result.format === 'hwp3' ? editor.editor.querySelectorAll('table').length : 0;
    insertHtml(cleaned, true);
    if (result.format === 'hwp3' && editor.editor.querySelectorAll('table').length !== beforeTables + incomingTables) {
      editor.value = before;
      update();
      throw new Error('HWP 3.0 표가 편집기에 모두 들어가지 않아 기존 문서를 복원했습니다.');
    }
    let saveWarning = '';
    try { await persistDraft(currentHtml(), true); }
    catch { saveWarning = ' 자동 저장에 실패했습니다. HTML 파일로 저장해 주세요.'; }
    const textCheck = document.querySelector('#hwp-text-check');
    textCheck.hidden = !result.preview_text;
    document.querySelector('#hwp-text').textContent = result.preview_text || '';
    if (result.format === 'hwp3') {
      const warnings = (result.warnings || []).join(' ');
      announce(`HWP 3.0 시험 결과: 표 ${incomingTables}개. 원본과 대조가 필요합니다.${warnings ? ` 주의: ${warnings}` : ''}${saveWarning}`);
    } else announce(`${file.name}: 표 ${incomingTables}개를 가져왔습니다.${saveWarning}`);
  } catch (error) {
    announce(error instanceof Error ? error.message : 'HWP 파일을 가져오지 못했습니다.');
  } finally {
    importButton.disabled = false;
    hwpFile.value = '';
  }
}

document.querySelector('#source-toggle').addEventListener('click', event => {
  if (source.hidden) {
    source.value = currentHtml().trim() || '<p><br><br></p>';
    editor.container.hidden = true;
    document.querySelector('#toolbar').hidden = true;
    source.hidden = false;
    document.querySelector('.workspace').classList.add('code-mode');
    event.target.textContent = '시각적 편집기';
    source.focus();
  } else {
    editor.value = sanitizePastedHtml(source.value);
    source.hidden = true;
    editor.container.hidden = false;
    document.querySelector('#toolbar').hidden = false;
    document.querySelector('.workspace').classList.remove('code-mode');
    event.target.textContent = 'HTML 코드';
    update();
    editor.s.focus();
  }
});
source.addEventListener('input', () => {
  void persistDraft(source.value).catch(() => announce('자동 저장에 실패했습니다. HTML 파일로 저장해 주세요.'));
});
document.querySelector('#download').addEventListener('click', () => {
  const html = `<!doctype html><html lang="ko"><meta charset="utf-8"><title>편집 문서</title><style>body{font-family:Arial,sans-serif;line-height:1.6;margin:40px}table{border-collapse:collapse;max-width:100%}td,th{border:1px solid #777;padding:7px 10px}table:not([border]) td,table:not([border]) th{border:0}table[data-hwp-page-table="1"]{max-width:none;margin-left:auto;margin-right:auto}table[style*="width:"][style*="mm"]{max-width:none}</style>${currentHtml()}</html>`;
  const url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = '편집-문서.html';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  announce('HTML 파일을 저장했습니다.');
});
document.querySelector('#copy-html').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(currentHtml()); announce('HTML 코드를 복사했습니다.'); }
  catch { announce('클립보드 복사에 실패했습니다. 브라우저 권한을 확인해 주세요.'); }
});

const clearDialog = document.querySelector('#clear-dialog');
const clearConfirm = document.querySelector('#clear-confirm');
document.querySelector('#clear-all').addEventListener('click', () => clearDialog.showModal());
document.querySelector('#clear-cancel').addEventListener('click', () => clearDialog.close());
clearConfirm.addEventListener('click', async () => {
  clearConfirm.disabled = true;
  try {
    clearTimeout(largeDraftTimer);
    pendingLargeDraft = undefined;
    await largeDraftWrites.catch(() => {});
    await deleteLargeDraft(storageKey);
    editor.value = '<p><br></p>';
    source.value = '<p><br><br></p>';
    document.querySelector('#hwp-text-check').hidden = true;
    document.querySelector('#hwp-text').textContent = '';
    await persistDraft(currentHtml(), true);
    update();
    clearDialog.close();
    announce('편집 내용 전체를 삭제했습니다.');
    if (source.hidden) editor.s.focus();
    else source.focus();
  } catch {
    clearDialog.close();
    announce('전체 삭제에 실패했습니다. 다시 시도해 주세요.');
  } finally {
    clearConfirm.disabled = false;
  }
});
