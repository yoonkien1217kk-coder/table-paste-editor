const item = (label, action) => ({ label, action });

export function tableMenu(inTable, copied = {}) {
  const edit = label => ({ label, disabled: !inTable });
  return [
    { label: '표', items: [] },
    { ...edit('셀'), items: [item('셀 속성', 'cell'), item('셀 병합', 'tablemerge'), item('셀 분할', 'tablesplitv')] },
    { ...edit('행'), items: [item('이전에 행 삽입', 'tableaddrowbefore'), item('다음에 행 삽입', 'tableaddrowafter'), item('행 삭제', 'tablebinrow'), item('행 속성', 'row'), item('행 잘라내기', 'cutrow'), item('행 복사', 'copyrow'), { ...item('이전에 행 붙여넣기', 'pasterowbefore'), disabled: !copied.row }, { ...item('다음에 행 붙여넣기', 'pasterowafter'), disabled: !copied.row }] },
    { ...edit('열'), items: [item('이전에 열 삽입', 'tableaddcolumnbefore'), item('다음에 열 삽입', 'tableaddcolumnafter'), item('열 삭제', 'tablebincolumn'), item('열 잘라내기', 'cutcolumn'), item('열 복사', 'copycolumn'), { ...item('이전에 열 붙여넣기', 'pastecolumnbefore'), disabled: !copied.column }, { ...item('다음에 열 붙여넣기', 'pastecolumnafter'), disabled: !copied.column }] },
    edit('표 속성'), edit('표 삭제')
  ];
}

export function normalizeLength(value) {
  const text = String(value).trim();
  if (!/^(?:0|(?:\d+(?:\.\d+)?|\.\d+)(?:px|pt|mm|cm|em|rem|%)?)$/i.test(text)) return null;
  return /(?:px|pt|mm|cm|em|rem|%)$/i.test(text) || text === '0' ? text : `${text}px`;
}

