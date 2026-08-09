(() => {
  'use strict';

  const page = document.querySelector('#page-reports');
  if (!page) return;

  const tools = page.querySelector('.report-tools');
  const previewColumn = page.querySelector('.report-preview-column');
  const studentSelect = page.querySelector('#reportStudent');

  const sectionConfig = {
    topics: { list: '#reportTopics', empty: 'Темы появятся из проведённых занятий или их можно добавить вручную.' },
    tests: { list: '#reportTests', empty: 'Проверочных за период пока нет. При необходимости добавьте работу вручную.' },
    hws: { list: '#reportHws', empty: 'Домашних заданий с оценкой за период пока нет. Их можно добавить вручную.' },
  };

  const plural = (value, forms) => {
    const n = Math.abs(Number(value) || 0) % 100;
    const n1 = n % 10;
    if (n > 10 && n < 20) return forms[2];
    if (n1 > 1 && n1 < 5) return forms[1];
    if (n1 === 1) return forms[0];
    return forms[2];
  };

  const countLabel = (kind, count) => {
    if (kind === 'topics') return `${count} ${plural(count, ['тема', 'темы', 'тем'])}`;
    if (kind === 'tests') return `${count} ${plural(count, ['работа', 'работы', 'работ'])}`;
    return `${count} ${plural(count, ['запись', 'записи', 'записей'])}`;
  };

  function setSectionOpen(section, open, focus = false) {
    if (!section || section.hidden || section.style.display === 'none') return;
    const toggle = section.querySelector('.report-section-toggle');
    const panel = section.querySelector('.report-editor-panel');
    if (!toggle || !panel) return;

    if (open) {
      page.querySelectorAll('.report-editor-section').forEach((other) => {
        if (other === section) return;
        const otherToggle = other.querySelector('.report-section-toggle');
        const otherPanel = other.querySelector('.report-editor-panel');
        if (otherToggle) otherToggle.setAttribute('aria-expanded', 'false');
        if (otherPanel) otherPanel.hidden = true;
        other.classList.remove('is-open');
      });
    }

    toggle.setAttribute('aria-expanded', String(open));
    panel.hidden = !open;
    section.classList.toggle('is-open', open);
    if (focus) toggle.focus({ preventScroll: true });
  }

  page.addEventListener('click', (event) => {
    const toggle = event.target.closest('.report-section-toggle');
    if (toggle && page.contains(toggle)) {
      const section = toggle.closest('.report-editor-section');
      setSectionOpen(section, toggle.getAttribute('aria-expanded') !== 'true');
      return;
    }

    const addButton = event.target.closest('#addReportTopic, #addReportTest, #addReportHw');
    if (addButton) {
      const kind =
        addButton.id === 'addReportTopic' ? 'topics' : addButton.id === 'addReportTest' ? 'tests' : 'hws';
      const section = page.querySelector(`[data-report-editor-section="${kind}"]`);
      setSectionOpen(section, true);
      requestAnimationFrame(() => {
        syncListState(kind);
        const inputs = section?.querySelectorAll('.r-name');
        inputs?.[inputs.length - 1]?.focus();
      });
    }
  });

  function syncListState(kind) {
    const cfg = sectionConfig[kind];
    const list = page.querySelector(cfg.list);
    const badge = page.querySelector(`[data-report-count="${kind}"]`);
    const empty = page.querySelector(`[data-report-empty="${kind}"]`);
    if (!list) return;

    const rows = [...list.querySelectorAll('.builder-item')];
    const filled = rows.filter((row) => row.querySelector('.r-name')?.value.trim()).length;
    if (badge) badge.textContent = countLabel(kind, filled);
    if (empty) {
      empty.hidden = rows.length > 0;
      empty.textContent = cfg.empty;
    }
  }

  let draggedRow = null;

  function decorateRows(list) {
    list.querySelectorAll('.builder-item').forEach((row) => {
      if (row.querySelector('.report-drag-handle')) return;
      const handle = document.createElement('button');
      handle.type = 'button';
      handle.className = 'report-drag-handle';
      handle.draggable = true;
      handle.setAttribute('aria-label', 'Перетащить строку');
      handle.title = 'Перетащить';
      row.prepend(handle);
    });
  }

  function finishDrag() {
    page.querySelectorAll('.builder-item.is-dragging, .builder-item.is-drag-over').forEach((row) => {
      row.classList.remove('is-dragging', 'is-drag-over');
    });
    draggedRow = null;
  }

  page.addEventListener('dragstart', (event) => {
    const handle = event.target.closest('.report-drag-handle');
    if (!handle) return;
    draggedRow = handle.closest('.builder-item');
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
    draggedRow.querySelector('.r-name')?.dispatchEvent(new Event('input', { bubbles: true }));
    finishDrag();
  });

  page.addEventListener('dragend', finishDrag);

  function syncAllLists() {
    Object.keys(sectionConfig).forEach(syncListState);
  }

  Object.entries(sectionConfig).forEach(([kind, cfg]) => {
    const list = page.querySelector(cfg.list);
    if (!list) return;
    new MutationObserver(() => {
      decorateRows(list);
      syncListState(kind);
    }).observe(list, { childList: true, subtree: true });
    list.addEventListener('input', () => syncListState(kind));
    decorateRows(list);
  });

  function resetPreviewForEmptyStudent() {
    if (studentSelect?.value) return;

    ['#reportTopics', '#reportTests', '#reportHws'].forEach((selector) => {
      const list = page.querySelector(selector);
      if (list) list.innerHTML = '';
    });

    const comment = page.querySelector('#reportComment');
    if (comment) comment.value = '';

    const pills = page.querySelector('#paperPills');
    if (pills) pills.innerHTML = '<span class="paper-pill">Выберите ученика</span>';

    const paperComment = page.querySelector('#paperComment');
    if (paperComment) paperComment.textContent = '—';

    ['#paperTopics', '#paperHws', '#paperTests'].forEach((selector) => {
      const target = page.querySelector(selector);
      if (target) {
        target.className = 'report-empty';
        target.textContent = '—';
      }
    });

    const pct = page.querySelector('#paperPct');
    if (pct) pct.textContent = '0%';
    const ring = page.querySelector('#paperRingValue');
    if (ring) {
      ring.style.stroke = '';
      ring.style.strokeDashoffset = '326.726';
    }

    const nextBuilder = page.querySelector('#reportNextPackageBuilder');
    const nextPreview = page.querySelector('#paperNextPackageSection');
    const nextEditor = page.querySelector('#reportNextPackagePreview');
    if (nextBuilder) nextBuilder.style.display = 'none';
    if (nextPreview) nextPreview.style.display = 'none';
    if (nextEditor) {
      nextEditor.value = '';
      delete nextEditor.dataset.autoValue;
      delete nextEditor.dataset.studentId;
    }

    syncAllLists();
  }

  studentSelect?.addEventListener('change', () => {
    requestAnimationFrame(() => {
      if (!studentSelect.value) resetPreviewForEmptyStudent();
      syncAllLists();
    });
  });

  function syncActionBar() {
    if (!tools || !previewColumn) return;
    const active = page.classList.contains('active');
    if (!active) {
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

    requestAnimationFrame(() => {
      const height = Math.ceil(tools.getBoundingClientRect().height);
      page.style.setProperty('--reports-tools-height', `${height}px`);
    });
  }

  let actionFrame = 0;
  const scheduleActionBarSync = () => {
    cancelAnimationFrame(actionFrame);
    actionFrame = requestAnimationFrame(syncActionBar);
  };

  window.addEventListener('resize', scheduleActionBarSync, { passive: true });
  window.addEventListener('orientationchange', scheduleActionBarSync, { passive: true });
  new MutationObserver(scheduleActionBarSync).observe(page, { attributes: true, attributeFilter: ['class'] });
  if ('ResizeObserver' in window && previewColumn) {
    new ResizeObserver(scheduleActionBarSync).observe(previewColumn);
  }

  const app = document.querySelector('.app');
  if (app) new MutationObserver(scheduleActionBarSync).observe(app, { attributes: true, attributeFilter: ['class'] });

  syncAllLists();
  scheduleActionBarSync();
})();
