(() => {
  const PROFILE_ID = 'profileModal';
  const BODY_ID = 'profileBody';

  function readLabeledNotice(notice) {
    const result = {};
    if (!notice) return result;
    let label = '';
    for (const node of notice.childNodes) {
      if (node.nodeType === Node.ELEMENT_NODE && node.tagName === 'B') {
        label = node.textContent.replace(/:\s*$/, '').trim();
        result[label] = '';
        continue;
      }
      if (node.nodeType === Node.ELEMENT_NODE && node.tagName === 'BR') {
        label = '';
        continue;
      }
      if (label && node.nodeType === Node.TEXT_NODE) result[label] += node.textContent.trim();
    }
    return result;
  }

  function icon(name) {
    const paths = {
      attendance:
        '<path d="M8.5 12.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7-1a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM3.5 18.5c0-3 2.2-5 5-5s5 2 5 5M13.5 14.5c2.5 0 4 1.6 4 4"/>',
      homework: '<path d="M5 18.5V14m4 4.5V9m4 9.5V5.5m4 13V11"/>',
      tests: '<path d="M7 3.5h7l4 4v13H7z"/><path d="M14 3.5v4h4M10 12h5m-5 3h5"/>',
      calendar:
        '<rect x="3.5" y="5.5" width="17" height="15" rx="3"/><path d="M7.5 3v5m9-5v5M3.5 10h17"/>',
      target:
        '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><path d="M12 12 20 4"/>',
      note: '<path d="M5 4.5h14v15H5z"/><path d="M8.5 9h7m-7 4h5"/>',
      user: '<circle cx="12" cy="8" r="3"/><path d="M6.5 19c0-3.3 2.2-5.5 5.5-5.5s5.5 2.2 5.5 5.5"/>',
      clock: '<circle cx="12" cy="12" r="8"/><path d="M12 7.5V12l3 2"/>',
    };
    return `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[name] || ''}</svg>`;
  }

  function escapeHtml(value = '') {
    return String(value).replace(
      /[&<>"']/g,
      (char) =>
        ({
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#39;',
        })[char],
    );
  }

  function textOrDash(value, fallback = '—') {
    const clean = String(value ?? '').trim();
    return clean || fallback;
  }

  function buildInfoItem(label, value, iconName) {
    const item = document.createElement('div');
    item.className = 'profile-meta-item';
    item.innerHTML = `<span class="profile-meta-icon">${icon(iconName)}</span><span><small>${escapeHtml(label)}</small><b>${escapeHtml(textOrDash(value))}</b></span>`;
    return item;
  }

  function labelHistoryCells(table) {
    if (!table) return;
    const labels = [...table.querySelectorAll('thead th')].map((th) => th.textContent.trim());
    table.querySelectorAll('tbody tr').forEach((row) => {
      [...row.children].forEach((cell, index) => {
        if (labels[index]) cell.dataset.label = labels[index];
      });
    });
  }

  function makeTab(id, label, selected) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'profile-tab';
    button.id = `profileTab-${id}`;
    button.dataset.profileTab = id;
    button.setAttribute('role', 'tab');
    button.setAttribute('aria-selected', String(selected));
    button.setAttribute('aria-controls', `profilePanel-${id}`);
    button.textContent = label;
    return button;
  }

  function enhanceProfile() {
    const modal = document.getElementById(PROFILE_ID);
    const body = document.getElementById(BODY_ID);
    if (
      !modal ||
      !body ||
      !body.children.length ||
      body.querySelector(':scope > .profile-redesign')
    )
      return;

    const summary = body.querySelector('.profile-summary');
    const contacts = body.querySelector('.profile-contact-grid');
    const metrics = body.querySelector('.student-metrics');
    const notices = [...body.querySelectorAll(':scope > .notice')];
    const historyHeading = [...body.querySelectorAll(':scope > h3')].find((heading) =>
      heading.textContent.includes('История занятий'),
    );
    const historyWrap = historyHeading?.nextElementSibling;
    const historyTable = historyWrap?.querySelector('table');
    const historyExtras = [];
    if (historyWrap) {
      let extra = historyWrap.nextElementSibling;
      while (extra) {
        historyExtras.push(extra);
        extra = extra.nextElementSibling;
      }
    }

    if (!summary || !metrics || notices.length < 2 || !historyHeading) return;

    modal.querySelector('.modal')?.classList.add('profile-modal-card');
    modal.querySelector('.close')?.setAttribute('aria-label', 'Закрыть карточку ученика');

    const shell = document.createElement('div');
    shell.className = 'profile-redesign';

    const hero = document.createElement('section');
    hero.className = 'profile-hero';

    const identity = document.createElement('div');
    identity.className = 'profile-identity';
    identity.append(summary);

    const meta = document.createElement('div');
    meta.className = 'profile-meta';
    const contactItems = contacts ? [...contacts.children] : [];
    const parentName = contactItems
      .find((item) => item.querySelector('span')?.textContent.includes('Имя родителя'))
      ?.querySelector('b')?.textContent;
    const conditions = contactItems
      .find((item) => item.querySelector('span')?.textContent.includes('Условия занятий'))
      ?.querySelector('b')?.textContent;
    const studentContact = contactItems.find((item) =>
      item.querySelector('span')?.textContent.includes('Контакт ученика'),
    );
    const parentContact = contactItems.find((item) =>
      item.querySelector('span')?.textContent.includes('Контакт родителя'),
    );

    meta.append(buildInfoItem('Имя родителя', parentName || 'Не указано', 'user'));
    meta.append(buildInfoItem('Условия занятий', conditions || 'Не указаны', 'clock'));

    const extraContacts = document.createElement('div');
    extraContacts.className = 'profile-extra-contacts';
    [studentContact, parentContact].filter(Boolean).forEach((item) => extraContacts.append(item));
    if (extraContacts.children.length) meta.append(extraContacts);

    hero.append(identity, meta);

    const metricIcons = ['attendance', 'homework', 'tests'];
    [...metrics.children].forEach((item, index) => {
      item.classList.add('profile-kpi');
      const badge = document.createElement('span');
      badge.className = `profile-kpi-icon profile-kpi-icon-${metricIcons[index]}`;
      badge.innerHTML = icon(metricIcons[index]);
      item.prepend(badge);
    });

    const tabs = document.createElement('div');
    tabs.className = 'profile-tabs';
    tabs.setAttribute('role', 'tablist');
    tabs.setAttribute('aria-label', 'Разделы карточки ученика');
    const overviewTab = makeTab('overview', 'Обзор', true);
    const historyTab = makeTab('history', 'История занятий', false);
    tabs.append(overviewTab, historyTab);

    const overview = document.createElement('section');
    overview.id = 'profilePanel-overview';
    overview.className = 'profile-panel profile-panel-overview';
    overview.setAttribute('role', 'tabpanel');
    overview.setAttribute('aria-labelledby', overviewTab.id);

    const scheduleData = readLabeledNotice(notices[0]);
    const learningData = readLabeledNotice(notices[1]);

    const nextCard = document.createElement('section');
    nextCard.className = 'profile-next-card';
    nextCard.innerHTML = `
      <div class="profile-next-icon">${icon('calendar')}</div>
      <div class="profile-next-column profile-next-primary"><b>Следующее занятие</b><small>Дата и время</small><strong>${escapeHtml(textOrDash(scheduleData['Следующее занятие'], 'Ближайшее занятие не запланировано'))}</strong></div>
      <div class="profile-next-column"><small>Регулярное расписание</small><span>${escapeHtml(textOrDash(scheduleData['Регулярное расписание'], 'Не задано'))}</span></div>
      <div class="profile-next-column"><small>Пометка на следующий урок</small><span>${escapeHtml(textOrDash(scheduleData['Пометка на следующий урок'], 'Пометки пока нет'))}</span></div>`;

    const notesGrid = document.createElement('div');
    notesGrid.className = 'profile-notes-grid';
    notesGrid.innerHTML = `
      <section class="profile-info-card"><span class="profile-info-icon profile-info-goals">${icon('target')}</span><div><b>Цели</b><p>${escapeHtml(textOrDash(learningData['Цели'], 'не указаны'))}</p></div></section>
      <section class="profile-info-card"><span class="profile-info-icon profile-info-notes">${icon('note')}</span><div><b>Заметки</b><p>${escapeHtml(textOrDash(learningData['Заметки'], 'нет'))}</p></div></section>`;

    const preview = document.createElement('section');
    preview.className = 'profile-history-preview';
    preview.innerHTML =
      '<div class="profile-section-title"><b>Последнее занятие</b><button type="button" class="profile-history-link">Вся история →</button></div>';
    const firstRow = historyTable?.querySelector('tbody tr');
    if (firstRow) {
      const cells = [...firstRow.children].map((cell) => cell.textContent.trim());
      const previewRow = document.createElement('div');
      previewRow.className = 'profile-preview-row';
      previewRow.innerHTML = `<span><small>Дата</small><b>${escapeHtml(textOrDash(cells[0]))}</b></span><span><small>Статус</small><b>${escapeHtml(textOrDash(cells[1]))}</b></span><span><small>Темы / комментарий</small><b>${escapeHtml(textOrDash(cells[2]))}</b></span><span><small>ДЗ</small><b>${escapeHtml(textOrDash(cells[3]))}</b></span><span><small>Проверочная</small><b>${escapeHtml(textOrDash(cells[4]))}</b></span>`;
      preview.append(previewRow);
    } else {
      preview.insertAdjacentHTML(
        'beforeend',
        '<p class="profile-empty-history">Проведённых занятий пока нет.</p>',
      );
    }

    overview.append(nextCard, notesGrid, preview);

    const historyPanel = document.createElement('section');
    historyPanel.id = 'profilePanel-history';
    historyPanel.className = 'profile-panel profile-panel-history';
    historyPanel.setAttribute('role', 'tabpanel');
    historyPanel.setAttribute('aria-labelledby', historyTab.id);
    historyPanel.hidden = true;
    historyHeading.classList.add('profile-history-heading');
    historyPanel.append(historyHeading);
    if (historyWrap) historyPanel.append(historyWrap);
    historyExtras.forEach((extra) => historyPanel.append(extra));

    shell.append(hero, metrics, tabs, overview, historyPanel);
    body.replaceChildren(shell);

    contacts?.remove();
    notices.forEach((notice) => notice.remove());

    labelHistoryCells(historyTable);
    if (historyTable?.querySelector('tbody')) {
      const tbodyObserver = new MutationObserver(() => labelHistoryCells(historyTable));
      tbodyObserver.observe(historyTable.querySelector('tbody'), { childList: true });
    }

    function activateTab(name) {
      const isOverview = name === 'overview';
      overview.hidden = !isOverview;
      historyPanel.hidden = isOverview;
      overviewTab.setAttribute('aria-selected', String(isOverview));
      historyTab.setAttribute('aria-selected', String(!isOverview));
      (isOverview ? overviewTab : historyTab).focus({ preventScroll: true });
    }

    overviewTab.addEventListener('click', () => activateTab('overview'));
    historyTab.addEventListener('click', () => activateTab('history'));
    preview
      .querySelector('.profile-history-link')
      ?.addEventListener('click', () => activateTab('history'));
    tabs.addEventListener('keydown', (event) => {
      if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
      event.preventDefault();
      activateTab(overviewTab.getAttribute('aria-selected') === 'true' ? 'history' : 'overview');
    });
  }

  const body = document.getElementById(BODY_ID);
  if (body) {
    const observer = new MutationObserver(() => requestAnimationFrame(enhanceProfile));
    observer.observe(body, { childList: true });
  }

  requestAnimationFrame(enhanceProfile);

  const modal = document.getElementById(PROFILE_ID);
  if (modal) {
    const openObserver = new MutationObserver(() => {
      if (modal.classList.contains('open')) requestAnimationFrame(enhanceProfile);
    });
    openObserver.observe(modal, { attributes: true, attributeFilter: ['class'] });
  }
})();
