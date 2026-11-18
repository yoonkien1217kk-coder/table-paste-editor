const TAGS = new Set('p div span font br h1 h2 h3 h4 blockquote strong b em i u s sub sup ul ol li table thead tbody tfoot tr th td colgroup col caption a img hr'.split(' '));
const DROP = new Set('script style iframe object embed form input button select textarea svg math meta link audio video canvas template'.split(' '));
const STYLE_PROPERTIES = new Set('color background-color background-image border border-top border-right border-bottom border-left border-color border-width border-style border-collapse table-layout width height min-width max-width min-height max-height text-align vertical-align padding padding-top padding-right padding-bottom padding-left margin margin-top margin-right margin-bottom margin-left text-indent letter-spacing word-spacing font-weight font-style font-size font-family text-decoration line-height white-space'.split(' '));
const SAFE_STYLE = /^(?!.*(?:url\s*\(|expression\s*\(|@import|[{}<>])).{1,300}$/i;
const SAFE_DIMENSION = /^\d{1,4}(?:\.\d{1,2})?(?:px|pt|mm|cm|in|%|em|rem)?$/i;
const SAFE_COLOR = /^(?:#[0-9a-f]{3,8}|rgba?\([\d\s.,%]+\)|[a-z]{3,20})$/i;
const SAFE_ANCHOR = /^[a-z_][a-z0-9_.:-]{0,127}$/i;
let anchorBatch = 0;

function cleanStyles(style) {
  const safe = [];
  for (const property of STYLE_PROPERTIES) {
    const value = style.getPropertyValue(property).trim();
    if (!value || !SAFE_STYLE.test(value)) continue;
    if (property === 'background-image' && !/^linear-gradient\([a-z0-9#%.,()\s+\-]+\)(?:,\s*linear-gradient\([a-z0-9#%.,()\s+\-]+\))?$/i.test(value)) continue;
    if ((property.includes('color') || property === 'color') && !SAFE_COLOR.test(value)) continue;
    if ((property === 'width' || property === 'height' || property === 'min-width' || property === 'max-width')
      && !(property === 'max-width' && value === 'none') && !SAFE_DIMENSION.test(value)) continue;
    safe.push(`${property}: ${value}`);
  }
  return safe.join('; ');
}

function collectClassStyles(doc) {
  const styles = new Map();
  const sheets = [...doc.querySelectorAll('style')].slice(0, 20);
  let count = 0;
  for (const style of sheets) {
    const sheet = new CSSStyleSheet();
    try { sheet.replaceSync(style.textContent || ''); } catch { continue; }
    for (const rule of sheet.cssRules) {
      if (!(rule instanceof CSSStyleRule)) continue;
      if (++count > 2000) break;
      let nodes;
      try { nodes = doc.querySelectorAll(rule.selectorText); } catch { continue; }
      for (const node of nodes) {
        if (styles.size > 10000) break;
        const previous = styles.get(node) || '';
        styles.set(node, `${previous}; ${rule.style.cssText}`);
      }
    }
  }
  return styles;
}

function millimeters(node, property, classStyles) {
  if (!node) return NaN;
  const style = document.createElement('span').style;
  style.cssText = `${classStyles.get(node) || ''}; ${node.getAttribute('style') || ''}`;
  const value = style.getPropertyValue(property).trim();
  return /^\d+(?:\.\d+)?mm$/i.test(value) ? parseFloat(value) : NaN;
}

function isHwpPageTable(node, classStyles) {
  // A page-wide HWP table needs its own alignment when copied without the page wrapper.
  const page = node.closest('div.Section');
  const area = page?.querySelector('div.HeaderPageFooter');
  if (node.parentElement?.closest('table')) return false;
  // Chrome omits the Section ancestor when copying a full converted HWP page.
  if (!page || !area) return !!node.closest('div.Page') && millimeters(node, 'width', classStyles) >= 150;
  const contentWidth = millimeters(page, 'width', classStyles)
    - millimeters(area, 'margin-left', classStyles)
    - millimeters(area, 'margin-right', classStyles);
  return Number.isFinite(contentWidth) && Math.abs(millimeters(node, 'width', classStyles) - contentWidth) < 5;
}

function cleanNode(node, target, classStyles, anchors, assignedAnchors) {
  const out = target.ownerDocument;
  if (node.nodeType === Node.TEXT_NODE) { target.append(out.createTextNode(node.textContent || '')); return; }
  if (node.nodeType !== Node.ELEMENT_NODE) return;
  const tag = node.tagName.toLowerCase();
  if (DROP.has(tag)) return;
  const destination = TAGS.has(tag) ? out.createElement(tag === 'font' ? 'span' : tag) : out.createDocumentFragment();
  if (destination.nodeType === Node.ELEMENT_NODE) {
    const anchor = node.getAttribute('id') || (tag === 'a' ? node.getAttribute('name') : null);
    if (anchors.has(anchor) && !assignedAnchors.has(anchor)) {
      destination.id = anchors.get(anchor);
      assignedAnchors.add(anchor);
    }
    const sourceStyle = out.createElement('span').style;
    sourceStyle.cssText = `${classStyles.get(node) || ''}; ${node.getAttribute('style') || ''}`;
    const clean = cleanStyles(sourceStyle);
    if (clean) destination.setAttribute('style', clean);
    if (tag === 'font') {
      const color = node.getAttribute('color');
      const face = node.getAttribute('face');
      if (color && SAFE_COLOR.test(color)) destination.style.color = color;
      if (face && /^[a-zA-Z0-9가-힣\s,'"-]{1,80}$/.test(face)) destination.style.fontFamily = face;
    }

    if (tag === 'table') {
      if (/^\d+(?:\.\d+)?(?:px|pt|mm|cm|in)$/i.test(sourceStyle.width) && !sourceStyle.maxWidth) destination.style.maxWidth = 'none';
      if (node.getAttribute('data-hwp-page-table') === '1' || isHwpPageTable(node, classStyles)) {
        destination.setAttribute('data-hwp-page-table', '1');
        destination.style.marginLeft = 'auto';
        destination.style.marginRight = 'auto';
      }
      const border = Number(node.getAttribute('border'));
      if (Number.isInteger(border) && border > 0 && border <= 20) destination.setAttribute('border', String(border));
      if (node.hasAttribute('cellspacing')) destination.setAttribute('cellspacing', '0');
    }
    if (['table', 'td', 'th', 'col'].includes(tag)) {
      const width = node.getAttribute('width');
      if (width && SAFE_DIMENSION.test(width)) destination.setAttribute('width', width);
      const bgcolor = node.getAttribute('bgcolor');
      if (bgcolor && SAFE_COLOR.test(bgcolor) && !sourceStyle.backgroundColor) destination.style.backgroundColor = bgcolor;
    }
    if (tag === 'td' || tag === 'th') {
      if (node.getAttribute('data-word-frame-cell') === '1') destination.setAttribute('data-word-frame-cell', '1');
      for (const attr of ['colspan', 'rowspan']) {
        const value = Number(node.getAttribute(attr));
        if (Number.isInteger(value) && value > 1 && value <= 100) destination.setAttribute(attr, String(value));
      }
      const scope = node.getAttribute('scope');
      if (tag === 'th' && ['row', 'col', 'rowgroup', 'colgroup'].includes(scope)) destination.setAttribute('scope', scope);
      const headers = (node.getAttribute('headers') || '').split(/\s+/).filter(id => anchors.has(id)).map(id => anchors.get(id));
      if (headers.length) destination.setAttribute('headers', headers.join(' '));
    }
    if (tag === 'div' && node.getAttribute('data-word-frame-content') === '1') destination.setAttribute('data-word-frame-content', '1');
    if (tag === 'col' || tag === 'colgroup') {
      const span = Number(node.getAttribute('span'));
      if (Number.isInteger(span) && span > 1 && span <= 100) destination.setAttribute('span', String(span));
    }
    if (tag === 'a') {
      const href = node.getAttribute('href') || '';
      if (/^(https?:|mailto:)/i.test(href)) destination.setAttribute('href', href);
      else if (href.startsWith('#') && anchors.has(href.slice(1))) destination.setAttribute('href', `#${anchors.get(href.slice(1))}`);
    }
    if (tag === 'img') {
      const src = node.getAttribute('src') || '';
      if (/^https:\/\//i.test(src) || /^data:image\/(?:png|jpeg|webp|gif);base64,[a-z0-9+/=]+$/i.test(src)) destination.setAttribute('src', src);
      else return;
      destination.setAttribute('alt', node.getAttribute('alt') || '');
      for (const size of ['width', 'height']) {
        const value = node.getAttribute(size) || '';
        if (/^[1-9]\d{0,3}$/.test(value)) destination.setAttribute(size, value);
        else if (SAFE_DIMENSION.test(value)) destination.style.setProperty(size, value);
      }
    }
    if (node.hasAttribute('align') && ['left', 'right', 'center', 'justify'].includes(node.getAttribute('align').toLowerCase())) {
      destination.style.textAlign = node.getAttribute('align').toLowerCase();
    }
  }
  for (const child of node.childNodes) cleanNode(child, destination, classStyles, anchors, assignedAnchors);
  if (tag === 'p' && node.closest('div.Section') && /em$/i.test(destination.style.minHeight)) {
    const sizes = new Set([...destination.querySelectorAll('span')].map(span => span.style.fontSize).filter(Boolean));
    if (sizes.size === 1) destination.style.fontSize = [...sizes][0];
  }
  if (tag === 'td' && node.closest('div.Section') && parseFloat(node.style.height) <= 10
    && Number(node.getAttribute('colspan')) > 1 && node.textContent.trim().length > 100
    && destination.querySelectorAll('p').length >= 2) {
    // Preserve compact letter spacing in older converted HWP letterheads.
    for (const span of destination.querySelectorAll('p span')) {
      if (!span.style.letterSpacing) span.style.letterSpacing = '-1px';
    }
  }
  if ((tag === 'td' || tag === 'th') && !node.textContent.trim() && /^\d+(?:\.\d+)?mm$/i.test(node.style.height) && parseFloat(node.style.height) < 3) {
    for (const paragraph of destination.querySelectorAll('p')) {
      paragraph.style.minHeight = '0';
      paragraph.style.lineHeight = '0';
      paragraph.style.margin = '0';
    }
  }
  target.append(destination);
}

export function sanitizePastedHtml(html) {
  const parsed = new DOMParser().parseFromString(html, 'text/html');
  const classStyles = collectClassStyles(parsed);
  const anchors = new Map();
  const batch = ++anchorBatch;
  for (const node of parsed.body.querySelectorAll('[id],a[name]')) {
    const key = node.getAttribute('id') || node.getAttribute('name');
    if (key && TAGS.has(node.tagName.toLowerCase()) && SAFE_ANCHOR.test(key) && !anchors.has(key)) anchors.set(key, `paste-anchor-${batch}-${anchors.size + 1}`);
  }
  const output = document.implementation.createHTMLDocument('');
  const assignedAnchors = new Set();
  for (const node of parsed.body.childNodes) cleanNode(node, output.body, classStyles, anchors, assignedAnchors);
  // A standalone heading image can lose its paragraph alignment when copied
  // with a centered document table. Infer the shared center only in that case.
  const headingImage = parsed.body.firstElementChild;
  const documentTable = parsed.body.querySelector('table');
  const pastedImage = output.body.firstElementChild;
  if (headingImage?.tagName === 'IMG' && pastedImage?.tagName === 'IMG'
    && parsed.body.querySelectorAll('img').length === 1
    && parsed.body.querySelectorAll('table').length === 1
    && documentTable.style.marginLeft === 'auto' && documentTable.style.marginRight === 'auto'
    && !headingImage.hasAttribute('align') && !headingImage.style.float
    && !headingImage.style.marginLeft && !headingImage.style.marginRight) {
    const centered = output.createElement('div');
    centered.style.textAlign = 'center';
    output.body.replaceChild(centered, pastedImage);
    centered.append(pastedImage);
  }
  if (/mso-element:frame/i.test(html)) {
    const sourceTables = [...parsed.body.querySelectorAll('table')];
    const outputTables = [...output.body.querySelectorAll('table')];
    for (const [tableIndex, sourceTable] of sourceTables.entries()) {
      const outputTable = outputTables[tableIndex];
      if (!outputTable) continue;
      const frames = sourceTable.outerHTML.match(/mso-element:frame/gi) || [];
      const frameWidth = /mso-element-frame-width:\s*(\d+(?:\.\d+)?)pt/i.exec(sourceTable.outerHTML);
      if (frames.length >= 50 && frameWidth) {
        const points = Number(frameWidth[1]);
        if (points >= 100 && points <= 1000) {
          outputTable.style.width = `${(points * 4 / 3).toFixed(2)}px`;
          outputTable.style.maxWidth = 'none';
        }
      }
      const graphRowIndex = [...sourceTable.rows].findIndex(row =>
        /mso-row-margin-right/i.test(row.getAttribute('style') || '')
        && row.cells.length >= 3 && row.cells[0].querySelectorAll('p').length >= 20
        && row.cells[1].querySelectorAll('p').length >= 20);
      if (graphRowIndex < 0) continue;
      for (const [rowIndex, sourceRow] of [...sourceTable.rows].entries()) {
        const outputRow = outputTable.rows[rowIndex];
        if (!outputRow) continue;
        for (const [cellIndex, sourceCell] of [...sourceRow.cells].entries()) {
          if (!/mso-element:frame/i.test(sourceCell.outerHTML)
              && !(rowIndex === graphRowIndex && cellIndex < 2)) continue;
          const cell = outputRow.cells[cellIndex];
          if (!cell) continue;
          const wrapper = output.createElement('div');
          wrapper.setAttribute('data-word-frame-content', '1');
          while (cell.firstChild) wrapper.append(cell.firstChild);
          cell.append(wrapper);
          cell.setAttribute('data-word-frame-cell', '1');
        }
      }
      for (const paragraph of outputTable.querySelectorAll('p')) {
        if (paragraph.textContent.trim()) continue;
        paragraph.style.lineHeight = '0';
        paragraph.style.margin = '0';
        paragraph.style.fontSize = '0';
      }
    }
  }
  if (/mso-displayed-decimal-separator|mso-number-format|xmlns:x=/i.test(html)) {
    for (const table of output.body.querySelectorAll('table')) {
      if (table.hasAttribute('width')) table.style.maxWidth = 'none';
      const cells = [...table.querySelectorAll('td,th')];
      const horizontal = cells.filter(cell => ['solid', 'dashed', 'dotted', 'double'].includes(cell.style.borderTopStyle) || ['solid', 'dashed', 'dotted', 'double'].includes(cell.style.borderBottomStyle));
      if (horizontal.length < cells.length * .75) continue;
      for (const cell of horizontal) {
        if (['solid', 'dashed', 'dotted', 'double'].includes(cell.style.borderRightStyle)) continue;
        cell.style.borderRight = cell.style.borderTopStyle && cell.style.borderTopStyle !== 'none' ? cell.style.borderTop : cell.style.borderBottom;
      }
    }
  }
  // Word's tiny default table offset is relative to the document page, which
  // is absent when a table alone is copied. Center only that standalone table.
  const generator = parsed.querySelector('meta[name="Generator"]')?.getAttribute('content') || '';
  const sourceTable = parsed.body.querySelector('table');
  const pastedTable = output.body.firstElementChild;
  if (/^Microsoft Word\b/i.test(generator)
    && sourceTable && parsed.body.querySelectorAll('table').length === 1
    && pastedTable?.tagName === 'TABLE' && output.body.children.length === 1
    && !sourceTable.hasAttribute('align') && !sourceTable.style.float
    && (!sourceTable.style.marginLeft || /^\d+(?:\.\d+)?(?:pt|px)$/.test(sourceTable.style.marginLeft)
      && parseFloat(sourceTable.style.marginLeft) <= 3)
    && !sourceTable.style.marginRight) {
    pastedTable.style.marginLeft = 'auto';
    pastedTable.style.marginRight = 'auto';
  }
  // Chrome copies tables from an HWP-rendered page without the page wrappers.
  // Restore their shared content column so narrow tables keep their offsets.
  const hwpTables = [...parsed.body.querySelectorAll('table')];
  if (hwpTables.length && !parsed.body.querySelector('.Section')
    && parsed.body.querySelector('[class*="charshape-"]')
    && hwpTables.every(table => [...table.classList].some(name => /^borderfill-\d+$/.test(name))
      && /^\d+(?:\.\d+)?mm$/i.test(table.style.width))) {
    const columnWidth = Math.max(180, ...hwpTables.map(table => parseFloat(table.style.width) + 1));
    if (columnWidth <= 350) {
      const column = output.createElement('div');
      column.style.width = `${columnWidth.toFixed(2)}mm`;
      column.style.maxWidth = 'none';
      column.style.marginLeft = 'auto';
      column.style.marginRight = 'auto';
      while (output.body.firstChild) column.append(output.body.firstChild);
      output.body.append(column);
    }
  }
  // Polaris copies the document's tables and paragraphs, but omits the page
  // margins. Keep every table's own offset inside one centered content column.
  const polarisTables = [...parsed.body.children].filter(node => node.tagName === 'TABLE');
  if (parsed.body.firstElementChild?.hasAttribute('nativecopyid')
    && polarisTables.length >= 2 && parsed.body.children.length > polarisTables.length
    && polarisTables.every(table => /^\d+(?:\.\d+)?px$/i.test(table.style.width)
      && /^\d+(?:\.\d+)?mm$/i.test(table.style.marginLeft)
      && /^\d+(?:\.\d+)?mm$/i.test(table.style.marginRight)
      && parseFloat(table.style.marginLeft) <= 5 && parseFloat(table.style.marginRight) <= 5)) {
    const width = Math.max(...polarisTables.map(table => parseFloat(table.style.width)
      + (parseFloat(table.style.marginLeft) + parseFloat(table.style.marginRight)) * 96 / 25.4));
    const column = output.createElement('div');
    column.style.width = `${width.toFixed(2)}px`;
    column.style.maxWidth = 'none';
    column.style.marginLeft = 'auto';
    column.style.marginRight = 'auto';
    for (const paragraph of [...output.body.children].filter(node => node.tagName === 'P')) {
      if (paragraph.querySelector('img,br') || paragraph.textContent.replaceAll('\u00a0', '').trim()) continue;
      (paragraph.querySelector('span span') || paragraph).replaceChildren(output.createElement('br'));
    }
    while (output.body.firstChild) column.append(output.body.firstChild);
    output.body.append(column);
  }
  return output.body.innerHTML;
}

function escapeHtml(value) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

export function tsvToTable(text) {
  const rows = text.replace(/\r\n?/g, '\n').replace(/\n$/, '').split('\n').map(line => line.split('\t'));
  if (rows.length < 2 || Math.max(...rows.map(row => row.length)) < 2) return null;
  return `<table border="1"><tbody>${rows.map(row => `<tr>${row.map(cell => `<td>${escapeHtml(cell).replaceAll('\n', '<br>') || '<br>'}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
}