const icons = {
  table: '<rect x="3" y="4" width="18" height="16" rx="1"/><path d="M3 9h18M9 4v16M15 4v16M3 14h18"/>',
  cell: '<rect x="3" y="4" width="18" height="16"/><path d="M3 10h18M10 4v16M10 10h11"/>',
  row: '<rect x="3" y="4" width="18" height="16"/><path d="M3 10h18M3 15h18"/>',
  column: '<rect x="3" y="4" width="18" height="16"/><path d="M9 4v16M15 4v16"/>',
  properties: '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 9h8M8 13h8M8 17h5"/>',
  delete: '<path d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7M10 10v7m4-7v7"/>'
};
const icon = name => `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.properties}</svg>`;
const quickIcons = {
  table:'<rect x="3" y="4" width="18" height="16"/><path d="M3 9h18M9 4v16M15 4v16M3 14h18"/>',
  tablebin:'<rect x="4" y="4" width="16" height="16"/><path d="m9 9 6 6m0-6-6 6"/>',
  tableaddrowbefore:'<path d="M3 9h18M3 20h18M3 9v11M21 9v11M8 15h8M12 11v8M7 4h10"/>',
  tableaddrowafter:'<path d="M3 4h18M3 15h18M3 4v11M21 4v11M8 10h8M12 6v8M7 20h10"/>',
  tablebinrow:'<rect x="4" y="9" width="16" height="6" fill="currentColor" opacity=".16" stroke="none"/><rect x="3" y="3" width="18" height="18"/><path d="M3 9h4m10 0h4M3 15h4m10 0h4"/><path d="m9 9 6 6m0-6-6 6" stroke-width="2.8"/>',
  tableaddcolumnbefore:'<path d="M9 3v18M20 3v18M9 3h11M9 21h11M15 8v8m-4-4h8M4 7v10"/>',
  tableaddcolumnafter:'<path d="M4 3v18M15 3v18M4 3h11M4 21h11M10 8v8m-4-4h8M20 7v10"/>',
  tablebincolumn:'<rect x="9" y="4" width="6" height="16" fill="currentColor" opacity=".16" stroke="none"/><rect x="3" y="3" width="18" height="18"/><path d="M9 3v4m0 10v4M15 3v4m0 10v4"/><path d="m9 9 6 6m0-6-6 6" stroke-width="2.8"/>'
};
const submenuIcons = {
  ...quickIcons,
  cell:icons.properties,
  row:icons.properties,
  tablemerge:'<path d="M3 4h18v16H3zM3 12h18M12 4v4m0 8v4m-4-8h8"/>',
  tablesplitv:'<path d="M3 4h18v16H3zM12 4v16M8 12h8"/>',
  copyrow:'<rect x="5" y="8" width="15" height="12"/><path d="M3 5h15M7 12h11M7 16h11"/>',
  copycolumn:'<rect x="5" y="8" width="15" height="12"/><path d="M3 5h15M10 9v10m5-10v10"/>',
  cutrow:'<path d="M3 6h18M3 18h18M3 6v12M21 6v12M8 11l8 4m0-4-8 4"/>',
  cutcolumn:'<path d="M6 3v18M18 3v18M6 3h12M6 21h12M10 8l4 8m0-8-4 8"/>',
  pasterowbefore:'<path d="M5 9h14v12H5zM9 5h6M8 14h8M12 11v6"/>',
  pasterowafter:'<path d="M5 3h14v12H5zM9 19h6M8 9h8M12 6v6"/>',
  pastecolumnbefore:'<path d="M9 4h12v16H9zM4 9v6m10-7v8m-3-4h6"/>',
  pastecolumnafter:'<path d="M3 4h12v16H3zM20 9v6M8 8v8m-3-4h6"/>'
};
const submenuIcon = action => `<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${submenuIcons[action] || icons.properties}</svg>`;
const quickLabels = [
  ['table','표 속성'],['tablebin','표 삭제'],
  ['tableaddrowbefore','이전에 행 삽입'],['tableaddrowafter','다음에 행 삽입'],['tablebinrow','행 삭제'],
  ['tableaddcolumnbefore','이전에 열 삽입'],['tableaddcolumnafter','다음에 열 삽입'],['tablebincolumn','열 삭제']
];

const styles = ['선택…','실선','점선','파선','이중 실선','입체 테두리','돌출 테두리','셀 함몰','셀 돌출','없음','숨김'];
const cssStyles = ['', 'solid','dotted','dashed','double','groove','ridge','inset','outset','none','hidden'];
const aligns = ['없음','왼쪽 맞춤','가운데 맞춤','오른쪽 맞춤'];
const alignValues = ['', 'left','center','right'];

