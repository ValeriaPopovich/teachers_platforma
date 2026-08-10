const sectionConfig = {
  topics: { list: '#reportTopics', empty: 'Темы появятся из проведённых занятий или их можно добавить вручную.' },
  tests: { list: '#reportTests', empty: 'Проверочных за период пока нет. При необходимости добавьте работу вручную.' },
  hws: { list: '#reportHws', empty: 'Домашних заданий с оценкой за период пока нет. Их можно добавить вручную.' },
};

function plural(value, forms) {
  const n = Math.abs(Number(value) || 0) % 100;
  const n1 = n % 10;
  if (n > 10 && n < 20) return forms[2];
  if (n1 > 1 && n1 < 5) return forms[1];
  if (n1 === 1) return forms[0];
  return forms[2];
}

function countLabel(kind, count) {
  if (kind === 'topics') return `${count} ${plural(count, ['тема', 'темы', 'тем'])}`;
  if (kind === 'tests') return `${count} ${plural(count, ['работа', 'работы', 'работ'])}`;
  return `${count} ${plural(count, ['запись', 'записи', 'записей'])}`;
}

export function createReportInteractions({ page, onRowsChanged }) {
  if (!page) return { syncAll: () => {}, syncActionBar: () => {}, openSection: () => {} };
  const tools = page.querySelector('.report-tools');
  const previewColumn = page.querySelector('.report-preview-column');
  let draggedRow = null;
  let actionFrame = 0;

  function setSectionOpen(section, open, focus = false) {
    if (!section || section.hidden || section.style.display === 'none') return;
    const toggle = section.querySelector('.report-section-toggle');
    const panel = section.querySelector('.report-editor-panel');
    if (!toggle || !panel) return;
    if (open) {
      page.querySelectorAll('.report-editor-section').forEach((other) => {
        if (other === section) return;
        other.querySelector('.report-section-toggle')?.setAttribute('aria-expanded', 'false');
        const otherPanel = other.querySelector('.report-editor-panel');
        if (otherPanel) otherPanel.hidden = true;
        other.classList.remove('is-open');
      });
    }
    toggle.setAttribute('aria-expanded', String(open));
    panel.hidden = !open;
    section.classList.toggle('is-open', open);
    if (focus) toggle.focus({ preventScroll: true });
  }

  function openSection(kind, focus = false) {
    setSectionOpen(page.querySelector(`[data-report-editor-section="${kind}"]`), true, focus);
  }

  function syncList(kind) {
    const cfg = sectionConfig[kind];
    const list = page.querySelector(cfg.list);
    if (!list) return;
    const rows = [...list.querySelectorAll('.builder-item')];
    const filled = rows.filter((row) => row.querySelector('.r-name')?.value.trim()).length;
    const badge = page.querySelector(`[data-report-count="${kind}"]`);
    const empty = page.querySelector(`[data-report-empty="${kind}"]`);
    if (badge) badge.textContent = countLabel(kind, filled);
    if (empty) {
      empty.hidden = rows.length > 0;
      empty.textContent = cfg.empty;
    }
  }

  function syncAll() {
    Object.keys(sectionConfig).forEach(syncList);
  }

  function finishDrag() {
    page.querySelectorAll('.builder-item.is-dragging, .builder-item.is-drag-over').forEach((row) => row.classList.remove('is-dragging', 'is-drag-over'));
    draggedRow = null;
  }

  page.addEventListener('click', (event) => {
    const toggle = event.target.closest('.report-section-toggle');
    if (!toggle) return;
    const section = toggle.closest('.report-editor-section');
    setSectionOpen(section, toggle.getAttribute('aria-expanded') !== 'true');
  });

  page.addEventListener('dragstart', (event) => {
    const handle = event.target.closest('.report-drag-handle');
    if (!handle) return;
    draggedRow = handle.closest('.builder-item');
    if (!draggedRow) return;
    draggedRow.classList.add('is-dragging');
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', 'report-row');
  });

  page.addEventListener('dragover', (event) => {
    const target = event.target.closest('.builder-item');
    if (!draggedRow || !target || target === draggedRow || target.parentElement !== draggedRow.parentElement) return;
    event.preventDefault();
    page.querySelectorAll('.builder-item.is-drag-over').forEach((row) => row.classList.remove('is-drag-over'));
    target.classList.add('is-drag-over');
    event.dataTransfer.dropEffect = 'move';
  });

  page.addEventListener('drop', (event) => {
    const target = event.target.closest('.builder-item');
    if (!draggedRow || !target || target === draggedRow || target.parentElement !== draggedRow.parentElement) return;
    event.preventDefault();
    const box = target.getBoundingClientRect();
    target.parentElement.insertBefore(draggedRow, event.clientY < box.top + box.height / 2 ? target : target.nextSibling);
    finishDrag();
    syncAll();
    onRowsChanged?.();
  });
  page.addEventListener('dragend', finishDrag);

  function syncActionBarNow() {
    if (!tools || !previewColumn) return;
    if (!page.classList.contains('active')) {
      tools.classList.remove('is-fixed');
      page.style.setProperty('--reports-tools-height', '0px');
      return;
    }
    tools.classList.remove('is-fixed');
    const rect = previewColumn.getBoundingClientRect();
    const mobile = window.innerWidth < 768;
    const left = mobile ? 12 : Math.max(12, rect.left);
    const width = mobile ? Math.max(0, window.innerWidth - 24) : Math.max(280, rect.width);
    page.style.setProperty('--report-tools-left', `${Math.round(left)}px`);
    page.style.setProperty('--report-tools-width', `${Math.round(width)}px`);
    tools.classList.add('is-fixed');
    requestAnimationFrame(() => page.style.setProperty('--reports-tools-height', `${Math.ceil(tools.getBoundingClientRect().height)}px`));
  }

  function syncActionBar() {
    cancelAnimationFrame(actionFrame);
    actionFrame = requestAnimationFrame(syncActionBarNow);
  }

  window.addEventListener('resize', syncActionBar, { passive: true });
  window.addEventListener('orientationchange', syncActionBar, { passive: true });
  if ('ResizeObserver' in window && previewColumn) new ResizeObserver(syncActionBar).observe(previewColumn);

  return { syncAll, syncList, syncActionBar, openSection };
}