export function initTableTools(editor, toolbar, update, tooltip) {
  const menu = document.createElement('div');
  menu.className = 'table-tools-menu';
  menu.setAttribute('role', 'menu');
  menu.hidden = true;
  document.body.append(menu);
  const dialog = document.createElement('dialog');
  dialog.className = 'table-tools-dialog';
  document.body.append(dialog);
  const quickbar = document.createElement('div');
  quickbar.className = 'table-tools-quickbar';
  quickbar.setAttribute('role', 'toolbar');
  quickbar.setAttribute('aria-label', '표 빠른 도구');
  quickbar.hidden = true;
  for (const [action,label] of quickLabels) {
    const button=document.createElement('button');
    button.type='button';button.dataset.action=action;button.setAttribute('aria-label',label);
    button.innerHTML=`<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${quickIcons[action]}</svg>`;
    quickbar.append(button);
  }
  document.body.append(quickbar);
  let cell = null;
  let copiedRow = null;
  let copiedColumn = null;
  let rightClickSelection = [];
  let quickTable = null;

  function hideTableTooltip() { tooltip.hidden=true; }
  function showTableTooltip(event) {
    const button=event.target.closest?.('.table-tools-menu button,.table-tools-quickbar button');
    if (!button) return;
    const label=button.dataset.rows ? `${button.dataset.columns}열 ${button.dataset.rows}행 표 삽입` : button.getAttribute('aria-label');
    if (!label) return;
    tooltip.textContent=label;
    tooltip.hidden=false;
    const rect=button.getBoundingClientRect();
    tooltip.style.transform='translateX(-50%)';
    tooltip.style.left=`${Math.max(tooltip.offsetWidth/2+8,Math.min(innerWidth-tooltip.offsetWidth/2-8,rect.left+rect.width/2))}px`;
    tooltip.style.top=`${rect.top >= tooltip.offsetHeight+8 ? rect.top-tooltip.offsetHeight-6 : rect.bottom+6}px`;
  }
  function leaveTableTooltip(event) {
    const button=event.target.closest?.('.table-tools-menu button,.table-tools-quickbar button');
    if (button?.contains(event.relatedTarget)) return;
    hideTableTooltip();
  }
  for (const panel of [menu,quickbar]) {
    panel.addEventListener('pointerover',showTableTooltip);
    panel.addEventListener('pointerout',leaveTableTooltip);
    panel.addEventListener('focusin',showTableTooltip);
    panel.addEventListener('focusout',leaveTableTooltip);
  }

  function positionQuickbar() {
    if (!quickTable || !editor.editor.contains(quickTable)) { quickbar.hidden=true;quickTable=null;return; }
    const rect=quickTable.getBoundingClientRect();
    if (rect.bottom < 0 || rect.top > innerHeight) { quickbar.hidden=true;return; }
    quickbar.hidden=false;
    const width=quickbar.offsetWidth;
    quickbar.style.left=`${Math.max(8,Math.min(innerWidth-width-8,rect.left+rect.width/2-width/2))}px`;
    const below=rect.bottom+12+quickbar.offsetHeight <= innerHeight;
    quickbar.classList.toggle('above',!below);
    quickbar.style.top=`${below ? rect.bottom+12 : Math.max(8,rect.top-quickbar.offsetHeight-12)}px`;
  }
  function showQuickbar(target) { quickTable=target.closest('table');requestAnimationFrame(positionQuickbar); }
  function hideQuickbar() { quickbar.hidden=true;quickTable=null;hideTableTooltip(); }

  function activeCell() {
    if (cell && editor.editor.contains(cell)) return cell;
    const current = editor.s.current();
    const node = current?.nodeType === Node.ELEMENT_NODE ? current : current?.parentElement;
    const candidate = node?.closest?.('td,th');
    return candidate && editor.editor.contains(candidate) ? candidate : null;
  }
  function closeMenu() { menu.hidden = true; document.body.classList.remove('table-tools-open');hideTableTooltip(); }
  function changed() { editor.synchronizeValues(); update();requestAnimationFrame(positionQuickbar); }
  function command(name) {
    const target = activeCell();
    if (!target) return;
    const tableModule = editor.getInstance('Table', editor.o);
    const targetTable=target.closest('table');
    const selected=tableModule.getAllSelectedCells();
    if (!selected.some(td => td.closest('table') === targetTable)) {
      for (const td of selected) tableModule.removeSelection(td);
      tableModule.addSelection(target);
    }
    editor.execCommand(name, false, target.closest('table'));
    if (name === 'tablebin') hideQuickbar();
    editor.e.fire('hidePopup');
    changed();
  }
  function tableGrid() {
    const grid = document.createElement('div');
    grid.className = 'table-tools-grid';
    grid.setAttribute('role', 'grid');
    const label = document.createElement('div');
    label.className = 'table-tools-grid-size';
    label.textContent = '0 × 0';
    for (let rows = 1; rows <= 10; rows++) for (let columns = 1; columns <= 10; columns++) {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.rows = rows;
      button.dataset.columns = columns;
      button.setAttribute('aria-label', `${columns}열 ${rows}행`);
      grid.append(button);
    }
    grid.addEventListener('pointerover', event => {
      const current=event.target.closest?.('[data-rows][data-columns]');
      if (!current) return;
      const rows=+current.dataset.rows, columns=+current.dataset.columns;
      for (const button of grid.children) button.classList.toggle('selected',+button.dataset.rows <= rows && +button.dataset.columns <= columns);
      label.textContent=`${columns} × ${rows}`;
    });
    const wrapper=document.createElement('div');
    wrapper.append(grid,label);
    return wrapper;
  }
  function openMenu(x, y, targetCell) {
    cell = targetCell;
    menu.replaceChildren();
    const groups = tableMenu(!!cell, { row:!!copiedRow, column:!!copiedColumn });
    for (const [index, group] of groups.entries()) {
      const section = document.createElement('div');
      section.className = 'table-tools-group';
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'table-tools-entry';
      button.disabled = !!group.disabled;
      button.setAttribute('aria-label', ['표 삽입','셀 편집','행 편집','열 편집','표 속성','표 삭제'][index]);
      button.innerHTML = `${index === 0 || index === 5 ? icon(index === 0 ? 'table' : 'delete') : '<span class="table-tools-icon-space" aria-hidden="true"></span>'}<span>${group.label}</span>${group.items ? '<span class="table-tools-chevron" aria-hidden="true">›</span>' : ''}`;
      if (!group.items) button.dataset.action = index === 4 ? 'table' : 'tablebin';
      section.append(button);
      if (group.items) {
        const submenu = document.createElement('div');
        submenu.className = 'table-tools-submenu';
        submenu.setAttribute('role', 'menu');
        if (index === 0) submenu.append(tableGrid());
        for (const entry of group.items) {
          const child = document.createElement('button');
          child.type = 'button';
          child.innerHTML = `${submenuIcon(entry.action)}<span>${entry.label}</span>`;
          child.setAttribute('aria-label',entry.label);
          child.dataset.action = entry.action;
          child.disabled = !!group.disabled || !!entry.disabled || (entry.action === 'tablemerge' && editor.getInstance('Table', editor.o).getAllSelectedCells().length < 2) || (entry.action === 'tablesplitv' && cell?.colSpan === 1 && cell?.rowSpan === 1);
          submenu.append(child);
        }
        section.append(submenu);
        button.addEventListener('click', () => section.classList.toggle('open'));
      }
      menu.append(section);
    }
    menu.hidden = false;
    document.body.classList.add('table-tools-open');
    menu.style.left = `${Math.max(8,Math.min(x, innerWidth - menu.offsetWidth - 8))}px`;
    menu.style.top = `${Math.max(8,Math.min(y, innerHeight - menu.offsetHeight - 8))}px`;
    menu.classList.toggle('submenus-left', x + menu.offsetWidth + 172 > innerWidth);
    editor.e.fire('hidePopup');
  }
  function field(label, key, value = '', kind = 'text', options = []) {
    const wrapper = document.createElement('label');
    wrapper.className = 'table-tools-field';
    wrapper.textContent = label;
    const input = document.createElement(kind === 'select' ? 'select' : 'input');
    input.name = key;
    if (kind === 'select') {
      for (const [i, name] of options.entries()) {
        const option = document.createElement('option');
        option.value = String(i); option.textContent = name;
        input.append(option);
      }
      input.value = String(Math.max(0, options.indexOf(value)));
    } else if (kind === 'check') { input.type = 'checkbox'; input.checked = !!value; }
    else if (kind === 'color') {
      input.type = 'text'; input.value = value;
      input.placeholder = '#000000';
      const picker = document.createElement('input');
      picker.type = 'color'; picker.value = /^#[\da-f]{6}$/i.test(value) ? value : '#ffffff';
      picker.setAttribute('aria-label', `${label} 색상 선택`);
      picker.addEventListener('input', () => { input.value = picker.value; });
      const controls = document.createElement('div');
      controls.className = 'table-tools-color-controls';
      controls.append(input, picker);
      wrapper.append(controls);
      return wrapper;
    } else { input.type = 'text'; input.value = value; }
    wrapper.append(input);
    return wrapper;
  }
  function selectedValue(list, values, value) { return list[values.indexOf(value)] || list[0]; }
  function openProperties(kind) {
    const target = activeCell();
    if (!target) return;
    const table = target.closest('table');
    const row = target.parentElement;
    const element = kind === 'table' ? table : kind === 'row' ? row : target;
    const heading = { table:'표 속성', row:'행 속성', cell:'셀 속성' }[kind];
    const form = document.createElement('form');
    form.method = 'dialog';
    const tabs = document.createElement('div'); tabs.className = 'table-tools-tabs';
    const panels = ['일반','상세'].map((name, i) => {
      const button = document.createElement('button'); button.type = 'button'; button.textContent = name;
      button.className = i ? '' : 'selected'; tabs.append(button);
      const panel = document.createElement('div'); panel.className = 'table-tools-panel'; panel.hidden = !!i;
      button.addEventListener('click', () => { for (const b of tabs.children) b.classList.remove('selected'); button.classList.add('selected'); panels.forEach((p, j) => { p.hidden = j !== i; }); });
      return panel;
    });
    const general = panels[0], detail = panels[1];
    const style = element.style;
    if (kind === 'table') {
      general.append(field('너비','width',style.width || table.getAttribute('width') || ''),field('높이','height',style.height),field('셀 간격','cellSpacing',table.getAttribute('cellspacing') || ''),field('셀 안쪽 여백','cellPadding',table.getAttribute('cellpadding') || ''),field('테두리 두께','borderWidth',style.borderWidth || table.getAttribute('border') || ''),field('캡션 표시','caption',!!table.caption,'check'),field('정렬','align',selectedValue(aligns,alignValues,style.marginLeft === 'auto' && style.marginRight === 'auto' ? 'center' : table.getAttribute('align') || ''),'select',aligns));
    } else if (kind === 'row') {
      general.append(field('행 유형','rowType',row.parentElement.tagName === 'THEAD' ? '제목' : row.parentElement.tagName === 'TFOOT' ? '푸터' : '본문','select',['제목','본문','푸터']),field('정렬','align',selectedValue(aligns,alignValues,row.getAttribute('align') || style.textAlign),'select',aligns),field('높이','height',style.height));
    } else {
      general.append(field('너비','width',style.width),field('셀 유형','cellType',target.tagName === 'TH' ? '헤더 셀' : '셀','select',['셀','헤더 셀']),field('범위','scope',selectedValue(['없음','행','열','행 그룹','열 그룹'],['','row','col','rowgroup','colgroup'],target.getAttribute('scope') || ''),'select',['없음','행','열','행 그룹','열 그룹']),field('수평 정렬','align',selectedValue(aligns,alignValues,style.textAlign),'select',aligns),field('수직 정렬','valign',selectedValue(['없음','위쪽 맞춤','가운데 맞춤','아래 맞춤'],['','top','middle','bottom'],style.verticalAlign),'select',['없음','위쪽 맞춤','가운데 맞춤','아래 맞춤']));
    }
    if (kind === 'cell') detail.append(field('테두리 두께','borderWidth',style.borderWidth));
    detail.append(field('테두리 스타일','borderStyle',selectedValue(styles,cssStyles,style.borderStyle),'select',styles),field('테두리 색','borderColor',style.borderColor,'color'),field('배경 색','backgroundColor',style.backgroundColor,'color'));
    const initial = new Map([...general.querySelectorAll('input,select'),...detail.querySelectorAll('input,select')].filter(el => el.name).map(el => [el.name, el.type === 'checkbox' ? el.checked : el.value]));
    const footer = document.createElement('div'); footer.className = 'table-tools-actions';
    const cancel = document.createElement('button'); cancel.type='button'; cancel.textContent='취소'; cancel.addEventListener('click', () => dialog.close());
    const save = document.createElement('button'); save.type='submit'; save.textContent='저장';
    footer.append(cancel,save);
    const title = document.createElement('h2'); title.textContent=heading;
    form.append(title,tabs,...panels,footer);
    dialog.replaceChildren(form);
    form.addEventListener('input', event => { if (event.target instanceof HTMLInputElement) event.target.setCustomValidity(''); });
    form.addEventListener('submit', event => {
      event.preventDefault();
      const value = name => form.elements.namedItem(name)?.value;
      const modified = name => { const input = form.elements.namedItem(name); return input && (input.type === 'checkbox' ? input.checked : input.value) !== initial.get(name); };
      for (const name of ['width','height','borderWidth','cellSpacing','cellPadding']) if (modified(name) && value(name).trim() && !normalizeLength(value(name))) { const input=form.elements.namedItem(name); input.setCustomValidity('숫자 또는 %, px, pt, mm, cm, em, rem 단위를 입력해 주세요.'); input.reportValidity(); return; }
      for (const name of ['borderColor','backgroundColor']) if (modified(name) && value(name).trim() && !/^#[\da-f]{3}(?:[\da-f]{3})?$/i.test(value(name).trim())) { const input=form.elements.namedItem(name); input.setCustomValidity('HEX 색상 코드를 입력해 주세요.'); input.reportValidity(); return; }
      const length = name => { if (!modified(name)) return true; const raw = value(name).trim(); if (!raw) { element.style[name] = ''; return true; } const normalized = normalizeLength(raw); if (!normalized) { form.elements.namedItem(name).setCustomValidity('숫자 또는 %, px, pt, mm, cm, em, rem 단위를 입력해 주세요.'); form.elements.namedItem(name).reportValidity(); return false; } element.style[name] = normalized; return true; };
      if (!length('width') || !length('height') || !length('borderWidth')) return;
      if (kind === 'table') {
        if (modified('width')) table.style.maxWidth = /^\d+(?:\.\d+)?(?:px|pt|mm|cm|in)$/i.test(table.style.width) ? 'none' : '';
        for (const name of ['cellSpacing','cellPadding']) if (modified(name)) { const raw=value(name).trim(); const lengthValue=raw && normalizeLength(raw); if (lengthValue) table.setAttribute(name.toLowerCase(), lengthValue.replace(/px$/,'')); else table.removeAttribute(name.toLowerCase()); if (name === 'cellSpacing') { table.style.borderCollapse=raw && Number.parseFloat(raw) > 0 ? 'separate' : 'collapse'; table.style.borderSpacing=lengthValue || ''; } else for (const td of table.querySelectorAll('td,th')) td.style.padding=lengthValue || ''; }
        if (modified('borderWidth')) for (const td of table.querySelectorAll('td,th')) td.style.borderWidth=table.style.borderWidth;
        if (modified('caption')) { if (form.elements.namedItem('caption').checked && !table.caption) table.createCaption(); else if (!form.elements.namedItem('caption').checked) table.caption?.remove(); }
        if (modified('align')) { const align=alignValues[+value('align')]; table.style.marginLeft=align === 'center' || align === 'right' ? 'auto' : ''; table.style.marginRight=align === 'center' || align === 'left' ? 'auto' : ''; if (align) table.setAttribute('align',align); else table.removeAttribute('align'); }
      } else if (kind === 'row') {
        if (modified('rowType')) { const section=['THEAD','TBODY','TFOOT'][+value('rowType')]; let parent=[...table.children].find(el => el.tagName === section); if (!parent) { parent=document.createElement(section); if (section === 'THEAD') table.insertBefore(parent,table.tBodies[0] || table.tFoot); else table.append(parent); } parent.append(row); }
        if (modified('align')) { element.style.textAlign=alignValues[+value('align')]; }
      } else {
        let editedCell=target;
        if (modified('cellType')) { const replacement=document.createElement(+value('cellType') ? 'th' : 'td'); for (const attr of [...target.attributes]) replacement.setAttribute(attr.name,attr.value); replacement.replaceChildren(...target.childNodes); const tableModule=editor.getInstance('Table',editor.o); if (tableModule.getAllSelectedCells().includes(target)) tableModule.removeSelection(target); target.replaceWith(replacement); tableModule.addSelection(replacement); cell=replacement; }
        editedCell=cell;
        if (modified('scope')) { const scope=['','row','col','rowgroup','colgroup'][+value('scope')]; if (scope) cell.setAttribute('scope',scope); else cell.removeAttribute('scope'); }
        if (modified('align')) editedCell.style.textAlign=alignValues[+value('align')];
        if (modified('valign')) editedCell.style.verticalAlign=['','top','middle','bottom'][+value('valign')];
      }
      for (const name of ['borderStyle','borderColor','backgroundColor']) if (modified(name)) {
        const raw=value(name).trim();
        const styled=kind === 'cell' ? cell : element;
        if (name === 'borderStyle') styled.style.borderStyle=cssStyles[+raw];
        else if (!raw || /^#[\da-f]{3}(?:[\da-f]{3})?$/i.test(raw)) styled.style[name]=raw;
        else { form.elements.namedItem(name).setCustomValidity('HEX 색상 코드를 입력해 주세요.'); form.elements.namedItem(name).reportValidity(); return; }
        if (kind === 'table' && name !== 'backgroundColor') for (const td of table.querySelectorAll('td,th')) td.style[name]=styled.style[name];
      }
      dialog.close(); changed();
    });
    document.body.classList.add('table-tools-dialog-open');
    dialog.showModal();
  }
  dialog.addEventListener('close', () => document.body.classList.remove('table-tools-dialog-open'));
  function copyStructure(type, cut = false) {
    const target=activeCell(); if (!target) return;
    const table=target.closest('table');
    if ([...table.querySelectorAll('td,th')].some(td => td.rowSpan > 1 || (type === 'column' && td.colSpan > 1))) { alert('이 표의 병합 구조에서는 행·열 복사를 안전하게 처리할 수 없습니다.'); return; }
    const cleanClone = node => { const clone=node.cloneNode(true); clone.querySelectorAll('[data-jodit-temp]').forEach(marker => marker.remove()); return clone; };
    if (type === 'row') { copiedRow={row:cleanClone(target.parentElement),columns:editor.getInstance('Table',editor.o).getColumnsCount(table)}; if (cut) command('tablebinrow'); }
    else { const index=target.cellIndex; if ([...table.rows].some(row => row.cells.length <= index)) { alert('행마다 열 수가 달라 이 열을 복사할 수 없습니다.'); return; } copiedColumn=[...table.rows].map(row => cleanClone(row.cells[index])); if (cut) command('tablebincolumn'); }
  }
  function pasteStructure(type, after) {
    const target=activeCell(); if (!target) return;
    const table=target.closest('table');
    if (type === 'row' && copiedRow) {
      if (editor.getInstance('Table',editor.o).getColumnsCount(table) !== copiedRow.columns || [...table.querySelectorAll('td,th')].some(td => td.rowSpan > 1)) { alert('열 수 또는 병합 구조가 달라 행을 붙여넣을 수 없습니다.'); return; }
      target.parentElement[after ? 'after' : 'before'](copiedRow.row.cloneNode(true));
    }
    if (type === 'column' && copiedColumn) {
      if (table.rows.length !== copiedColumn.length || [...table.querySelectorAll('td,th')].some(td => td.rowSpan > 1 || td.colSpan > 1)) { alert('열 수 또는 병합 구조가 달라 붙여넣을 수 없습니다.'); return; }
      const index=target.cellIndex;
      [...table.rows].forEach((row,i) => row.cells[index][after ? 'after' : 'before'](copiedColumn[i].cloneNode(true)));
    }
    changed();
  }
  menu.addEventListener('click', event => {
    const gridCell=event.target.closest('[data-rows][data-columns]');
    if (gridCell) {
      const rows=+gridCell.dataset.rows, columns=+gridCell.dataset.columns;
      const html=`<table border="1" style="border-collapse:collapse;width:100%"><tbody>${Array.from({length:rows},()=>`<tr>${'<td style="border:1px solid #000"><br></td>'.repeat(columns)}</tr>`).join('')}</tbody></table><p><br></p>`;
      closeMenu(); editor.s.focus(); editor.s.insertHTML(html); changed(); return;
    }
    const action=event.target.closest('[data-action]')?.dataset.action;
    if (!action) return;
    closeMenu();
    if (['table','row','cell'].includes(action)) openProperties(action);
    else if (action === 'copyrow' || action === 'cutrow') copyStructure('row',action === 'cutrow');
    else if (action === 'copycolumn' || action === 'cutcolumn') copyStructure('column',action === 'cutcolumn');
    else if (action.startsWith('pasterow')) pasteStructure('row',action.endsWith('after'));
    else if (action.startsWith('pastecolumn')) pasteStructure('column',action.endsWith('after'));
    else if (action === 'tablesplitv' && activeCell()?.colSpan === 1 && activeCell()?.rowSpan > 1) command('tablesplitg');
    else command(action);
  });
  quickbar.addEventListener('pointerdown', event => event.preventDefault());
  quickbar.addEventListener('click', event => {
    const action=event.target.closest('[data-action]')?.dataset.action;
    if (!action) return;
    if (action === 'table') openProperties('table');
    else command(action);
  });
  editor.editor.addEventListener('contextmenu', event => {
    const target=event.target.closest?.('td,th');
    if (!target || !editor.editor.contains(target)) { closeMenu(); cell=null; return; }
    event.preventDefault(); event.stopPropagation();
    const tableModule=editor.getInstance('Table',editor.o);
    const sameTable=rightClickSelection.filter(selected => editor.editor.contains(selected) && selected.closest('table') === target.closest('table'));
    if (sameTable.includes(target) && sameTable.length > 1) {
      for (const selected of sameTable) if (!tableModule.getAllSelectedCells().includes(selected)) tableModule.addSelection(selected);
    }
    rightClickSelection=[];
    openMenu(event.clientX,event.clientY,target);
  });
  document.addEventListener('pointerdown', event => {
    if (event.button === 2 && editor.editor.contains(event.target)) rightClickSelection=editor.getInstance('Table',editor.o).getAllSelectedCells().slice();
  },true);
  editor.editor.addEventListener('pointerdown', event => { cell=event.target.closest?.('td,th') || null;if (cell) showQuickbar(cell);else hideQuickbar(); });
  editor.editor.addEventListener('keyup', () => {
    const current=editor.s.current();
    const node=current?.nodeType === Node.ELEMENT_NODE ? current : current?.parentElement;
    cell=node?.closest?.('td,th') || null;
    if (cell) showQuickbar(cell);else hideQuickbar();
  });
  toolbar.addEventListener('click', event => {
    if (!event.target.closest?.('[data-ref="table"]')) return;
    event.preventDefault(); event.stopImmediatePropagation();
    const rect=event.target.closest('[data-ref="table"]').getBoundingClientRect();
    openMenu(rect.left,rect.bottom,activeCell());
  },true);
  document.addEventListener('pointerdown', event => { if (!menu.hidden && !menu.contains(event.target) && !event.target.closest?.('#toolbar [data-ref="table"]')) closeMenu();if (!editor.editor.contains(event.target) && !quickbar.contains(event.target) && !menu.contains(event.target) && !toolbar.contains(event.target) && !dialog.contains(event.target)) hideQuickbar(); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape') closeMenu(); });
  addEventListener('resize',positionQuickbar);
  addEventListener('scroll',positionQuickbar,true);
}
