import {
  MAX_BACKUP_BYTES,
  makeBackup,
  mergeImported,
  replaceImported,
  unwrapBackup,
  validateBackup,
  validateBackupSize,
} from '../src/domain/backup.js';
import { periodAnalytics as calculatePeriodAnalytics } from '../src/domain/analytics.js';
import { finances as calculateFinances } from '../src/domain/finances.js';
import {
  countMonthlyRecurringLessons,
  extendAllSchedules as extendSchedules,
  generateSchedule as generateRecurringSchedule,
  monthlyRecurringDates,
} from '../src/domain/schedule.js';
import {
  normalizePastLessons as completePastLessons,
  pruneOldHistory,
  syncFutureGroupBilling as refreshGroupBilling,
} from '../src/state/maintenance.js';
import { createBrowserPersistence } from '../src/state/persistence.js';
import { blankData } from '../src/state/schema.js';
import { createStore } from '../src/state/store.js';
import { validateReferential, validateStructural } from '../src/state/validate.js';

(() => {
  const KEY = 'tutorCabinet_v1';
  const RETENTION_DAYS = 45;
  const $ = (s, r = document) => r.querySelector(s),
    $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const blank = blankData();
  const persistence = createBrowserPersistence({
    key: KEY,
    onPersist: (raw) => window.tutorCloud?.queueSave?.(raw),
  });
  const loaded = persistence.load();
  const store = createStore(loaded.ok ? loaded.envelope.data : structuredClone(blank), {
    validate: (candidate) => {
      const structural = validateStructural(candidate);
      if (!structural.ok) return structural;
      return validateReferential(candidate);
    },
  });
  let persistenceEnabled = loaded.ok;
  let data = structuredClone(store.getState()),
    activeStudent = null,
    lessonInitial = '',
    calendarView = 'month',
    pendingImport = null;
  if (!loaded.ok)
    console.error(
      `Local state rejected at ${loaded.stage}; the last copy was not overwritten.`,
      loaded.errors,
    );
  store.subscribe((nextState, actionName) => {
    if (!persistenceEnabled) return;
    const result = persistence.save(nextState);
    if (!result.ok) console.error(`Persistence rejected action "${actionName}".`, result.errors);
  });
  store.subscribe((nextState, actionName) => {
    data = structuredClone(nextState);
    if (!actionName.startsWith('silent:')) renderAll();
  });
  function commit(actionName, render = true) {
    try {
      return store.update(render ? actionName : `silent:${actionName}`, (draft) => {
        for (const key of Object.keys(draft)) delete draft[key];
        Object.assign(draft, structuredClone(data));
      });
    } catch (error) {
      data = structuredClone(store.getState());
      console.error(error);
      toast('Изменение не сохранено: данные не прошли проверку');
      return store.getState();
    }
  }
  function persistLocal(actionName = 'background-update') {
    commit(actionName, false);
    return JSON.stringify({ meta: { schemaVersion: 1 }, data: store.getState() });
  }
  function save(actionName = 'ui-update') {
    commit(actionName, true);
  }
  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }
  function esc(v = '') {
    return String(v).replace(
      /[&<>'"]/g,
      (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[c],
    );
  }
  function activeTimezone() {
    return undefined;
  }
  function fmtDate(v, full = false) {
    if (!v) return '—';
    return new Date(v).toLocaleString(
      'ru-RU',
      full
        ? {
            day: 'numeric',
            month: 'long',
            hour: '2-digit',
            minute: '2-digit',
            timeZone: activeTimezone(),
          }
        : { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: activeTimezone() },
    );
  }
  function fmtTime(v) {
    return new Date(v).toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: activeTimezone(),
    });
  }
  function localDay(v = new Date()) {
    const d = new Date(v),
      p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }
  function money(v) {
    return new Intl.NumberFormat('ru-RU').format(Number(v) || 0) + ' ₽';
  }
  function initials(n = '') {
    return (
      n
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((x) => x[0])
        .join('')
        .toUpperCase() || '?'
    );
  }
  function student(id) {
    return data.students.find((s) => s.id === id);
  }
  function group(id) {
    return data.groups.find((g) => g.id === id);
  }
  function lessonName(l) {
    return l.groupId
      ? group(l.groupId)?.name || 'Группа'
      : student(l.studentId)?.name || 'Удалённый ученик';
  }
  function lessonsOf(id) {
    return data.lessons
      .filter((l) => l.studentId === id)
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }
  function finances(id) {
    return calculateFinances(data, id);
  }
  function homeworkGrade(l) {
    if (!l) return null;
    const raw = l.homeworkResult;
    if (raw !== '' && raw != null) {
      const n = +raw || 0;
      return n > 0 ? Math.max(1, Math.min(5, n > 5 ? Math.round(n / 20) : n)) : null;
    }
    if (+l.homeworkPercent > 0)
      return Math.max(1, Math.min(5, Math.round(+l.homeworkPercent / 20)));
    return null;
  }
  function metrics(id) {
    const a = lessonsOf(id),
      done = a.filter((x) => x.status === 'done'),
      miss = a.filter((x) => ['missed', 'paid_missed'].includes(x.status));
    const completed = done.length + miss.length,
      hw = done.map(homeworkGrade).filter(Number.isFinite),
      fin = finances(id);
    return {
      done: done.length,
      miss: miss.length,
      attendance: completed ? Math.round((done.length / completed) * 100) : 100,
      homework: hw.length
        ? Math.round((hw.reduce((n, x) => n + x, 0) / hw.length) * 10) / 10
        : null,
      debt: fin.debt,
      pack: fin.used || 0,
    };
  }
  function toast(t) {
    const el = $('#toast');
    el.textContent = t;
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 2300);
  }
  let dialogResolve = null;
  function appDialog({
    title = 'Сообщение',
    message = '',
    confirmText = 'Хорошо',
    cancelText = 'Отмена',
    danger = false,
    confirmOnly = false,
  } = {}) {
    if (dialogResolve) dialogResolve(false);
    const wrap = $('#appDialog'),
      card = $('#appDialogCard'),
      confirmBtn = $('#appDialogConfirm'),
      cancelBtn = $('#appDialogCancel');
    card.scrollTop = 0;
    $('#appDialogTitle').textContent = title;
    $('#appDialogMessage').textContent = message;
    $('#appDialogIcon').textContent = danger ? '!' : 'i';
    confirmBtn.textContent = confirmText;
    cancelBtn.textContent = cancelText;
    cancelBtn.style.display = confirmOnly ? 'none' : '';
    confirmBtn.classList.toggle('danger', danger);
    confirmBtn.classList.toggle('primary', !danger);
    card.classList.toggle('danger-dialog', danger);
    wrap.classList.add('open');
    requestAnimationFrame(() => (danger && !confirmOnly ? cancelBtn : confirmBtn).focus());
    return new Promise((resolve) => (dialogResolve = resolve));
  }
  function finishDialog(result) {
    if (!dialogResolve) return;
    const resolve = dialogResolve;
    dialogResolve = null;
    $('#appDialog').classList.remove('open');
    resolve(result);
  }
  $('#appDialogConfirm').onclick = () => finishDialog(true);
  $('#appDialogCancel').onclick = () => finishDialog(false);
  $('#appDialog').addEventListener('click', (e) => {
    if (e.target === $('#appDialog')) finishDialog(false);
  });
  const ask = (message, title = 'Подтверждение', confirmText = 'Продолжить') =>
    appDialog({ title, message, confirmText, danger: true });
  const inform = (message, title = 'Обратите внимание', danger = false) =>
    appDialog({ title, message, confirmOnly: true, danger });
  const modalForms = {
      studentModal: '#studentForm',
      lessonModal: '#lessonForm',
      groupModal: '#groupForm',
      paymentModal: '#paymentForm',
      eventModal: '#eventForm',
    },
    modalInitial = {};
  function formSnapshot(selector) {
    return new URLSearchParams(new FormData($(selector))).toString();
  }
  function open(id) {
    const wrap = $('#' + id),
      modal = $('.modal', wrap);
    if (modal) modal.scrollTop = 0;
    open._lastFocus = document.activeElement;
    wrap.classList.add('open');
    requestAnimationFrame(() => {
      const f =
        modal &&
        (modal.querySelector('input:not([type=hidden]),select,textarea') ||
          modal.querySelector('.modal-foot .btn.primary') ||
          modal.querySelector('button:not(.close)') ||
          modal.querySelector('button'));
      if (f)
        try {
          f.focus();
        } catch (e) {}
    });
    if (modalForms[id]) setTimeout(() => (modalInitial[id] = formSnapshot(modalForms[id])));
    if (id === 'profileModal')
      requestAnimationFrame(() => {
        const m = metrics(activeStudent),
          metric = $$('#profileBody .student-metrics b')[1];
        if (metric)
          metric.textContent =
            m.homework == null ? '—' : String(m.homework).replace('.', ',') + '/5';
        const rows = $$('#profileBody tbody tr'),
          ls = lessonsOf(activeStudent).slice(0, 20);
        rows.forEach((r, i) => {
          const cell = r.children[3],
            g = homeworkGrade(ls[i]);
          if (cell) cell.textContent = g == null ? '—' : `Оценка ${g}`;
        });
        const heading = [...$('#profileBody').querySelectorAll('h3')].find((x) =>
          x.textContent.includes('История занятий'),
        );
        if (heading && !$('#profileHistoryHelp')) {
          const help = document.createElement('span');
          help.id = 'profileHistoryHelp';
          help.className = 'help-tip';
          help.tabIndex = 0;
          help.textContent = '?';
          help.dataset.tip =
            'В карточке показывается история за последние 45 дней. Более старые детали автоматически удаляются.';
          heading.append(help);
        }
      });
  }
  function closeAll() {
    $$('.modal-wrap').forEach((x) => x.classList.remove('open'));
    const l = open._lastFocus;
    open._lastFocus = null;
    if (l && document.contains(l))
      try {
        l.focus();
      } catch (e) {}
  }
  function go(page) {
    $$('.page').forEach((x) => x.classList.toggle('active', x.id === 'page-' + page));
    $$('#nav button').forEach((x) => x.classList.toggle('active', x.dataset.page === page));
    renderAll();
    scrollTo({ top: 0, behavior: 'smooth' });
  }
  function renderAll() {
    applySettings();
    fillStudents();
    renderDashboard();
    renderStudents();
    renderGroups();
    renderCalendar();
    renderPaymentsSimple();
    renderReportOptions();
  }
  function updateClock() {
    const now = new Date(),
      h = now.getHours(),
      part = h < 6 ? 'night' : h < 12 ? 'morning' : h < 18 ? 'day' : 'evening',
      greeting =
        part === 'night'
          ? 'Доброй ночи'
          : part === 'morning'
            ? 'Доброе утро'
            : part === 'day'
              ? 'Добрый день'
              : 'Добрый вечер',
      visual = part === 'night' ? '🌙' : part === 'morning' ? '🌅' : part === 'day' ? '☀️' : '🌇',
      name = data.settings.tutor ? ', ' + data.settings.tutor : '',
      hello = $('#hello'),
      key = part + '|' + name;
    if (hello.dataset.greeting !== key) {
      hello.dataset.greeting = key;
      hello.innerHTML = `${esc(greeting + name + '!')} <span class="greeting-visual ${part}" aria-hidden="true">${visual}</span>`;
    }
    $('#todayText').textContent = now.toLocaleString('ru-RU', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
  function hasDemoData() {
    return (
      data.students.some(
        (s) => s.demo || ['@anna_demo', '@max_demo', '@sofia_demo'].includes(s.contact),
      ) || data.groups.some((g) => g.demo)
    );
  }
  function applySettings() {
    document.documentElement.dataset.theme = data.settings.theme || 'light';
    const themeLabel = data.settings.theme === 'dark' ? '☀' : '☾',
      compact = !!data.settings.sidebarCompact,
      toggle = $('#sidebarToggle');
    $('#themeBtn').childNodes[0].nodeValue = themeLabel + ' ';
    $('#settingTutor').value = data.settings.tutor || '';
    $('#settingReminder').value = String(data.settings.reminder ?? 15);
    $('.app').classList.toggle('sidebar-compact', compact);
    toggle.textContent = compact ? '›' : '‹';
    toggle.title = compact ? 'Развернуть меню' : 'Свернуть меню';
    toggle.setAttribute('aria-label', toggle.title);
    updateClock();
  }
  function lessonDuration(l) {
    return +(l.groupId ? group(l.groupId)?.duration : student(l.studentId)?.duration) || 60;
  }
  function lessonEnded(l) {
    return new Date(l.date).getTime() + lessonDuration(l) * 60000 < Date.now();
  }
  function normalizePastLessons() {
    const result = completePastLessons(data, Date.now(), lessonDuration);
    if (!result.changes.lessonsCompleted) return false;
    data = result.data;
    data.lessons
      .filter((lesson) => result.changes.completedLessonIds.includes(lesson.id))
      .forEach(syncPaidLessonHistory);
    return true;
  }
  function lessonFilled(l) {
    return !!l.reportFilled || !!(l.topics || l.comment || l.homework || l.testDone === 'yes');
  }
  function lessonRow(l, button = '', withDate = false) {
    const name = lessonName(l),
      when = withDate ? fmtDate(l.date, true) : fmtTime(l.date),
      needsInfo = button === 'Заполнить информацию';
    return `<div class="row"><div class="grow"><b>${when} · ${esc(name)}</b><small class="${l.prepNote ? 'lesson-note' : ''}">${l.prepNote ? `Подготовить: ${esc(l.prepNote)}` : esc(l.topics || statusName(l.status))}</small></div>${button ? (button === 'Заполнено' ? `<button class="pill ok lesson-done-pill" data-edit-lesson="${l.id}" title="Открыть занятие">✓ Заполнено</button>` : `<button class="btn ${needsInfo ? 'primary' : ''}" data-edit-lesson="${l.id}">${button}</button>`) : ''}</div>`;
  }
  function renderDashboard() {
    const today = localDay(),
      sessions = uniqueSessions(data.lessons.filter((l) => localDay(l.date) === today)).sort(
        (a, b) => new Date(a.date) - new Date(b.date),
      ),
      up = sessions.filter((l) => l.status === 'planned' && !lessonEnded(l)),
      past = sessions.filter(
        (l) => lessonEnded(l) && !['planned', 'moved', 'cancelled'].includes(l.status),
      ),
      unfilled = uniqueSessions(
        data.lessons.filter(
          (l) =>
            ['done', 'unconfirmed'].includes(l.status) &&
            lessonEnded(l) &&
            !lessonFilled(l) &&
            localDay(l.date) !== today &&
            Date.now() - new Date(l.date).getTime() <= RETENTION_DAYS * 864e5,
        ),
      ).sort((a, b) => new Date(b.date) - new Date(a.date)),
      alert = $('#dashboardUnfilledAlert');
    $('#upcoming').innerHTML = up.length
      ? up.map((l) => lessonRow(l)).join('')
      : `<div class="empty"><div class="dashboard-empty-person">🧘‍♀️</div>Предстоящих занятий сегодня нет</div>`;
    $('#todayCompleted').innerHTML = past.length
      ? past
          .map((l) => lessonRow(l, lessonFilled(l) ? 'Заполнено' : 'Заполнить информацию'))
          .join('')
      : '<div class="empty">Прошедших занятий сегодня пока нет</div>';
    $('#unfilledLessons').innerHTML = unfilled.length
      ? unfilled.map((l) => lessonRow(l, 'Заполнить информацию', true)).join('')
      : '<div class="empty">Все занятия заполнены</div>';
    alert.textContent = unfilled.length
      ? `У вас есть незаполненные занятия: ${unfilled.length}.`
      : '';
    alert.classList.toggle('show', unfilled.length > 0);
  }
  function renderStudents() {
    const q = $('#studentSearch').value.toLowerCase(),
      f = $('#studentFilter').value;
    let list = data.students.filter((s) =>
      (s.name + ' ' + s.grade + ' ' + s.contact).toLowerCase().includes(q),
    );
    if (f === 'debt')
      list = list.filter((s) =>
        s.payType === 'package' ? finances(s.id).balanceLessons < 0 : metrics(s.id).debt > 0,
      );
    list.sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'ru'));
    $('#studentGrid').innerHTML = list.length
      ? list
          .map((s) => {
            const m = metrics(s.id),
              fin = finances(s.id),
              packageText =
                fin.balanceLessons < 0
                  ? `Долг ${Math.abs(fin.balanceLessons)} зан.`
                  : fin.balanceLessons === 0
                    ? 'Закончился'
                    : `${fin.balanceLessons} зан.`;
            return `<article class="card student-card"><button class="btn student-delete" data-quick-delete-student="${s.id}" title="Удалить ученика" aria-label="Удалить ученика">🗑</button><div class="student-card-main" role="button" tabindex="0" aria-label="Открыть карточку: ${esc(s.name)}" data-student="${s.id}"><div class="student-top"><div><h3>${esc(s.name)}</h3><div class="meta">${esc(s.grade || 'Класс не указан')} · ${esc(scheduleText(s.scheduleSlots))}</div></div></div><div class="student-metrics"><div><b>${m.attendance}%</b><small>Посещение</small></div><div><b>${m.homework == null ? '—' : String(m.homework).replace('.', ',') + '/5'}</b><small>Средняя оценка ДЗ</small></div><div><b class="${(s.payType === 'package' && fin.balanceLessons <= 0) || m.debt ? 'danger-text' : ''}">${s.payType === 'package' ? packageText : m.debt ? money(m.debt) : '✓'}</b><small>${s.payType === 'package' ? 'Абонемент' : m.debt ? 'Долг' : 'Оплачено'}</small></div></div></div></article>`;
          })
          .join('')
      : `<div class="empty students-empty">Ученики не найдены</div>`;
  }
  function scheduleText(slots = []) {
    const days = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
    return slots.length
      ? slots.map((x) => `${days[x.day]} ${x.time}`).join(', ')
      : 'Без расписания';
  }
  function renderGroups() {
    const el = $('#groupGrid');
    if (!el) return;
    const list = [...data.groups].sort((a, b) =>
      String(a.name || '').localeCompare(String(b.name || ''), 'ru'),
    );
    el.innerHTML = list.length
      ? list
          .map(
            (g) =>
              `<article class="card student-card group-card"><button class="btn student-delete" data-quick-delete-group="${g.id}" title="Удалить группу" aria-label="Удалить группу">🗑</button><div class="student-card-main" role="button" tabindex="0" aria-label="Открыть группу: ${esc(g.name)}" data-group="${g.id}"><div class="student-top"><div class="avatar">${esc(initials(g.name))}</div><div><h3>${esc(g.name)}</h3><div class="meta">${esc(g.grade || 'Направление не указано')} · ${esc(scheduleText(g.scheduleSlots))}</div></div></div><div class="student-metrics" style="grid-template-columns:repeat(2,1fr)"><div><b>${g.members?.length || 0}</b><small>Участников</small></div><div><b>${+g.duration || 60} мин</b><small>Длительность</small></div></div><div class="member-chips">${(g.members || []).map((id) => `<span class="member-chip">${esc(student(id)?.name || 'Удалён')}</span>`).join('')}</div></div></article>`,
          )
          .join('')
      : '<div class="groups-empty">Групп пока нет</div>';
  }
  function recentPayments(days = RETENTION_DAYS) {
    const cutoff = new Date();
    cutoff.setHours(0, 0, 0, 0);
    cutoff.setDate(cutoff.getDate() - days);
    return data.payments
      .filter((p) => !p.ledgerOnly && new Date(p.date).getTime() >= cutoff.getTime())
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }
  // Полная сумма проведённых занятий за всё время (paid+unpaid). Использует l.amount,
  // так что при изменении цены прошлые уроки сохраняют историческую стоимость.
  function lifetimeCharged(id) {
    const s = student(id);
    if (!s) return 0;
    const done = lessonsOf(id).filter((l) => ['done', 'paid_missed'].includes(l.status));
    const live = done.reduce((n, l) => n + (+l.amount || 0), 0);
    const arch = data.financeArchive[id] || {};
    const archPkg = (+arch.packageUsed || 0) * (+s.price || 0);
    const archSingle = +arch.singleCharged || 0;
    return live + archPkg + archSingle;
  }
  function lifetimePaid(id) {
    const arch = data.financeArchive[id] || {};
    return (
      (+arch.paidAmount || 0) +
      data.payments
        .filter((p) => p.studentId === id && !p.ledgerOnly)
        .reduce((n, p) => n + (+p.amount || 0), 0)
    );
  }
  // Аналитика за произвольный диапазон дат [fromMs, toMs]. Не трогает архив — только живые записи.
  function periodAnalytics(fromMs, toMs) {
    return calculatePeriodAnalytics(data, fromMs, toMs);
  }
  function analyticsRange() {
    const now = new Date();
    return {
      from: new Date(now.getFullYear(), now.getMonth(), 1).getTime(),
      to: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999).getTime(),
      label: now
        .toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })
        .replace(/^./, (letter) => letter.toUpperCase()),
    };
  }
  function renderPayments() {
    const body = $('#paymentBalances');
    if (!body) return;
    const rows = data.students.map((s) => ({ s, f: finances(s.id) })),
      charged = rows.reduce((n, x) => n + x.f.charged, 0),
      paid = data.payments.reduce((n, p) => n + (+p.amount || 0), 0),
      debt = rows.reduce((n, x) => n + x.f.debt, 0),
      debtors = rows.filter((x) => x.f.debt > 0).length,
      badge = $('#paymentNavBadge');
    badge.textContent = debtors;
    badge.classList.toggle('show', debtors > 0);
    $('#paymentStats').innerHTML = [
      [money(charged), 'Начислено', ''],
      [money(paid), 'Получено', ''],
      [money(debt), debtors ? `Долги · ${debtors} чел.` : 'Долгов нет', debt ? 'debt-stat' : ''],
      [data.payments.length, 'Платежей', ''],
    ]
      .map(
        (x) =>
          `<div class="card stat ${x[2]}"><div class="value">${x[0]}</div><div class="label">${x[1]}</div></div>`,
      )
      .join('');
    body.innerHTML = rows.length
      ? rows
          .map(
            ({ s, f }) =>
              `<tr><td><b>${esc(s.name)}</b></td><td>${s.payType === 'package' ? `${f.used || 0} занятий` : money(f.charged)}</td><td>${s.payType === 'package' ? `${f.bought || 0} занятий` : money(f.paid)}</td><td class="${s.payType === 'package' ? (f.balanceLessons < 0 ? 'payment-negative' : 'payment-positive') : f.balance < 0 ? 'payment-negative' : 'payment-positive'}"><b>${s.payType === 'package' ? `Осталось ${f.balanceLessons || 0}` : f.balance < 0 ? 'Долг ' + money(-f.balance) : f.balance > 0 ? 'Аванс ' + money(f.balance) : 'Оплачено'}</b></td><td><button class="btn payment-for" data-payment-student="${s.id}">Оплата</button></td></tr>`,
          )
          .join('')
      : '<tr><td colspan="5">Учеников пока нет</td></tr>';
    const history = recentPayments();
    $('#paymentHistory').innerHTML = history.length
      ? history
          .map(
            (p) =>
              `<div class="row"><div class="grow"><b>${esc(student(p.studentId)?.name || 'Удалённый ученик')}</b><small>${fmtDate(p.date)}${p.packageLessons ? ` · ${p.packageLessons} занятий` : ''}${p.note ? ' · ' + esc(p.note) : ''}</small></div><b class="payment-positive">+${money(p.amount)}</b><button class="icon-btn" data-delete-payment="${p.id}" title="Удалить платёж">×</button></div>`,
          )
          .join('')
      : '<div class="empty">За последние 45 дней платежей не было</div>';
  }
  function uniqueSessions(list) {
    const rank = { done: 6, paid_missed: 5, missed: 4, planned: 3, moved: 2, cancelled: 1 },
      map = new Map();
    list.forEach((l) => {
      const k = l.seriesId || l.id,
        old = map.get(k);
      if (!old || (rank[l.status] || 0) > (rank[old.status] || 0)) map.set(k, l);
    });
    return [...map.values()];
  }
  function renderPackageAlerts() {
    const box = $('#packageAlerts'),
      items = data.students
        .filter((s) => s.payType === 'package')
        .map((s) => ({ s, left: finances(s.id).balanceLessons }))
        .filter((x) => x.left <= 2)
        .sort((a, b) => a.left - b.left);
    box.style.display = items.length ? 'block' : 'none';
    box.innerHTML = items.length
      ? `<div class="section-head"><div><h2>Заканчиваются абонементы</h2><span>Можно заранее напомнить об оплате</span></div></div><div class="list">${items.map(({ s, left }) => `<div class="row"><div class="grow"><b>${esc(s.name)}</b><small>${left <= 0 ? 'Абонемент закончился' : left === 1 ? 'Осталось последнее занятие' : `Осталось ${left} занятия`}</small></div><button class="btn" data-payment-student="${s.id}">Добавить оплату</button></div>`).join('')}</div>`
      : '';
  }
  function paymentState(s) {
    const f = finances(s.id);
    if (s.payType === 'package') {
      const left = f.balanceLessons || 0;
      return {
        kind: f.extraDebt || left <= 0 ? 'need' : left <= 2 ? 'ending' : 'ok',
        format: 'Абонемент',
        state: f.extraDebt
          ? `Доплата: долг ${money(f.extraDebt)}`
          : left < 0
            ? `Долг: ${Math.abs(left)} занят.`
            : left === 0
              ? 'Абонемент закончился'
              : left === 1
                ? 'Осталось 1 занятие'
                : `Осталось ${left} занятия`,
      };
    }
    return {
      kind: f.debt > 0 ? 'need' : 'ok',
      format: 'Разовые занятия',
      state:
        f.debt > 0
          ? `Долг ${money(f.debt)}`
          : f.balance > 0
            ? `Аванс ${money(f.balance)}`
            : 'Оплачено',
    };
  }
  function packagePlan(s, date = new Date()) {
    const start = Math.max(+s.createdAt || 0, +s.billingSince || 0),
      dates = monthlyRecurringDates(s.scheduleSlots || [], date).filter(
        (lessonDate) => lessonDate.getTime() >= start,
      ),
      lessons = dates.length;
    return { lessons, dates, cost: lessons * (+s.price || 0) };
  }

  function packagePlanDates(plan) {
    const grouped = new Map();
    plan.dates.forEach((date) => {
      const label = date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' }),
        time = date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
      grouped.set(label, [...(grouped.get(label) || []), time]);
    });
    return [...grouped]
      .map(([date, times]) => (times.length > 1 ? `${date} (${times.join(', ')})` : date))
      .join(', ');
  }
  function renderPackageMonthPlans() {
    const card = $('#packageMonthCard'),
      grid = $('#packageMonthGrid'),
      packageStudents = data.students.filter((s) => s.payType === 'package'),
      now = new Date();
    card.style.display = packageStudents.length ? 'block' : 'none';
    if (!packageStudents.length) return;
    $('#packageMonthLabel').textContent = monthName(now);
    grid.innerHTML = packageStudents
      .map((s) => {
        const plan = packagePlan(s, now);
        return `<div class="package-month-item"><div><b>${esc(s.name)}</b><small>${plan.lessons ? `${plan.lessons} ${lessonCountWord(plan.lessons)} по регулярному расписанию` : 'Регулярное расписание не заполнено'}</small></div><strong>${money(plan.cost)}</strong></div>`;
      })
      .join('');
  }
  function renderPaymentsSimple() {
    const stats = $('#paymentStats'),
      alerts = $('#packageAlerts'),
      body = $('#paymentBalances'),
      badge = $('#paymentNavBadge'),
      analyticsCard = $('#analyticsCard'),
      historyStudent = $('#paymentHistoryStudent'),
      historyHint = $('#paymentHistoryHint');
    if (!stats) return;
    renderPackageMonthPlans();
    const range = analyticsRange();
    $('#analyticsRangeLabel').textContent = range.label;
    const a = periodAnalytics(range.from, range.to);
    const debtTotal = data.students.reduce((n, s) => n + finances(s.id).debt, 0),
      debtorsN = data.students.filter((s) => finances(s.id).debt > 0).length;
    analyticsCard.style.display = data.students.length ? '' : 'none';
    const tips = [
      'Сумма реально пришедших денег в текущем месяце — по дате платежа. Пример: 1 августа родитель заплатил 20 000 ₽ за абонемент — вся сумма попадёт в август.',
      'Начислено в текущем месяце: для абонемента — полная стоимость по дате оплаты, для разовых занятий — стоимость проведённых уроков по дате занятия.',
      'Текущая задолженность прямо сейчас. Разовые: сколько родители должны. Абонементы: занятия, проведённые сверх остатка.',
    ];
    stats.innerHTML = [
      [money(a.paid), 'Реальный доход за месяц', ''],
      [money(a.charged), 'Планируемый доход за месяц', ''],
      [
        money(debtTotal),
        debtorsN ? `Долги сейчас · ${debtorsN} чел.` : 'Долгов нет',
        debtTotal ? 'debt-stat' : '',
      ],
    ]
      .map(
        (x, i) =>
          `<div class="card stat ${x[2]}"><span class="help-tip" tabindex="0" data-tip="${esc(tips[i])}">?</span><div class="value">${x[0]}</div><div class="label">${x[1]}</div></div>`,
      )
      .join('');
    alerts.style.display = 'none';
    const rows = data.students.map((s) => ({ s, ...paymentState(s) })),
      groups = [
        ['need', 'Нужно оплатить'],
        ['ending', 'Заканчиваются абонементы'],
      ],
      need = rows.filter((x) => x.kind === 'need').length,
      attention = rows.filter((x) => x.kind !== 'ok').length;
    badge.textContent = need;
    badge.classList.toggle('show', need > 0);
    body.innerHTML = attention
      ? groups
          .map(([kind, title]) => {
            const list = rows.filter((x) => x.kind === kind);
            return list.length
              ? `<tr class="payment-group-title"><th colspan="4">${title}</th></tr>${list.map((x) => `<tr class="payment-card-row"><td data-label="Ученик"><b>${esc(x.s.name)}</b></td><td data-label="Формат">${x.format}</td><td data-label="Состояние" class="${kind === 'need' ? 'payment-negative' : 'payment-positive'}"><b>${x.state}</b></td><td class="payment-card-action"><button class="btn payment-for" data-payment-student="${x.s.id}">${x.s.payType === 'package' ? 'Пополнить абонемент' : 'Добавить оплату'}</button></td></tr>`).join('')}`
              : '';
          })
          .join('')
      : rows.length
        ? '<tr class="payment-empty-row"><td colspan="4">Сейчас оплачивать ничего не нужно</td></tr>'
        : '<tr class="payment-empty-row"><td colspan="4">Учеников пока нет</td></tr>';
    // Селектор ученика для истории — сохраняем текущий выбор
    if (historyStudent) {
      const cur = historyStudent.value;
      historyStudent.innerHTML =
        '<option value="">Все ученики</option>' +
        data.students.map((s) => `<option value="${s.id}">${esc(s.name)}</option>`).join('');
      historyStudent.value = cur;
    }
    const historyFilter = historyStudent?.value || '';
    historyHint.textContent =
      range.label + (historyFilter ? ` · ${student(historyFilter)?.name || ''}` : '');
    const history = a.pays
      .filter((p) => !historyFilter || p.studentId === historyFilter)
      .sort((b, c) => new Date(c.date) - new Date(b.date));
    $('#paymentHistory').innerHTML = history.length
      ? history
          .map(
            (p) =>
              `<div class="row"><div class="grow"><b>${esc(student(p.studentId)?.name || 'Удалённый ученик')}</b><small>${fmtDate(p.date)}${p.packageLessons ? ` · ${p.packageLessons} занятий` : ''}${p.note ? ' · ' + esc(p.note) : ''}</small></div><b class="payment-positive">+${money(p.amount)}</b><button class="icon-btn" data-delete-payment="${p.id}" title="Удалить платёж">×</button></div>`,
          )
          .join('')
      : '<div class="empty">В текущем месяце платежей не было</div>';
  }
  function renderCalendar() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const start = new Date(today);
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
    const heads = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
      .map((x) => `<div class="calendar-weekday">${x}</div>`)
      .join('');
    $('#calendar').innerHTML =
      heads +
      Array.from({ length: calendarView === 'week' ? 7 : 35 }, (_, i) => {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        const ds = localDay(d),
          lessons = uniqueSessions(data.lessons.filter((l) => localDay(l.date) === ds)).map(
            (l) => ({
              date: l.date,
              html: `<div class="event event--${l.status}" role="button" tabindex="0" data-edit-lesson="${l.id}">${fmtTime(l.date)} ${esc(lessonName(l))}<br><span class="sub">${statusName(l.status)}${l.lessonKind === 'oneoff' ? ' · разовое' : ''}</span></div>`,
            }),
          ),
          own = data.events
            .filter((x) => localDay(x.date) === ds)
            .map((x) => ({
              date: x.date,
              html: `<div class="event custom-event" role="button" tabindex="0" data-edit-event="${x.id}">${fmtTime(x.date)} ${esc(x.title)}<br><span class="sub">Своё событие · ${x.duration || 60} мин</span></div>`,
            })),
          items = [...lessons, ...own].sort((a, b) => a.date.localeCompare(b.date)),
          weekday = d.toLocaleDateString('ru-RU', { weekday: 'long' }),
          past = d < today;
        return `<div class="day ${ds === localDay(today) ? 'today' : ''} ${past ? 'past-day' : ''} ${items.length ? 'has-events' : ''}"><div class="date"><span class="mobile-weekday">${weekday},&nbsp;</span>${d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}</div>${items.map((x) => x.html).join('')}</div>`;
      }).join('');
    requestAnimationFrame(() => {
      const card = $('#calendar')?.closest('.calendar-card');
      if (card) card.scrollLeft = 0;
    });
  }
  function statusName(v) {
    return (
      {
        planned: 'Запланировано',
        unconfirmed: 'Требует подтверждения',
        done: 'Проведено',
        missed: 'Пропуск',
        paid_missed: 'Пропуск с оплатой',
        moved: 'Перенесено',
        cancelled: 'Отменено',
      }[v] || v
    );
  }
  function fillStudents() {
    const cmp = (a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'ru'),
      students = [...data.students].sort(cmp),
      groups = [...data.groups].sort(cmp),
      studentOpts = students
        .map((s) => `<option value="s:${s.id}">${esc(s.name)}</option>`)
        .join(''),
      groupOpts = groups
        .map((g) => `<option value="g:${g.id}">${esc(g.name)} (группа)</option>`)
        .join('');
    $('#lessonForm [name=targetId]').innerHTML =
      '<option value="">Выберите ученика или группу</option>' + studentOpts + groupOpts;
    const plain =
      '<option value="">Выберите ученика</option>' +
      students.map((s) => `<option value="${s.id}">${esc(s.name)}</option>`).join('');
    $('#paymentForm [name=studentId]').innerHTML = plain;
    $('#groupMembers').innerHTML = students.length
      ? students
          .map(
            (s) =>
              `<label class="member-chip"><input type="checkbox" name="members" value="${s.id}"> ${esc(s.name)}</label>`,
          )
          .join('')
      : 'Сначала добавьте учеников';
    syncSelectableChips('#groupMembers', '.member-chip');
  }
  function renderReportOptions() {
    const cur = $('#reportStudent').value;
    $('#reportStudent').innerHTML =
      '<option value="">Выберите ученика</option>' +
      data.students.map((s) => `<option value="${s.id}">${esc(s.name)}</option>`).join('');
    $('#reportStudent').value = cur;
    $('#reportPeriodName').value =
      $('#reportPeriodName').value ||
      new Date()
        .toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })
        .replace(/^./, (x) => x.toUpperCase());
  }
  function paymentName(v) {
    return (
      {
        package: 'Списано из абонемента',
        paid: 'Оплачено',
        unpaid: 'Не оплачено',
        not_charged: 'Не списывать',
      }[v] || '—'
    );
  }
  function showProfile(id) {
    const s = student(id);
    if (!s) return;
    activeStudent = id;
    const m = metrics(id),
      ls = lessonsOf(id),
      tests = ls.filter((l) => l.status === 'done' && l.testDone === 'yes').length,
      next = data.lessons
        .filter(
          (l) => l.studentId === id && l.status === 'planned' && new Date(l.date) > new Date(),
        )
        .sort((a, b) => new Date(a.date) - new Date(b.date))[0],
      nextDate = next ? fmtDate(next.date, true) : 'Ближайшее занятие не запланировано',
      nextNote = next ? next.prepNote || 'Пометки пока нет' : '—';
    $('#profileBody').innerHTML =
      `<div class="profile-summary"><div class="avatar">${esc(initials(s.name))}</div><div><h2 style="margin:0">${esc(s.name)}</h2><div class="sub">${esc(s.grade || 'Класс не указан')} · ${esc(s.contact || 'Контакт не указан')}</div>${s.parentName ? `<div class="sub">Родитель: ${esc(s.parentName)}</div>` : ''}${s.lessonLink ? `<a class="btn profile-lesson-link" href="${esc(s.lessonLink)}" target="_blank" rel="noopener">Открыть занятие</a>` : ''}</div></div><div class="student-metrics"><div><b>${m.attendance}%</b><small>Посещаемость</small></div><div><b>${m.homework == null ? '—' : String(m.homework).replace('.', ',') + '/5'}</b><small>Средняя оценка ДЗ</small></div><div><b>${tests}</b><small>Проверочных</small></div></div><div class="notice"><b>Следующее занятие:</b> ${esc(nextDate)}<br><b>Пометка на следующий урок:</b> ${esc(nextNote)}</div><div class="notice"><b>Цели:</b> ${esc(s.goals || 'не указаны')}<br><b>Заметки:</b> ${esc(s.notes || 'нет')}</div><h3>История занятий</h3>${
        ls.length
          ? `<div style="overflow:auto"><table class="mini-table"><thead><tr><th>Дата</th><th>Статус</th><th>Темы / комментарий</th><th>ДЗ</th><th>Проверочная</th></tr></thead><tbody>${ls
              .slice(0, 20)
              .map((l) => {
                const grade = homeworkGrade(l);
                return `<tr><td>${fmtDate(l.date, true)}</td><td>${statusName(l.status)}</td><td>${esc(l.topics || '—')}<br><span class="sub">${esc(l.comment || '')}</span></td><td>${l.homework ? `${esc(l.homework)}${grade == null ? '' : `<br><b>Оценка ${grade}</b>`}` : grade == null ? '—' : 'Оценка ' + grade}</td><td>${l.testDone === 'yes' ? `${esc(l.testName || 'Работа')}: ${esc(l.testScore || '—')}/${esc(l.testMax || '—')}` : '—'}</td></tr>`;
              })
              .join('')}</tbody></table></div>`
          : '<div class="empty">Занятий пока нет</div>'
      }${
        data.topicLog[id] && data.topicLog[id].length
          ? `<h3 style="margin-top:18px">Ранее пройденные темы (архив)</h3><div class="sub" style="margin-bottom:8px">Список тем, сохранённый ранее (когда история занятий чистилась через 45 дней). Сейчас занятия хранятся бессрочно и все темы видны в истории выше.</div><ul style="margin:0;padding-left:18px;max-height:220px;overflow:auto">${[
              ...data.topicLog[id],
            ]
              .sort((a, b) => b.d.localeCompare(a.d))
              .map((e) => `<li style="margin:3px 0"><b>${fmtDate(e.d)}</b> — ${esc(e.t)}</li>`)
              .join('')}</ul>`
          : ''
      }`;
    open('profileModal');
  }
  function syncPackageField() {
    const f = $('#studentForm'),
      on = f.elements.payType.value === 'package',
      input = f.elements.packageSize,
      now = new Date(),
      slots = getSlots('#studentScheduleSlots'),
      count = countMonthlyRecurringLessons(slots, now);
    input.disabled = !on;
    if (!on) return;
    input.value = count;
  }
  function monthName(date) {
    return date
      .toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })
      .replace(/^./, (letter) => letter.toUpperCase());
  }
  function lessonCountWord(count) {
    const mod100 = count % 100,
      mod10 = count % 10;
    return mod100 >= 11 && mod100 <= 14
      ? 'занятий'
      : mod10 === 1
        ? 'занятие'
        : mod10 >= 2 && mod10 <= 4
          ? 'занятия'
          : 'занятий';
  }
  const builtinGoals = [
    'Повысить успеваемость',
    'Подготовиться к ОГЭ',
    'Подготовиться к ВПР',
    'Устранить пробелы',
    'Подготовиться к контрольной',
    'Углубить знания',
    'Поступить в профильный класс',
  ];
  function syncSelectableChips(container, itemSelector) {
    const box = $(container);
    if (!box) return;
    const items = [...box.children].filter((item) => item.matches(itemSelector));
    items.forEach((item) => {
      const input = $('input[type=checkbox]', item);
      item.classList.toggle('selected', !!input?.checked);
      $('.goal-chip', item)?.classList.toggle('selected', !!input?.checked);
    });
    items
      .filter((item) => $('input[type=checkbox]', item)?.checked)
      .forEach((item) => box.append(item));
    items
      .filter((item) => !$('input[type=checkbox]', item)?.checked)
      .forEach((item) => box.append(item));
  }
  function renderGoalOptions(selected = []) {
    const deleted = new Set(data.settings.deletedGoals || []),
      unknown = selected.filter(
        (x) => !builtinGoals.includes(x) && !(data.settings.customGoals || []).includes(x),
      ),
      customGoals = [...new Set([...(data.settings.customGoals || []), ...unknown])];
    const all = [...builtinGoals.filter((x) => !deleted.has(x)), ...customGoals];
    $('#goalChips').innerHTML = all
      .map(
        (v) =>
          `<span class="goal-option" data-goal-option="${esc(v)}"><label class="goal-chip"><input type="checkbox" value="${esc(v)}">${esc(v)}</label><button type="button" class="goal-remove" data-remove-goal="${esc(v)}" title="Удалить цель из списка" aria-label="Удалить цель из списка">×</button></span>`,
      )
      .join('');
  }
  function setGoalChecks(goals = '') {
    const selected = String(goals)
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean);
    renderGoalOptions(selected);
    $$('#goalChips input').forEach((x) => (x.checked = selected.includes(x.value)));
    syncSelectableChips('#goalChips', '.goal-option');
    $('#customGoal').value = '';
    persistLocal();
  }
  function collectGoals() {
    return [
      ...$$('#goalChips input:checked').map((x) => x.value),
      ...$('#customGoal')
        .value.split(',')
        .map((x) => x.trim())
        .filter(Boolean),
    ].join(', ');
  }
  function editStudent(id) {
    const s = student(id),
      f = $('#studentForm');
    if (!s) return;
    Object.keys(s).forEach((k) => {
      if (f.elements[k]) f.elements[k].value = s[k] ?? '';
    });
    setGoalChecks(s.goals || '');
    setSlots('#studentScheduleSlots', s.scheduleSlots || [], false);
    syncPackageField();
    $('#studentModalTitle').textContent = 'Редактировать ученика';
    closeAll();
    open('studentModal');
  }
  function editGroup(id) {
    const g = group(id),
      f = $('#groupForm');
    if (!g) return;
    f.reset();
    Object.keys(g).forEach((k) => {
      if (f.elements[k] && !['members'].includes(k)) f.elements[k].value = g[k] ?? '';
    });
    $$('#groupMembers input').forEach((x) => (x.checked = (g.members || []).includes(x.value)));
    syncSelectableChips('#groupMembers', '.member-chip');
    setSlots('#groupScheduleSlots', g.scheduleSlots || [], false);
    $('#deleteGroup').style.display = 'inline-block';
    closeAll();
    open('groupModal');
  }
  function groupLessonRecords(lesson) {
    if (!lesson?.groupId) return lesson ? [lesson] : [];
    return data.lessons.filter((item) =>
      lesson.seriesId
        ? item.seriesId === lesson.seriesId
        : item.groupId === lesson.groupId && item.date === lesson.date,
    );
  }
  function renderGroupAttendance(groupId, seriesId = '') {
    const g = group(groupId),
      box = $('#groupAttendance');
    if (!g) {
      box.style.display = 'none';
      $('#groupAttendanceMembers').innerHTML = '';
      return;
    }
    box.style.display = 'grid';
    const edited = data.lessons.find((l) => l.id === $('#lessonForm [name=id]').value),
      series = edited?.groupId
        ? groupLessonRecords(edited)
        : seriesId
          ? data.lessons.filter((l) => l.seriesId === seriesId)
          : [];
    $('#groupAttendanceMembers').innerHTML = (g.members || [])
      .map((id) => {
        const record = series.find((l) => l.studentId === id),
          checked = !series.length || !['missed', 'paid_missed'].includes(record?.status);
        return `<label class="member-chip"><input type="checkbox" name="attendees" value="${id}" ${checked ? 'checked' : ''}> ${esc(student(id)?.name || 'Удалён')}</label>`;
      })
      .join('');
  }
  function syncStatusForTime(changeDefault = false) {
    const f = $('#lessonForm'),
      planned = [...f.elements.status.options].find((o) => o.value === 'planned'),
      past = f.elements.date.value && new Date(f.elements.date.value) <= new Date();
    if (planned) {
      planned.hidden = !!past;
      planned.disabled = !!past;
    }
    if (changeDefault) {
      if (past && f.elements.status.value === 'planned') f.elements.status.value = 'done';
      if (!past && f.elements.status.value === 'done' && !f.elements.id.value)
        f.elements.status.value = 'planned';
    }
  }
  function renderLessonContext() {
    const f = $('#lessonForm'),
      box = $('#lessonContext'),
      raw = f.elements.targetId.value,
      [type, id] = raw.split(':'),
      date = new Date(f.elements.date.value || Date.now());
    if (!box || !id) {
      if (box) box.style.display = 'none';
      return;
    }
    const previous = data.lessons
        .filter(
          (l) =>
            new Date(l.date) < date &&
            l.status === 'done' &&
            (type === 'g' ? l.groupId === id : l.studentId === id),
        )
        .sort((a, b) => new Date(b.date) - new Date(a.date))[0],
      parts = [];
    if (previous?.homework) parts.push(`<b>Предыдущее ДЗ:</b> ${esc(previous.homework)}`);
    if (previous?.topics) parts.push(`<b>Последняя тема:</b> ${esc(previous.topics)}`);
    const current = data.lessons.find((l) => l.id === f.elements.id.value);
    if (current?.prepNote) parts.push(`<b>Подготовить к уроку:</b> ${esc(current.prepNote)}`);
    box.innerHTML = parts.join('<br>');
    box.style.display = parts.length ? 'block' : 'none';
  }
  function syncLessonPayment() {
    const f = $('#lessonForm'),
      [type, id] = (f.elements.targetId.value || '').split(':'),
      groupMode = type === 'g',
      s = type === 's' ? student(id) : null,
      pack = s?.payType === 'package',
      packageOneoff = pack && f.elements.lessonKind.value === 'oneoff',
      hidden = f.elements.lessonPaymentChoice,
      toggle = $('#lessonPaymentToggle'),
      label = $('#lessonPaymentLabel'),
      hint = $('#lessonPaymentHint'),
      existing = f.elements.id.value
        ? data.lessons.find((x) => x.id === f.elements.id.value)
        : null;
    $('#packageOneoffField').style.display = packageOneoff ? 'grid' : 'none';
    $('#lessonPaymentField').style.display = groupMode || packageOneoff ? 'none' : 'grid';
    toggle.disabled = groupMode;
    hidden.disabled = groupMode;
    if (groupMode) return;
    if (packageOneoff) {
      const select = $('#packageOneoffBilling');
      if (existing && select.dataset.lessonId !== existing.id) {
        select.value =
          existing.payment === 'package'
            ? 'package'
            : existing.payment === 'paid'
              ? 'extra_paid'
              : 'extra_unpaid';
        select.dataset.lessonId = existing.id;
      }
      hidden.value =
        select.value === 'package' ? 'package' : select.value === 'extra_paid' ? 'paid' : 'unpaid';
      $('#lessonAmountField').style.display = select.value === 'package' ? 'none' : 'grid';
      return;
    }
    $('#lessonAmountField').style.display = pack ? 'none' : 'grid';
    label.textContent = pack ? 'Списать занятие из абонемента' : 'Занятие оплачено';
    const checked = existing ? existing.payment === (pack ? 'package' : 'paid') : pack;
    toggle.checked = checked;
    hidden.value = checked ? (pack ? 'package' : 'paid') : pack ? 'not_charged' : 'unpaid';
    hint.textContent = checked
      ? pack
        ? 'Выключите, если занятие списывать не нужно'
        : 'Выключите, если оплата ещё не поступила'
      : pack
        ? 'Включите, если занятие нужно списать'
        : 'Включите, если оплата уже поступила';
  }
  function matchesRegularSlot(type, id, dateValue) {
    const owner = type === 'g' ? group(id) : student(id),
      date = new Date(dateValue);
    if (!owner || !Number.isFinite(date.getTime())) return false;
    const time = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    return (owner.scheduleSlots || []).some(
      (slot) => +slot.day === date.getDay() && slot.time === time,
    );
  }
  function syncOneoffAmount() {
    const f = $('#lessonForm');
    if (f.elements.id.value || f.elements.lessonKind.value !== 'oneoff') return;
    const [type, id] = (f.elements.targetId.value || '').split(':'),
      person = type === 'g' ? group(id) : student(id);
    f.elements.amount.value = person?.price ?? '';
  }
  function syncLessonDefaults() {
    const f = $('#lessonForm'),
      raw = f.elements.targetId.value,
      [type, id] = raw.split(':');
    if (!f.elements.id.value && id)
      f.elements.lessonKind.value = matchesRegularSlot(type, id, f.elements.date.value)
        ? 'regular'
        : 'oneoff';
    syncOneoffAmount();
    renderGroupAttendance(type === 'g' ? id : '');
    syncStatusForTime();
    syncLessonPayment();
    renderLessonContext();
    refreshParentMessage();
  }
  function updateTestFields() {
    const hidden = $('#lessonForm [name=testDone]'),
      toggle = $('#testDoneToggle');
    hidden.value = toggle.checked ? 'yes' : 'no';
    $('#testFields').style.display = toggle.checked ? 'block' : 'none';
  }
  function snapshotLesson() {
    return new URLSearchParams(new FormData($('#lessonForm'))).toString();
  }
  function syncHomeworkFields() {
    const f = $('#lessonForm'),
      toggle = $('#previousHomeworkToggle'),
      yes = toggle.checked;
    f.elements.previousHomework.value = yes ? 'yes' : 'no';
    $('#homeworkGradeField').style.display = yes ? 'grid' : 'none';
    f.elements.homeworkGrade.disabled = !yes;
  }
  function buildParentMessage() {
    const f = $('#lessonForm'),
      [type, id] = (f.elements.targetId.value || '').split(':'),
      s = type === 's' ? student(id) : null;
    if (!s) return '';
    const parent = s.parentName?.trim() ? `, ${s.parentName.trim()}` : '',
      status = f.elements.status.value,
      details = [
        f.elements.topics.value.trim() ? `Разобрали: ${f.elements.topics.value.trim()}.` : '',
        f.elements.comment.value.trim(),
        f.elements.homework.value.trim()
          ? `Новое домашнее задание: ${f.elements.homework.value.trim()}.`
          : '',
        $('#previousHomeworkToggle').checked
          ? `Предыдущее домашнее задание оценено на ${f.elements.homeworkGrade.value}.`
          : '',
        $('#testDoneToggle').checked
          ? `Проверочная работа: ${f.elements.testName.value.trim() || 'выполнена'}${f.elements.testScore.value && f.elements.testMax.value ? ` — ${f.elements.testScore.value} из ${f.elements.testMax.value}` : ''}.`
          : '',
      ].filter(Boolean);
    return [
      `Здравствуйте${parent}.`,
      ['done', 'paid_missed'].includes(status)
        ? `Сегодня занятие с ${s.name} прошло${status === 'done' ? ' по плану' : ', но ученик отсутствовал'}.`
        : `Сообщаю о занятии с ${s.name}.`,
      ...details,
    ].join(' ');
  }
  function refreshParentMessage() {
    const box = $('#parentMessage'),
      [type] = ($('#lessonForm').elements.targetId.value || '').split(':');
    $('#parentMessageField').style.display = type === 's' ? 'grid' : 'none';
    box.value = buildParentMessage();
  }
  function syncMovedField() {
    const moved = $('#lessonForm [name=status]').value === 'moved',
      field = $('#movedToField'),
      input = $('#lessonForm [name=movedTo]');
    field.style.display = moved ? 'grid' : 'none';
    input.required = moved;
  }
  function defaultLesson(studentId = '') {
    const f = $('#lessonForm');
    f.reset();
    const d = new Date(Date.now() - new Date().getTimezoneOffset() * 60000);
    f.elements.date.value = d.toISOString().slice(0, 16);
    f.elements.targetId.value = studentId ? 's:' + studentId : '';
    f.elements.status.value = 'done';
    f.elements.lessonKind.value = 'oneoff';
    $('#testDoneToggle').checked = false;
    $('#previousHomeworkToggle').checked = false;
    $('#packageOneoffBilling').dataset.lessonId = '';
    $('#deleteLesson').style.display = 'none';
    showConflict('#lessonConflict', []);
    updateTestFields();
    syncHomeworkFields();
    syncMovedField();
    syncLessonDefaults();
    syncStatusForTime(true);
    refreshParentMessage();
    lessonInitial = snapshotLesson();
  }
  function editLesson(id) {
    const l = data.lessons.find((x) => x.id === id),
      f = $('#lessonForm');
    if (!l) return;
    f.reset();
    Object.keys(l).forEach((k) => {
      if (f.elements[k]) f.elements[k].value = l[k] ?? '';
    });
    f.elements.id.value = l.id;
    f.elements.targetId.value = l.groupId ? 'g:' + l.groupId : 's:' + l.studentId;
    f.elements.lessonKind.value = l.lessonKind || (l.auto ? 'regular' : 'oneoff');
    $('#packageOneoffBilling').dataset.lessonId = '';
    $('#testDoneToggle').checked = l.testDone === 'yes' || !!l.score;
    $('#previousHomeworkToggle').checked =
      (l.previousHomework || (l.homeworkGrade !== '' && l.homeworkGrade != null ? 'yes' : 'no')) ===
      'yes';
    renderGroupAttendance(l.groupId, l.seriesId);
    $('#deleteLesson').style.display = 'inline-block';
    showConflict('#lessonConflict', []);
    updateTestFields();
    syncHomeworkFields();
    syncMovedField();
    syncStatusForTime(true);
    syncLessonPayment();
    renderLessonContext();
    refreshParentMessage();
    lessonInitial = snapshotLesson();
    open('lessonModal');
  }
  function carryNextNote(source, note) {
    if (!note) return;
    const future = data.lessons
        .filter(
          (l) =>
            new Date(l.date) > new Date(source.date) &&
            l.status === 'planned' &&
            (source.groupId
              ? l.groupId === source.groupId
              : !l.groupId && l.studentId === source.studentId),
        )
        .sort((a, b) => new Date(a.date) - new Date(b.date)),
      next = future[0];
    if (!next) return;
    if (source.groupId) {
      const targets = next.seriesId
        ? data.lessons.filter((l) => l.seriesId === next.seriesId)
        : data.lessons.filter((l) => l.groupId === source.groupId && l.date === next.date);
      targets.forEach((l) => (l.prepNote = note));
    } else next.prepNote = note;
  }
  function slotRow(slot = { day: 1, time: '17:00' }) {
    const row = document.createElement('div');
    row.className = 'schedule-slot';
    const days = [
      ['Понедельник', 1],
      ['Вторник', 2],
      ['Среда', 3],
      ['Четверг', 4],
      ['Пятница', 5],
      ['Суббота', 6],
      ['Воскресенье', 0],
    ];
    row.innerHTML = `<select class="slot-day">${days.map(([x, i]) => `<option value="${i}" ${+slot.day === i ? 'selected' : ''}>${x}</option>`).join('')}</select><input class="slot-time" type="time" value="${slot.time || '17:00'}"><button type="button" class="icon-btn remove-slot">×</button>`;
    row.querySelectorAll('select,input').forEach((x) =>
      x.addEventListener('change', () => {
        checkSlotConflict(row);
        if (row.closest('#studentScheduleSlots')) syncPackageField();
      }),
    );
    return row;
  }
  function setSlots(target, slots = [], ensureRow = true) {
    const el = $(target);
    el.innerHTML = '';
    (slots.length ? slots : ensureRow ? [{ day: 1, time: '17:00' }] : []).forEach((s) =>
      el.append(slotRow(s)),
    );
  }
  function getSlots(target) {
    return $$(target + ' .schedule-slot')
      .map((r) => ({ day: +$('.slot-day', r).value, time: $('.slot-time', r).value }))
      .filter((x) => x.time);
  }
  function minutesOf(time) {
    const [h, m] = String(time).split(':').map(Number);
    return h * 60 + m;
  }
  function calendarConflicts(
    date,
    duration = 60,
    excludeLesson = '',
    excludeEvent = '',
    excludeType = '',
    excludeId = '',
    breakMinutes = 0,
  ) {
    const start = new Date(date).getTime();
    if (!Number.isFinite(start)) return [];
    const end = start + (+duration || 60) * 60000,
      gap = (+breakMinutes || 0) * 60000,
      lesson = data.lessons
        .filter(
          (l) =>
            !['cancelled', 'moved'].includes(l.status) &&
            l.id !== excludeLesson &&
            l.seriesId !== excludeLesson,
        )
        .filter(
          (l) =>
            !(
              l.auto &&
              ((excludeType === 'student' && !l.groupId && l.studentId === excludeId) ||
                (excludeType === 'group' && l.groupId === excludeId))
            ),
        )
        .filter((l) => {
          const a = new Date(l.date).getTime(),
            b = a + lessonDuration(l) * 60000;
          return start < b + gap && end > a - gap;
        })
        .map((l) => lessonName(l)),
      events = data.events
        .filter((x) => x.id !== excludeEvent)
        .filter((x) => {
          const a = new Date(x.date).getTime(),
            b = a + (+x.duration || 60) * 60000;
          return start < b + gap && end > a - gap;
        })
        .map((x) => x.title);
    return [...new Set([...lesson, ...events])];
  }
  function showConflict(box, names, kind = 'lesson') {
    const el = $(box);
    if (!names.length) {
      el.classList.remove('show');
      el.textContent = '';
      return false;
    }
    el.textContent =
      kind === 'event'
        ? `⚠ На это время уже запланировано: ${names.join(', ')}. Сохранить всё равно можно, но проверьте расписание.`
        : `⚠ Это время уже занято: ${names.join(', ')}. Сохранить всё равно можно, но проверьте расписание.`;
    el.classList.add('show');
    return true;
  }
  function recurringConflicts(slots, duration, type, id) {
    const now = new Date(),
      found = [];
    for (let offset = 0; offset < 56; offset++) {
      const d = new Date(now);
      d.setDate(now.getDate() + offset);
      for (const slot of slots) {
        if (d.getDay() !== +slot.day) continue;
        const [h, m] = slot.time.split(':').map(Number);
        d.setHours(h, m, 0, 0);
        if (d < now) continue;
        const ignore =
            type === 'group'
              ? `grp-${id}-${new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)}`
              : '',
          names = calendarConflicts(d, duration, ignore, '', type, id, 0);
        if (names.length) found.push(...names.map((name) => `${fmtDate(d, true)} — ${name}`));
      }
    }
    const unique = [...new Set(found)];
    return unique.length > 5 ? [...unique.slice(0, 5), `и ещё ${unique.length - 5}`] : unique;
  }
  function ownSlotConflict(slots, duration) {
    for (let i = 0; i < slots.length; i++)
      for (let j = i + 1; j < slots.length; j++) {
        if (+slots[i].day !== +slots[j].day) continue;
        const a = minutesOf(slots[i].time),
          b = minutesOf(slots[j].time),
          endA = a + (+duration || 60),
          endB = b + (+duration || 60);
        if (a < endB && b < endA) return `${slots[i].time} и ${slots[j].time}`;
      }
    return '';
  }
  function conflictFor(day, time, duration, ignoreType, ignoreId, breakMinutes = 0) {
    const start = minutesOf(time),
      end = start + (+duration || 60) + breakMinutes,
      found = [];
    const inspect = (owner, type) => {
      if (type === ignoreType && owner.id === ignoreId) return;
      (owner.scheduleSlots || [])
        .filter((x) => +x.day === +day)
        .forEach((x) => {
          const otherStart = minutesOf(x.time),
            otherEnd = otherStart + (+owner.duration || 60) + breakMinutes;
          if (start < otherEnd && end > otherStart) found.push({ name: owner.name, end: otherEnd });
        });
    };
    data.students.forEach((s) => inspect(s, 'student'));
    data.groups.forEach((g) => inspect(g, 'group'));
    return found;
  }
  function checkSlotConflict(row) {
    const modal = row.closest('.modal');
    $$('.slot-conflict', modal).forEach((x) => x.remove());
    const type = modal?.closest('#groupModal') ? 'group' : 'student',
      id = modal?.querySelector('input[name=id]')?.value || '',
      duration = +modal?.querySelector('[name=duration]')?.value || 60,
      box = modal?.closest('#groupModal') ? '#groupScheduleSlots' : '#studentScheduleSlots',
      slots = getSlots(box),
      own = ownSlotConflict(slots, duration);
    if (own) {
      const note = document.createElement('div');
      note.className = 'slot-conflict';
      note.textContent = `Время ${own} пересекается внутри этого расписания.`;
      row.append(note);
      return;
    }
    const day = $('.slot-day', row).value,
      time = $('.slot-time', row).value,
      found = conflictFor(day, time, duration, type, id);
    if (!found.length) return;
    const next = Math.max(...found.map((x) => x.end)),
      suggest = `${String(Math.floor(next / 60) % 24).padStart(2, '0')}:${String(next % 60).padStart(2, '0')}`,
      note = document.createElement('div');
    note.className = 'slot-conflict';
    note.innerHTML = `⚠ Время занято: ${esc([...new Set(found.map((x) => x.name))].join(', '))}. Сохранить всё равно можно, или <button type="button" class="slot-suggestion" data-time="${suggest}">выбрать ближайшее свободное — ${suggest}</button>.`;
    row.append(note);
  }
  function generateSchedule(type, id, slots, replace = true) {
    data = generateRecurringSchedule(data, { type, id, slots, replace, uid });
  }
  function extendAllSchedules() {
    data = extendSchedules(data, { uid });
  }
  function reportRow(type, name = '', grade = 3) {
    const row = document.createElement('div');
    row.className = 'builder-item ' + (type === 'topic' ? 'topic' : '');
    row.dataset.kind = type;
    row.innerHTML = `<input class="r-name" placeholder="${type === 'topic' ? 'Название темы' : type === 'test' ? 'Название проверочной' : 'Название домашней работы'}" value="${esc(name)}">${type === 'topic' ? '' : `<label class="rating-label">Оценка<select class="r-grade">${[1, 2, 3, 4, 5].map((x) => `<option ${x == grade ? 'selected' : ''}>${x}</option>`).join('')}</select></label>`}<button class="icon-btn r-remove" type="button">×</button>`;
    return row;
  }
  function addReportRow(type, name = '', grade = 3) {
    $(type === 'topic' ? '#reportTopics' : type === 'test' ? '#reportTests' : '#reportHws').append(
      reportRow(type, name, grade),
    );
  }
  function reportRows(sel) {
    return $$(sel + ' .builder-item')
      .map((r) => ({ name: $('.r-name', r).value.trim(), grade: +($('.r-grade', r)?.value || 0) }))
      .filter((x) => x.name);
  }
  function reportPeriodLessons(id) {
    const mode = $('#reportPeriod').value,
      all = lessonsOf(id);
    if (mode === 'all') return all;
    if (mode === 'custom') {
      const fromV = $('#reportDateFrom').value,
        toV = $('#reportDateTo').value;
      if (!fromV || !toV) return [];
      const from = new Date(fromV + 'T00:00'),
        to = new Date(toV + 'T23:59:59');
      return all.filter((l) => new Date(l.date) >= from && new Date(l.date) <= to);
    }
    const cut = new Date(Date.now() - Number(mode) * 864e5);
    return all.filter((l) => new Date(l.date) >= cut);
  }
  function oldScorePercent(score = '') {
    const m = String(score).match(/([\d.]+)\s*\/\s*([\d.]+)/);
    return m ? (+m[1] / +m[2]) * 100 : Math.min(100, parseFloat(score) * 20);
  }
  function parentHomeworkLabel(l) {
    return `${fmtDate(l.date)} — ${l.topics?.trim() || 'Повторение и закрепление материала'}`;
  }
  function autoFillReport(refreshComment = false) {
    const id = $('#reportStudent').value,
      s = student(id);
    if (!s) {
      toast('Сначала выберите ученика');
      return;
    }
    const lessons = reportPeriodLessons(id),
      done = lessons.filter((l) => l.status === 'done'),
      miss = lessons.filter((l) => ['missed', 'paid_missed'].includes(l.status));
    $('#reportTopics').innerHTML = $('#reportTests').innerHTML = $('#reportHws').innerHTML = '';
    const topics = [
      ...new Set(
        done.flatMap((l) =>
          (l.topics || '')
            .split(',')
            .map((x) => x.trim())
            .filter(Boolean),
        ),
      ),
    ];
    topics.forEach((x) => addReportRow('topic', x));
    done
      .filter((l) => l.testDone === 'yes' || l.score)
      .forEach((l) => {
        const pct = l.testMax ? (+l.testScore / +l.testMax) * 100 : oldScorePercent(l.score),
          g = Math.max(1, Math.min(5, Math.round(pct / 20)));
        addReportRow('test', l.testName || l.topics || fmtDate(l.date), g || 3);
      });
    done
      .filter((l) => l.homework && homeworkGrade(l) != null)
      .forEach((l) => addReportRow('hw', parentHomeworkLabel(l), homeworkGrade(l)));
    if (refreshComment || !$('#reportComment').value.trim()) {
      const grades = done.map(homeworkGrade).filter(Number.isFinite),
        avg = grades.length
          ? Math.round((grades.reduce((a, b) => a + b, 0) / grades.length) * 10) / 10
          : null,
        assigned = done.length + miss.length,
        attendance = assigned ? done.length / assigned : 1,
        goal = (s.goals || '')
          .split(',')
          .map((x) => x.trim())
          .filter(Boolean)[0],
        motivation =
          avg == null
            ? ''
            : avg >= 4 && attendance >= 0.8
              ? 'Отмечаем повышенную мотивацию и ответственное выполнение домашних заданий.'
              : avg < 3
                ? 'Мотивация к выполнению домашних заданий пока снижена — будем закреплять привычку небольшими посильными шагами.'
                : 'Мотивация к домашней работе стабильная, продолжаем поддерживать регулярность.',
        result =
          avg >= 4
            ? 'Результаты уверенные, материал в целом усваивается хорошо.'
            : avg != null && avg < 3
              ? 'Некоторые темы требуют дополнительного закрепления и повторения.'
              : topics.length
                ? 'Продолжаем закреплять изученный материал.'
                : '';
      $('#reportComment').value = [
        goal ? `Продолжаем работать над целью: ${goal}.` : '',
        assigned ? `За выбранный период посещено ${done.length} из ${assigned} занятий.` : '',
        result,
        motivation,
        miss.length ? `Пропущено занятий: ${miss.length}.` : '',
      ]
        .filter(Boolean)
        .join(' ');
    }
    updateReportCard();
    toast('Данные и черновик комментария подготовлены');
  }
  function updateReportCard() {
    const id = $('#reportStudent').value,
      s = student(id);
    if (!s) return;
    const ls = reportPeriodLessons(id),
      done = ls.filter((l) => l.status === 'done'),
      miss = ls.filter((l) => ['missed', 'paid_missed'].includes(l.status)),
      topics = reportRows('#reportTopics'),
      tests = reportRows('#reportTests'),
      hws = reportRows('#reportHws'),
      period = $('#reportPeriodName').value.trim() || '—',
      tutor = data.settings.tutor || 'Не указано',
      assigned = done.length + miss.length;
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1, 1);
    const nextPlan = s.payType === 'package' ? packagePlan(s, nextMonth) : null,
      nextPackageText = nextPlan
        ? `В ${nextMonth.toLocaleDateString('ru-RU', { month: 'long' })} планируется ${nextPlan.lessons} ${lessonCountWord(nextPlan.lessons)}, поэтому стоимость абонемента составляет ${money(nextPlan.cost)}. Даты: ${packagePlanDates(nextPlan) || 'регулярное расписание не заполнено'}.`
        : '';
    $('#reportNextPackageBuilder').style.display = nextPlan ? '' : 'none';
    $('#paperNextPackageSection').style.display = nextPlan ? '' : 'none';
    $('#reportNextPackagePreview').textContent = nextPackageText;
    $('#paperNextPackage').textContent = nextPackageText;
    $('#paperPills').innerHTML =
      `<span class="paper-pill">Педагог: ${esc(tutor)}</span><span class="paper-pill">Ученик: ${esc(s.name)}, ${esc(s.grade || 'класс не указан')}</span><span class="paper-pill">Период: ${esc(period)}</span><span class="paper-pill">Посещено: ${done.length}/${assigned}</span>`;
    const list = (arr, graded) =>
      arr.length
        ? `<ul>${arr.map((x) => `<li>${esc(x.name)}${graded ? `: <b>оценка ${x.grade}</b> ${['', '😞', '🙁', '😐', '🙂', '😄'][x.grade]}` : ''}</li>`).join('')}</ul>`
        : '<span class="report-empty">Не было</span>';
    $('#paperTopics').innerHTML = list(topics, false);
    $('#paperTests').innerHTML = list(tests, true);
    $('#paperHws').innerHTML = list(hws, true);
    $('#paperComment').textContent = $('#reportComment').value.trim() || '—';
    const grades = [...tests, ...hws].map((x) => x.grade),
      progress = grades.length
        ? Math.round((grades.reduce((a, b) => a + b, 0) / grades.length / 5) * 100)
        : null,
      color =
        progress == null
          ? '#b8b5bf'
          : progress < 50
            ? '#ef4444'
            : progress < 70
              ? '#f97316'
              : progress < 80
                ? '#f59e0b'
                : '#22c55e',
      circumference = 326.726,
      ring = $('#paperRingValue');
    ring.style.stroke = color;
    ring.style.strokeDashoffset = String(
      progress == null ? circumference : circumference * (1 - progress / 100),
    );
    $('#paperPct').textContent = progress == null ? '—' : progress + '%';
    applyReportBlockVisibility();
  }
  function reportBlockEnabled(name) {
    return $(`[data-report-block="${name}"]`)?.checked !== false;
  }
  function applyReportBlockVisibility() {
    $$('[data-report-block]').forEach((input) => {
      const label = input.closest('.report-include-toggle'),
        state = label?.querySelector('.report-toggle-state'),
        action = input.checked ? 'Скрыть блок из отчёта' : 'Добавить блок в отчёт';
      if (state) state.textContent = input.checked ? 'В отчёте' : 'Скрыт';
      if (label) label.title = action;
      input.setAttribute('aria-label', action);
    });
    $$('[data-report-section]').forEach((section) => {
      const name = section.dataset.reportSection,
        available =
          name !== 'nextPackage' || student($('#reportStudent').value)?.payType === 'package';
      section.style.display = reportBlockEnabled(name) && available ? '' : 'none';
    });
  }
  function buildReportText() {
    const s = student($('#reportStudent').value);
    if (!s) return '';
    const lines = [`Отчёт об обучении: ${s.name}`, ''];
    const addList = (title, rows, graded = false) => {
      lines.push(title);
      if (rows.length) {
        rows.forEach((row) => lines.push(`• ${row.name}${graded ? ` — оценка ${row.grade}` : ''}`));
      } else lines.push('Не было');
      lines.push('');
    };
    if (reportBlockEnabled('general')) {
      lines.push('Общая информация');
      lines.push(`Педагог: ${data.settings.tutor || 'не указано'}`);
      lines.push(`Период: ${$('#reportPeriodName').value.trim() || '—'}`);
      lines.push($('#reportComment').value.trim() || '—');
      lines.push(`Средний результат: ${$('#paperPct').textContent}`, '');
    }
    if (reportBlockEnabled('topics')) addList('Пройденные темы', reportRows('#reportTopics'));
    if (reportBlockEnabled('hws')) addList('Домашние задания', reportRows('#reportHws'), true);
    if (reportBlockEnabled('tests'))
      addList('Проверочные работы', reportRows('#reportTests'), true);
    if (s.payType === 'package' && reportBlockEnabled('nextPackage')) {
      lines.push('Следующий месяц', $('#paperNextPackage').textContent, '');
    }
    return lines.join('\n').trim();
  }
  $('#studentForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const o = Object.fromEntries(new FormData(e.target));
    o.name = String(o.name || '').trim();
    if (!o.name) {
      inform('Введите имя ученика, а не только пробелы.', 'Не указано имя', true);
      return;
    }
    o.goals = collectGoals();
    o.price = +o.price || 0;
    o.duration = +o.duration || 60;
    o.scheduleSlots = getSlots('#studentScheduleSlots');
    o.packageSize = o.payType === 'package' ? countMonthlyRecurringLessons(o.scheduleSlots) : 0;
    const own = ownSlotConflict(o.scheduleSlots, o.duration),
      conflicts = recurringConflicts(o.scheduleSlots, o.duration, 'student', o.id),
      warnings = [];
    if (own) warnings.push(`занятия ${own} пересекаются между собой`);
    if (conflicts.length) warnings.push(`время пересекается с: ${conflicts.join(', ')}`);
    const before = o.id ? student(o.id) : null,
      formatChanged = !!before && before.payType !== o.payType;
    if (formatChanged) {
      const proceed = await ask(
        'Старые занятия и платежи останутся в истории, но новый баланс начнёт считаться с момента смены формата.',
        'Сменить формат оплаты?',
        'Сменить формат',
      );
      if (!proceed) return;
      o.billingSince = Date.now();
      data.financeArchive[o.id] = { packageUsed: 0, singleCharged: 0, since: o.billingSince };
    } else if (before?.billingSince) o.billingSince = before.billingSince;
    if (o.id) {
      const i = data.students.findIndex((s) => s.id === o.id);
      data.students[i] = { ...data.students[i], ...o };
    } else {
      o.id = uid();
      o.createdAt = Date.now();
      data.students.push(o);
    }
    generateSchedule('student', o.id, o.scheduleSlots);
    syncFutureStudentBilling(o.id, formatChanged);
    syncFutureGroupBilling();
    save();
    closeAll();
    toast(
      warnings.length
        ? `Сохранено. Внимание: ${warnings.join('; ')}`
        : formatChanged
          ? 'Формат оплаты изменён, новый баланс начат'
          : 'Ученик и расписание сохранены',
    );
    e.target.reset();
  });
  $('#groupForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(e.target),
      o = Object.fromEntries(fd);
    o.name = String(o.name || '').trim();
    if (!o.name) {
      inform('Введите название группы, а не только пробелы.', 'Не указано название', true);
      return;
    }
    o.members = fd.getAll('members');
    if (!o.members.length) {
      inform(
        'Выберите хотя бы одного ученика. Стоимость и формат оплаты каждого участника будут взяты из его карточки.',
        'В группе нет участников',
        true,
      );
      return;
    }
    o.duration = +o.duration || 60;
    o.scheduleSlots = getSlots('#groupScheduleSlots');
    const own = ownSlotConflict(o.scheduleSlots, o.duration),
      conflicts = recurringConflicts(o.scheduleSlots, o.duration, 'group', o.id),
      warnings = [];
    if (own) warnings.push(`занятия ${own} пересекаются между собой`);
    if (conflicts.length) warnings.push(`расписание пересекается с: ${conflicts.join(', ')}`);
    if (o.id) {
      const i = data.groups.findIndex((g) => g.id === o.id);
      data.groups[i] = { ...data.groups[i], ...o };
    } else {
      o.id = uid();
      data.groups.push(o);
    }
    generateSchedule('group', o.id, o.scheduleSlots);
    data.lessons = data.lessons.filter(
      (l) =>
        !(
          l.groupId === o.id &&
          l.status === 'planned' &&
          new Date(l.date) >= new Date() &&
          !o.members.includes(l.studentId)
        ),
    );
    save();
    closeAll();
    toast(
      warnings.length
        ? `Сохранено. Внимание: ${warnings.join('; ')}`
        : 'Группа и расписание на 8 недель сохранены',
    );
  });
  function applyHomeworkResult(l) {
    if (l.previousHomework !== 'yes' || l.homeworkGrade === '' || l.homeworkGrade == null) return;
    const prev = data.lessons
      .filter(
        (x) =>
          x.studentId === l.studentId && new Date(x.date) < new Date(l.date) && x.status === 'done',
      )
      .sort((a, b) => new Date(b.date) - new Date(a.date))[0];
    if (prev) {
      if (!prev.homework) prev.homework = 'Домашнее задание было задано';
      prev.homeworkResult = +l.homeworkGrade;
    }
  }
  function applyStudentBilling(l) {
    const s = student(l.studentId);
    l.amount = +s?.price || 0;
    l.payment = s?.payType === 'package' ? 'package' : 'unpaid';
  }
  function clearAbsentStudentResults(lesson) {
    if (lesson.status !== 'missed') return;
    lesson.previousHomework = 'no';
    lesson.homeworkGrade = '';
    lesson.testDone = 'no';
    lesson.testName = '';
    lesson.testScore = '';
    lesson.testMax = '';
  }
  function syncFutureStudentBilling(id, formatChanged = false) {
    const s = student(id);
    data.lessons
      .filter(
        (l) =>
          !l.groupId &&
          l.studentId === id &&
          l.status === 'planned' &&
          new Date(l.date) >= new Date(),
      )
      .forEach((l) => {
        l.amount = +s?.price || 0;
        if (formatChanged && l.payment !== 'paid')
          l.payment = s?.payType === 'package' ? 'package' : 'unpaid';
        syncPaidLessonHistory(l);
      });
  }
  function syncFutureGroupBilling() {
    const result = refreshGroupBilling(data);
    data = result.data;
    return result.changes.lessonsUpdated > 0;
  }
  function syncPaidLessonHistory(l) {
    if (l.groupId) return;
    const s = student(l.studentId),
      extraPackagePayment = s?.payType === 'package' && l.payment === 'paid',
      index = data.payments.findIndex((p) => p.lessonId === l.id),
      old = index >= 0 ? data.payments[index] : null,
      should =
        l.payment === 'paid' &&
        ['planned', 'unconfirmed', 'done', 'paid_missed'].includes(l.status);
    if (should) {
      const entry = {
        id: old?.id || uid(),
        studentId: l.studentId,
        amount: +l.amount || 0,
        date: old?.date || localDay(),
        createdAt: old?.createdAt || Date.now(),
        note: 'Оплата за занятие',
        lessonId: l.id,
        ledgerOnly: !extraPackagePayment,
        billingType: extraPackagePayment ? 'extra' : 'single',
      };
      if (index >= 0) data.payments[index] = entry;
      else data.payments.push(entry);
    } else if (index >= 0) data.payments.splice(index, 1);
  }
  $('#lessonForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(e.target),
      o = Object.fromEntries(fd),
      attendees = fd.getAll('attendees'),
      existing = data.lessons.find((l) => l.id === o.id),
      [type, id] = (o.targetId || '').split(':');
    if (!id) return;
    delete o.targetId;
    delete o.attendees;
    o.testScore = o.testScore === '' ? '' : +o.testScore;
    o.testMax = o.testMax === '' ? '' : +o.testMax;
    if (o.status === 'moved' && !o.movedTo) {
      inform(
        'Выберите новую дату и время. Без них перенесённое занятие не появится в расписании.',
        'Куда перенести занятие?',
        true,
      );
      return;
    }
    if (o.testDone === 'yes' && o.testScore !== '' && o.testMax !== '' && o.testScore > o.testMax) {
      inform(
        `Получено ${o.testScore} баллов, хотя максимум — ${o.testMax}. Исправьте результат проверочной.`,
        'Проверьте баллы',
        true,
      );
      return;
    }
    if (o.previousHomework !== 'yes') o.homeworkGrade = '';
    const owner = type === 'g' ? group(id) : student(id),
      duration = +owner?.duration || 60,
      exclude = existing ? existing.seriesId || existing.id : '',
      checkDate = o.status === 'moved' ? o.movedTo : o.date,
      conflicts = ['cancelled', 'moved'].includes(o.status)
        ? o.status === 'moved'
          ? calendarConflicts(checkDate, duration, exclude)
          : []
        : calendarConflicts(checkDate, duration, exclude);
    showConflict('#lessonConflict', conflicts);
    o.amount = +o.amount || +owner?.price || 0;
    o.payment = o.lessonPaymentChoice || 'unpaid';
    delete o.lessonPaymentChoice;
    o.reportFilled = o.status === 'done';
    let saved = [];
    if (existing) {
      const targets = existing.groupId ? groupLessonRecords(existing) : [existing];
      targets.forEach((l) => {
        const status =
          type === 'g' && o.status === 'done' && !attendees.includes(l.studentId)
            ? 'missed'
            : o.status;
        Object.assign(l, o, {
          status,
          id: l.id,
          studentId: l.studentId,
          groupId: l.groupId,
          seriesId: l.seriesId,
          manualEdited: l.auto ? true : l.manualEdited,
        });
        if (type === 'g') clearAbsentStudentResults(l);
      });
      saved = targets;
    } else if (type === 's') {
      const item = { ...o, id: uid(), studentId: id };
      data.lessons.push(item);
      saved = [item];
    } else {
      const seriesId = uid(),
        members = owner?.members || [];
      saved = members.map((studentId) => ({
        ...o,
        status: o.status === 'done' && !attendees.includes(studentId) ? 'missed' : o.status,
        id: uid(),
        seriesId,
        groupId: id,
        studentId,
      }));
      saved.forEach(clearAbsentStudentResults);
      data.lessons.push(...saved);
    }
    if (type === 'g') saved.forEach(applyStudentBilling);
    if (o.status === 'moved' && o.movedTo) {
      const source = saved[0],
        newSeries = type === 'g' ? uid() : null,
        base = {
          date: o.movedTo,
          status: 'planned',
          payment: type === 's' && owner?.payType === 'package' ? 'package' : 'unpaid',
          amount: o.amount,
          topics: '',
          homework: '',
          comment: '',
          lessonKind: 'oneoff',
          reportFilled: false,
          movedFrom: source.id,
        };
      if (type === 's') data.lessons.push({ ...base, id: uid(), studentId: id });
      else
        (owner?.members || []).forEach((studentId) => {
          const moved = { ...base, id: uid(), seriesId: newSeries, groupId: id, studentId };
          applyStudentBilling(moved);
          data.lessons.push(moved);
        });
    }
    saved.forEach((l) => {
      carryNextNote(l, o.nextNote);
      applyHomeworkResult(l);
      syncPaidLessonHistory(l);
    });
    lessonInitial = snapshotLesson();
    save();
    closeAll();
    toast(
      conflicts.length
        ? `Сохранено. Внимание: время пересекается с ${conflicts.join(', ')}`
        : o.status === 'moved'
          ? 'Перенос сохранён, новое занятие добавлено в расписание'
          : o.nextNote
            ? 'Отчёт сохранён, пометка перенесена на следующий урок'
            : 'Информация о занятии сохранена',
    );
  });
  function syncPaymentForm() {
    const f = $('#paymentForm'),
      s = student(f.elements.studentId.value),
      pack = s?.payType === 'package',
      field = $('#paymentPackageField'),
      title = $('#paymentModal .modal-head h2'),
      submit = $('#paymentForm button[type=submit]'),
      paymentMonth = f.elements.date.value
        ? new Date(f.elements.date.value + 'T12:00')
        : new Date(),
      packageLessons = pack ? packagePlan(s, paymentMonth).lessons : 0;
    field.style.display = pack ? 'grid' : 'none';
    field.querySelector('input').required = !!pack;
    if (pack) {
      field.querySelector('input').value = packageLessons;
      f.elements.amount.value = (+s.price || 0) * packageLessons;
      title.textContent = 'Пополнить абонемент';
      submit.textContent = 'Пополнить абонемент';
    } else {
      f.elements.amount.value = s?.price || '';
      title.textContent = 'Добавить оплату';
      submit.textContent = 'Сохранить оплату';
    }
  }
  $('#paymentForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const o = Object.fromEntries(new FormData(e.target)),
      s = student(o.studentId);
    o.id = uid();
    o.createdAt = Date.now();
    o.billingType = s?.payType || 'single';
    o.amount = +o.amount || 0;
    if (s?.payType === 'package') {
      o.packageLessons = +o.packageLessons || 0;
      if (!o.packageLessons) {
        inform(
          'У ученика не заполнено регулярное расписание на выбранный месяц. Сначала добавьте дни занятий в карточке ученика.',
          'Абонемент не рассчитан',
          true,
        );
        return;
      }
    } else delete o.packageLessons;
    data.payments.push(o);
    save();
    closeAll();
    toast(
      s?.payType === 'package'
        ? `Абонемент пополнен на ${o.packageLessons} занятий`
        : 'Оплата сохранена',
    );
  });
  function defaultEvent() {
    const f = $('#eventForm'),
      d = new Date(Date.now() - new Date().getTimezoneOffset() * 60000);
    f.reset();
    f.elements.id.value = '';
    f.elements.date.value = d.toISOString().slice(0, 16);
    f.elements.duration.value = 60;
    $('#deleteEvent').style.display = 'none';
    showConflict('#eventConflict', []);
  }
  function editEvent(id) {
    const item = data.events.find((x) => x.id === id),
      f = $('#eventForm');
    if (!item) return;
    f.reset();
    Object.keys(item).forEach((k) => {
      if (f.elements[k]) f.elements[k].value = item[k] ?? '';
    });
    $('#deleteEvent').style.display = 'inline-block';
    showConflict('#eventConflict', []);
    open('eventModal');
  }
  $('#eventForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const o = Object.fromEntries(new FormData(e.target));
    o.title = String(o.title || '').trim();
    if (!o.title) {
      inform('Введите название события, а не только пробелы.', 'Не указано название', true);
      return;
    }
    const conflicts = calendarConflicts(o.date, +o.duration || 60, '', o.id);
    showConflict('#eventConflict', conflicts, 'event');
    o.duration = +o.duration || 60;
    if (o.id) {
      const i = data.events.findIndex((x) => x.id === o.id);
      data.events[i] = { ...data.events[i], ...o };
    } else {
      o.id = uid();
      data.events.push(o);
    }
    save();
    closeAll();
    toast(
      conflicts.length
        ? `Событие сохранено. Внимание: время пересекается с ${conflicts.join(', ')}`
        : 'Событие добавлено в расписание',
    );
  });
  $('#deleteEvent').onclick = async () => {
    const id = $('#eventForm [name=id]').value,
      item = data.events.find((x) => x.id === id);
    if (
      item &&
      (await ask(
        `«${item.title}» · ${fmtDate(item.date, true)}. Событие исчезнет из расписания.`,
        'Удалить событие?',
        'Удалить',
      ))
    ) {
      data.events = data.events.filter((x) => x.id !== id);
      save();
      closeAll();
      toast('Событие удалено');
    }
  };
  async function requestClose() {
    if ($('#onboardingModal').classList.contains('open')) return;
    const dirty = Object.entries(modalForms).find(
      ([id, selector]) =>
        $('#' + id).classList.contains('open') &&
        modalInitial[id] != null &&
        formSnapshot(selector) !== modalInitial[id],
    );
    if (
      dirty &&
      !(await ask(
        'Введённые данные не сохранятся.',
        'Закрыть без сохранения?',
        'Закрыть без сохранения',
      ))
    )
      return;
    closeAll();
  }
  function openFromTrigger(openType) {
    if (openType === 'student') {
      const f = $('#studentForm');
      f.reset();
      f.elements.id.value = '';
      f.elements.duration.value = 60;
      f.elements.packageSize.value = 0;
      setGoalChecks('');
      setSlots('#studentScheduleSlots', [], false);
      syncPackageField();
      $('#studentModalTitle').textContent = 'Новый ученик';
      open('studentModal');
    }
    if (openType === 'group') {
      if (!data.students.length) {
        inform(
          'Сначала добавьте хотя бы одного ученика — участников группы вы будете выбирать из своих учеников.',
          'Нет учеников',
        );
        return;
      }
      const f = $('#groupForm');
      f.reset();
      f.elements.id.value = '';
      f.elements.duration.value = 60;
      $('#deleteGroup').style.display = 'none';
      fillStudents();
      setSlots('#groupScheduleSlots', [], false);
      open('groupModal');
    }
    if (openType === 'lesson') {
      defaultLesson();
      open('lessonModal');
    }
    if (openType === 'event') {
      defaultEvent();
      open('eventModal');
    }
    if (openType === 'payment') {
      const f = $('#paymentForm');
      f.reset();
      f.elements.date.value = localDay();
      open('paymentModal');
    }
  }
  function handleEntityClick(e) {
    const editLessonId = e.target.closest('[data-edit-lesson]')?.dataset.editLesson;
    if (editLessonId) editLesson(editLessonId);
    const editEventId = e.target.closest('[data-edit-event]')?.dataset.editEvent;
    if (editEventId) editEvent(editEventId);
    const sid = e.target.closest('[data-student]')?.dataset.student;
    if (sid && !editLessonId) showProfile(sid);
    const gid = e.target.closest('[data-group]')?.dataset.group;
    if (gid) editGroup(gid);
    const paySid = e.target.closest('[data-payment-student]')?.dataset.paymentStudent;
    if (paySid) {
      const f = $('#paymentForm');
      f.reset();
      f.elements.studentId.value = paySid;
      f.elements.date.value = localDay();
      open('paymentModal');
    }
  }
  $('#nav').addEventListener('click', (e) => {
    const page = e.target.closest('[data-page]')?.dataset.page;
    if (page) go(page);
  });
  $('#page-dashboard').addEventListener('click', (e) => {
    const page = e.target.closest('[data-page-go]')?.dataset.pageGo;
    if (page) go(page);
    handleEntityClick(e);
  });
  $('#page-students').addEventListener('click', (e) => {
    openFromTrigger(e.target.closest('[data-open]')?.dataset.open);
    handleEntityClick(e);
  });
  $('#page-schedule').addEventListener('click', (e) => {
    const view = e.target.closest('[data-calendar-view]')?.dataset.calendarView;
    if (view) {
      calendarView = view;
      $$('#calendarViewSwitch .pill').forEach((button) =>
        button.classList.toggle('active', button.dataset.calendarView === view),
      );
      $$('#calendarViewSwitch .pill').forEach((button) =>
        button.setAttribute('aria-pressed', String(button.dataset.calendarView === view)),
      );
      renderCalendar();
      return;
    }
    openFromTrigger(e.target.closest('[data-open]')?.dataset.open);
    handleEntityClick(e);
  });
  $('#page-payments').addEventListener('click', (e) => {
    openFromTrigger(e.target.closest('[data-open]')?.dataset.open);
    handleEntityClick(e);
  });
  for (const modalWrap of $$('.modal-wrap')) {
    modalWrap.addEventListener('click', (e) => {
      const suggestion = e.target.closest('.slot-suggestion');
      if (suggestion) {
        const row = suggestion.closest('.schedule-slot');
        $('.slot-time', row).value = suggestion.dataset.time;
        checkSlotConflict(row);
      }
      if (
        (e.target.matches('[data-close]') || e.target.classList.contains('modal-wrap')) &&
        !e.target.closest('#appDialog') &&
        e.target.id !== 'onboardingModal'
      )
        requestClose();
    });
  }
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const t = e.target;
    if (
      t.tagName === 'DIV' &&
      t.matches('[data-student],[data-group],[data-edit-lesson],[data-edit-event]')
    ) {
      e.preventDefault();
      t.click();
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return;
    const wrap = [...$$('.modal-wrap.open')].pop();
    if (!wrap) return;
    const f = [
      ...wrap.querySelectorAll(
        'a[href],button:not([disabled]),input:not([type=hidden]):not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])',
      ),
    ].filter((el) => el.offsetParent !== null);
    if (!f.length) return;
    const first = f[0],
      last = f[f.length - 1];
    if (!wrap.contains(document.activeElement)) {
      e.preventDefault();
      first.focus();
    } else if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  });
  let studentSearchTimer;
  $('#studentSearch').addEventListener('input', () => {
    clearTimeout(studentSearchTimer);
    studentSearchTimer = setTimeout(renderStudents, 150);
  });
  $('#studentFilter').addEventListener('change', renderStudents);
  $('#lessonForm [name=targetId]').addEventListener('change', syncLessonDefaults);
  $('#lessonForm [name=lessonKind]').addEventListener('change', () => {
    syncOneoffAmount();
    syncLessonPayment();
  });
  $('#packageOneoffBilling').addEventListener('change', syncLessonPayment);
  $('#lessonForm [name=date]').addEventListener('change', () => {
    syncStatusForTime(true);
    renderLessonContext();
  });
  $('#testDoneToggle').addEventListener('change', updateTestFields);
  $('#previousHomeworkToggle').addEventListener('change', syncHomeworkFields);
  $('#lessonPaymentToggle').addEventListener('change', () => {
    const f = $('#lessonForm'),
      [type, id] = (f.elements.targetId.value || '').split(':'),
      pack = type === 's' && student(id)?.payType === 'package';
    f.elements.lessonPaymentChoice.value = $('#lessonPaymentToggle').checked
      ? pack
        ? 'package'
        : 'paid'
      : pack
        ? 'not_charged'
        : 'unpaid';
    $('#lessonPaymentHint').textContent = $('#lessonPaymentToggle').checked
      ? pack
        ? 'Выключите, если занятие списывать не нужно'
        : 'Выключите, если оплата ещё не поступила'
      : pack
        ? 'Включите, если занятие нужно списать'
        : 'Включите, если оплата уже поступила';
  });
  $('#lessonForm [name=status]').addEventListener('change', syncMovedField);
  $('#lessonForm').addEventListener('input', (e) => {
    if (e.target.id === 'parentMessage') return;
    refreshParentMessage();
  });
  $('#copyParentMessage').onclick = async () => {
    const text = $('#parentMessage').value.trim();
    if (!text) return toast('Сначала заполните информацию о занятии');
    try {
      await navigator.clipboard.writeText(text);
      toast('Сообщение скопировано');
    } catch {
      $('#parentMessage').select();
      document.execCommand('copy');
      toast('Сообщение скопировано');
    }
  };
  $('#studentForm [name=payType]').addEventListener('change', syncPackageField);
  $('#paymentForm [name=studentId]').addEventListener('change', syncPaymentForm);
  $('#paymentForm [name=date]').addEventListener('change', syncPaymentForm);
  $('#page-payments').addEventListener('click', (e) => {
    if (e.target.closest('[data-open="payment"],[data-payment-student]'))
      setTimeout(syncPaymentForm);
  });
  $('#paymentModal').addEventListener('input', (e) => {
    if (!e.target.matches('#paymentForm [name=packageLessons]')) return;
    const f = $('#paymentForm'),
      s = student(f.elements.studentId.value);
    if (s?.payType === 'package')
      f.elements.amount.value = (+s.price || 0) * (+e.target.value || 0);
  });
  $('#customGoal').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const v = e.target.value.trim();
      if (!v) return;
      let existing = $$('#goalChips input').find((x) => x.value.toLowerCase() === v.toLowerCase());
      if (!existing && builtinGoals.some((x) => x.toLowerCase() === v.toLowerCase())) {
        data.settings.deletedGoals = (data.settings.deletedGoals || []).filter(
          (x) => x.toLowerCase() !== v.toLowerCase(),
        );
        renderGoalOptions();
        existing = $$('#goalChips input').find((x) => x.value.toLowerCase() === v.toLowerCase());
      }
      if (existing) {
        existing.checked = true;
        syncSelectableChips('#goalChips', '.goal-option');
        persistLocal();
        e.target.value = '';
        toast('Цель выбрана');
        return;
      }
      data.settings.customGoals = [...new Set([...(data.settings.customGoals || []), v])];
      const selected = $$('#goalChips input:checked')
        .map((x) => x.value)
        .concat(v);
      renderGoalOptions(selected);
      $$('#goalChips input').forEach((x) => (x.checked = selected.includes(x.value)));
      syncSelectableChips('#goalChips', '.goal-option');
      persistLocal();
      e.target.value = '';
      toast('Своя цель добавлена');
    }
  });
  $('#studentModal').addEventListener('change', (e) => {
    if (e.target.matches('#goalChips input[type=checkbox]'))
      syncSelectableChips('#goalChips', '.goal-option');
  });
  $('#groupModal').addEventListener('change', (e) => {
    if (e.target.matches('#groupMembers input[type=checkbox]'))
      syncSelectableChips('#groupMembers', '.member-chip');
  });
  $('#studentModal').addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-remove-goal]');
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    const goal = btn.dataset.removeGoal,
      input = $$('#goalChips input').find((x) => x.value === goal);
    if (input?.checked) return;
    if (
      !(await ask(
        `Удалить цель «${goal}» из списка? Она также будет убрана у учеников, которым назначена.`,
        'Удаление цели',
        'Удалить',
      ))
    )
      return;
    const selected = $$('#goalChips input:checked')
      .map((x) => x.value)
      .filter((x) => x !== goal);
    if (builtinGoals.includes(goal))
      data.settings.deletedGoals = [...new Set([...(data.settings.deletedGoals || []), goal])];
    data.settings.customGoals = (data.settings.customGoals || []).filter((x) => x !== goal);
    data.students.forEach(
      (s) =>
        (s.goals = String(s.goals || '')
          .split(',')
          .map((x) => x.trim())
          .filter((x) => x && x !== goal)
          .join(', ')),
    );
    renderGoalOptions(selected);
    $$('#goalChips input').forEach((x) => (x.checked = selected.includes(x.value)));
    syncSelectableChips('#goalChips', '.goal-option');
    persistLocal();
    toast('Цель удалена');
  });
  $('#addStudentSlot').onclick = () => {
    $('#studentScheduleSlots').append(slotRow());
    syncPackageField();
  };
  $('#addGroupSlot').onclick = () => $('#groupScheduleSlots').append(slotRow());
  for (const modal of [$('#studentModal'), $('#groupModal')])
    modal.addEventListener('click', (e) => {
      if (e.target.classList.contains('remove-slot')) {
        const studentSchedule = !!e.target.closest('#studentScheduleSlots');
        e.target.closest('.schedule-slot').remove();
        if (studentSchedule) syncPackageField();
      }
    });
  function toggleTheme() {
    data.settings.theme = data.settings.theme === 'dark' ? 'light' : 'dark';
    save();
  }
  $('#themeBtn').onclick = toggleTheme;
  $('#profileThemeBtn').onclick = toggleTheme;
  $('#sidebarToggle').onclick = () => {
    data.settings.sidebarCompact = !data.settings.sidebarCompact;
    save();
  };
  const tutorialSteps = [
    {
      icon: '👋',
      title: 'Начните с профиля',
      text: 'Укажите имя педагога для родительских отчётов и выберите время напоминания перед уроком. Здесь же можно сменить тему, проверить аккаунт, скачать резервную копию и заново открыть этот туториал.',
    },
    {
      icon: '👤',
      title: 'Добавьте ученика',
      text: 'Откройте раздел «Ученики», укажите стоимость одного урока, формат оплаты, цели и регулярное расписание. Имя родителя и ссылка на онлайн-занятие необязательны. Для абонемента количество уроков каждого месяца рассчитывается автоматически.',
    },
    {
      icon: '👥',
      title: 'Соберите группу',
      text: 'Выберите нескольких учеников и задайте общее расписание. Оплата при этом продолжит считаться отдельно по карточке каждого участника.',
    },
    {
      icon: '📅',
      title: 'Работайте с расписанием',
      text: 'Переключайтесь между месяцем и текущей неделей. Регулярные уроки создаются на 8 недель вперёд, а разовое занятие и личное событие добавляются вручную. При пересечении времени платформа предупредит, но решение о сохранении останется за вами.',
    },
    {
      icon: '✓',
      title: 'Заполняйте урок после проведения',
      text: 'Укажите тему, домашнее задание, результат предыдущего ДЗ, проверочную работу, оплату и пометку на следующий урок. Сообщение родителю составится автоматически и будет обновляться вместе с формой — останется только скопировать его.',
    },
    {
      icon: '₽',
      title: 'Следите за оплатами',
      text: 'Аналитика показывает реальный и планируемый доход текущего месяца. Для разовых занятий видны долг или аванс, а для абонементов — остаток и рассчитанные на месяц количество уроков и стоимость.',
    },
    {
      icon: '▤',
      title: 'Создавайте отчёты',
      text: 'Выберите ученика и период до 45 дней — данные из занятий заполнятся автоматически. Переключателями «В отчёте» можно скрыть отдельные блоки. Готовый отчёт скачивается в PNG или копируется текстом; для абонемента добавляется план следующего месяца.',
    },
    {
      icon: '☁️',
      title: 'Данные сохраняются автоматически',
      text: 'Изменения сохраняются в аккаунте и доступны на другом устройстве. Подробная история занятий, платежей и личных событий хранится 45 дней, затем финансовые итоги остаются в компактном архиве. Резервную копию всё равно полезно скачивать раз в месяц.',
    },
  ];
  let tutorialIndex = 0;
  function renderTutorial() {
    const step = tutorialSteps[tutorialIndex],
      modal = $('#tutorialModal .modal');
    modal.classList.remove('step-change');
    void modal.offsetWidth;
    modal.classList.add('step-change');
    $('#tutorialProgress').style.width = ((tutorialIndex + 1) / tutorialSteps.length) * 100 + '%';
    $('#tutorialCount').textContent = `Шаг ${tutorialIndex + 1} из ${tutorialSteps.length}`;
    $('#tutorialVisual').textContent = step.icon;
    $('#tutorialTitle').textContent = step.title;
    $('#tutorialText').textContent = step.text;
    $('#tutorialBack').style.visibility = tutorialIndex ? 'visible' : 'hidden';
    $('#tutorialNext').textContent =
      tutorialIndex === tutorialSteps.length - 1 ? 'Готово' : 'Далее';
  }
  $('#startTutorial').onclick = () => {
    tutorialIndex = 0;
    renderTutorial();
    open('tutorialModal');
  };
  $('#tutorialBack').onclick = () => {
    if (tutorialIndex) {
      tutorialIndex--;
      renderTutorial();
    }
  };
  $('#tutorialNext').onclick = () => {
    if (tutorialIndex < tutorialSteps.length - 1) {
      tutorialIndex++;
      renderTutorial();
    } else closeAll();
  };
  $('#saveSettings').onclick = () => {
    const tutor = $('#settingTutor').value.trim();
    if (!tutor) {
      inform(
        'Введите имя преподавателя, которое будет указываться в отчётах.',
        'Не указано имя',
        true,
      );
      return;
    }
    data.settings.tutor = tutor;
    data.settings.timeZone = 'auto';
    data.settings.reminder = +$('#settingReminder').value;
    save();
    scheduleReminders();
    toast('Профиль сохранён');
  };
  $('#editStudent').onclick = () => editStudent(activeStudent);
  $('#addStudentLesson').onclick = () => {
    closeAll();
    defaultLesson(activeStudent);
    open('lessonModal');
  };
  async function removeStudent(id) {
    const s = student(id);
    if (
      !s ||
      !(await ask(
        `Удалить ученика «${s.name}», его занятия и платежи? Это действие нельзя отменить.`,
        'Удаление ученика',
        'Удалить',
      ))
    )
      return;
    data.students = data.students.filter((x) => x.id !== id);
    data.lessons = data.lessons.filter((x) => x.studentId !== id);
    data.payments = data.payments.filter((x) => x.studentId !== id);
    delete data.financeArchive[id];
    delete data.topicLog[id];
    data.groups.forEach(
      (g) => (g.members = (g.members || []).filter((studentId) => studentId !== id)),
    );
    const emptyGroupIds = new Set(
      data.groups.filter((g) => !(g.members || []).length).map((g) => g.id),
    );
    data.groups = data.groups.filter((g) => !emptyGroupIds.has(g.id));
    data.lessons = data.lessons.filter((l) => !emptyGroupIds.has(l.groupId));
    save();
    closeAll();
    toast('Ученик полностью удалён');
  }
  $('#page-students').addEventListener('click', (e) => {
    const id = e.target.closest('[data-quick-delete-student]')?.dataset.quickDeleteStudent;
    if (id) {
      e.preventDefault();
      e.stopPropagation();
      removeStudent(id);
    }
  });
  async function removeGroup(id) {
    const g = group(id);
    if (
      !g ||
      !(await ask(
        `Удалить группу «${g.name}» и все её занятия? Это действие нельзя отменить.`,
        'Удаление группы',
        'Удалить',
      ))
    )
      return;
    data.groups = data.groups.filter((x) => x.id !== id);
    data.lessons = data.lessons.filter((x) => x.groupId !== id);
    save();
    closeAll();
    toast('Группа удалена');
  }
  $('#page-students').addEventListener('click', (e) => {
    const id = e.target.closest('[data-quick-delete-group]')?.dataset.quickDeleteGroup;
    if (id) {
      e.preventDefault();
      e.stopPropagation();
      removeGroup(id);
    }
  });
  function refreshFullStudentHistory() {
    const body = $('#profileBody tbody');
    if (!body || !activeStudent) return;
    const ls = lessonsOf(activeStudent).filter((l) => new Date(l.date) <= new Date());
    body.innerHTML = ls
      .map(
        (l) =>
          `<tr><td>${fmtDate(l.date, true)}</td><td>${statusName(l.status)}</td><td>${esc(l.topics || '—')}<br><span class="sub">${esc(l.comment || '')}</span></td><td>${l.homework ? `${esc(l.homework)}${homeworkGrade(l) == null ? '' : `<br><b>Оценка ${homeworkGrade(l)}</b>`}` : homeworkGrade(l) == null ? '—' : `Оценка ${homeworkGrade(l)}`}</td><td>${l.testDone === 'yes' ? `${esc(l.testName || 'Работа')}: ${esc(l.testScore || '—')}/${esc(l.testMax || '—')}` : '—'}</td></tr>`,
      )
      .join('');
  }
  $('#page-students').addEventListener('click', (e) => {
    if (e.target.closest('[data-student]')) setTimeout(refreshFullStudentHistory);
  });
  $('#deleteStudent').onclick = () => removeStudent(activeStudent);
  $('#deleteGroup').onclick = () => removeGroup($('#groupForm [name=id]').value);
  $('#deleteLesson').onclick = async () => {
    const id = $('#lessonForm [name=id]').value,
      l = data.lessons.find((x) => x.id === id);
    if (
      l &&
      (await ask(
        `${lessonName(l)} · ${fmtDate(l.date, true)}${l.groupId ? ' (вместе со всей группой на эту дату)' : ''}. Занятие сразу исчезнет из расписания.`,
        'Удалить занятие?',
        'Удалить',
      ))
    ) {
      const removed = l.groupId ? groupLessonRecords(l) : [l],
        removedIds = removed.map((x) => x.id),
        removedIdSet = new Set(removedIds);
      data.lessons = data.lessons.filter((x) => !removedIdSet.has(x.id));
      data.payments = data.payments.filter((p) => !removedIds.includes(p.lessonId));
      lessonInitial = '';
      save();
      closeAll();
      toast('Занятие удалено');
    }
  };
  function validReportDates() {
    const fromV = $('#reportDateFrom').value,
      toV = $('#reportDateTo').value;
    if (!fromV || !toV) {
      inform('Для периода «Выбрать период» нужно заполнить обе даты.', 'Не хватает дат', true);
      return false;
    }
    if (fromV > toV) {
      inform(
        'Дата «С» не может быть позже даты «По». Поменяйте даты местами или выберите другой период.',
        'Проверьте период',
        true,
      );
      return false;
    }
    const from = new Date(fromV + 'T00:00'),
      to = new Date(toV + 'T23:59:59'),
      oldest = new Date();
    oldest.setHours(0, 0, 0, 0);
    oldest.setDate(oldest.getDate() - RETENTION_DAYS);
    if (to - from > RETENTION_DAYS * 864e5 || from < oldest) {
      inform(
        'Отчёт можно построить только по данным за последние 45 дней. Сократите или сдвиньте выбранный период.',
        'Период слишком большой',
        true,
      );
      return false;
    }
    return true;
  }
  function updateReportHistoryHint() {
    const hint = $('#reportHistoryHint');
    if (hint) {
      hint.style.display = 'none';
      hint.textContent = '';
    }
  }
  function updateReportPeriodName() {
    const mode = $('#reportPeriod').value;
    if (mode !== 'custom') $('#reportPeriodName').value = `Последние ${mode} дней`;
    else {
      const from = $('#reportDateFrom').value,
        to = $('#reportDateTo').value;
      if (from && to) $('#reportPeriodName').value = `${fmtDate(from)} — ${fmtDate(to)}`;
    }
  }
  $('#page-payments').addEventListener('change', (e) => {
    if (e.target.id === 'paymentHistoryStudent') renderPaymentsSimple();
  });
  $('#reportStudent').addEventListener('change', () => {
    $('#reportComment').value = '';
    if ($('#reportStudent').value) autoFillReport(true);
  });
  $('#reportPeriod').addEventListener('change', () => {
    $('#customPeriodFields').style.display =
      $('#reportPeriod').value === 'custom' ? 'block' : 'none';
    updateReportPeriodName();
    updateReportHistoryHint();
    if ($('#reportStudent').value && $('#reportPeriod').value !== 'custom') autoFillReport(true);
  });
  $('#reportDateFrom').addEventListener('change', () => {
    updateReportPeriodName();
    updateReportHistoryHint();
    if (
      $('#reportStudent').value &&
      $('#reportDateFrom').value &&
      $('#reportDateTo').value &&
      validReportDates()
    )
      autoFillReport(true);
  });
  $('#reportDateTo').addEventListener('change', () => {
    updateReportPeriodName();
    updateReportHistoryHint();
    if (
      $('#reportStudent').value &&
      $('#reportDateFrom').value &&
      $('#reportDateTo').value &&
      validReportDates()
    )
      autoFillReport(true);
  });
  $('#reportPeriodName').addEventListener('input', updateReportCard);
  $('#reportComment').addEventListener('input', updateReportCard);
  $('#addReportTopic').onclick = () => addReportRow('topic');
  $('#addReportTest').onclick = () => addReportRow('test');
  $('#addReportHw').onclick = () => addReportRow('hw');
  $('#page-reports').addEventListener('input', (e) => {
    if (e.target.matches('.r-name,.r-grade')) updateReportCard();
  });
  $('#page-reports').addEventListener('change', (e) => {
    if (e.target.matches('[data-report-block]')) {
      applyReportBlockVisibility();
      return;
    }
    if (e.target.matches('.r-name,.r-grade')) updateReportCard();
  });
  $('#copyReportText').onclick = async () => {
    const text = buildReportText();
    if (!text) return toast('Сначала выберите ученика');
    try {
      await navigator.clipboard.writeText(text);
      toast('Текст отчёта скопирован');
    } catch {
      const area = document.createElement('textarea');
      area.value = text;
      document.body.append(area);
      area.select();
      document.execCommand('copy');
      area.remove();
      toast('Текст отчёта скопирован');
    }
  };
  $('#saveReportPng').onclick = async () => {
    updateReportCard();
    if (typeof html2canvas !== 'function') {
      inform(
        'Не удалось загрузить модуль PNG. Проверьте интернет и откройте файл заново.',
        'PNG не сохранён',
        true,
      );
      return;
    }
    const s = student($('#reportStudent').value);
    if (!s) {
      inform('Сначала выберите ученика.', 'Кого добавить в отчёт?');
      return;
    }
    try {
      const canvas = await html2canvas($('#reportCard'), { scale: 2, backgroundColor: '#ffffff' }),
        a = document.createElement('a');
      a.href = canvas.toDataURL('image/png');
      a.download = `Отчёт_${s.name.replace(/\s+/g, '_')}_${($('#reportPeriodName').value || 'период').replace(/\s+/g, '_')}.png`;
      a.click();
      toast('PNG-отчёт скачан');
    } catch {
      inform('Не удалось сохранить PNG. Попробуйте ещё раз.', 'PNG не сохранён', true);
    }
  };
  $('#page-reports').addEventListener('click', (e) => {
    if (e.target.classList.contains('r-remove')) {
      e.target.closest('.builder-item').remove();
      updateReportCard();
    }
  });
  $('#page-payments').addEventListener('click', async (e) => {
    const id = e.target.closest('[data-delete-payment]')?.dataset.deletePayment,
      payment = data.payments.find((p) => p.id === id);
    if (!payment) return;
    const linked = payment.lessonId ? data.lessons.find((l) => l.id === payment.lessonId) : null,
      message = linked
        ? 'Запись исчезнет из истории, а связанное занятие будет отмечено как неоплаченное.'
        : 'Запись исчезнет из истории, финансовый баланс будет пересчитан.';
    if (await ask(message, 'Удалить платёж?', 'Удалить')) {
      if (linked && linked.payment === 'paid') linked.payment = 'unpaid';
      data.payments = data.payments.filter((p) => p.id !== id);
      save();
      toast(linked ? 'Платёж удалён, занятие отмечено неоплаченным' : 'Платёж удалён');
    }
  });
  function reminderSound() {
    try {
      const C = window.AudioContext || window.webkitAudioContext;
      if (!C) return;
      const c = new C(),
        o = c.createOscillator(),
        g = c.createGain();
      o.frequency.value = 740;
      g.gain.setValueAtTime(0.12, c.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.45);
      o.connect(g);
      g.connect(c.destination);
      o.start();
      o.stop(c.currentTime + 0.45);
    } catch {}
  }
  function checkAlerts() {
    if (normalizePastLessons()) {
      persistLocal();
      renderAll();
    }
    const now = Date.now(),
      mins = +data.settings.reminder || 0;
    if (!mins) return;
    const soon = uniqueSessions(
      data.lessons.filter(
        (l) =>
          l.status === 'planned' &&
          new Date(l.date).getTime() >= now &&
          new Date(l.date).getTime() - now <= mins * 60000,
      ),
    ).sort((a, b) => new Date(a.date) - new Date(b.date));
    soon.forEach((l) => {
      const key = 'remind-' + (l.seriesId || l.id);
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, '1');
      reminderSound();
      if ('Notification' in window && Notification.permission === 'granted')
        new Notification('Скоро занятие', {
          body: `${fmtTime(l.date)} · ${lessonName(l)}${l.prepNote ? ' · Подготовить: ' + l.prepNote : ''}`,
        });
      toast(`Скоро занятие в ${fmtTime(l.date)}: ${lessonName(l)}`);
    });
  }
  let reminderTimer;
  function scheduleReminders() {
    clearInterval(reminderTimer);
    checkAlerts();
    reminderTimer = setInterval(checkAlerts, 60000);
    if (
      +data.settings.reminder > 0 &&
      'Notification' in window &&
      Notification.permission === 'default'
    )
      Notification.requestPermission().catch(() => {});
  }
  $('#onboardingForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const tutor = e.target.elements.tutor.value.trim();
    if (!tutor) {
      inform(
        'Введите имя преподавателя, которое будет указываться в отчётах.',
        'Не указано имя',
        true,
      );
      return;
    }
    data.settings.tutor = tutor;
    data.settings.onboarded = true;
    data.settings.firstUsedAt = data.settings.firstUsedAt || Date.now();
    save();
    closeAll();
    toast('Профиль создан');
  });
  function exportData() {
    data.settings.lastBackup = Date.now();
    if (!window.tutorCloud?.conflict) persistLocal('backup-exported');
    const backup = makeBackup(data, { appVersion: '2.0.0' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(
      new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }),
    );
    a.download = 'rezervnaya-kopiya-' + new Date().toISOString().slice(0, 10) + '.json';
    a.click();
    URL.revokeObjectURL(a.href);
    toast('Резервная копия скачана');
  }
  $('#exportBtn').onclick = exportData;
  $('#backupBtn').onclick = exportData;
  $('#importFile').onchange = async (e) => {
    try {
      const file = e.target.files[0];
      if (!file) return;
      if (!validateBackupSize(file.size)) {
        inform(
          `Размер резервной копии не должен превышать ${Math.round(MAX_BACKUP_BYTES / 1024 / 1024)} МБ.`,
          'Файл слишком большой',
          true,
        );
        return;
      }
      const obj = JSON.parse(await file.text());
      if (!validateBackup(obj).ok) throw 0;
      pendingImport = unwrapBackup(obj);
      open('importModal');
    } catch {
      pendingImport = null;
      inform(
        'Файл повреждён или создан не этой платформой. Выберите корректную резервную копию.',
        'Файл не подходит',
        true,
      );
    }
    e.target.value = '';
  };
  $('#importModal').addEventListener('click', (e) => {
    const mode = e.target.closest('[data-import-mode]')?.dataset.importMode;
    if (!mode || !pendingImport) return;
    if (mode === 'add') {
      data = mergeImported(data, pendingImport, uid);
      persistenceEnabled = true;
      save('backup-merge');
      toast('Данные из копии добавлены к имеющимся');
    } else {
      const replacement = replaceImported(data, pendingImport);
      try {
        persistence.saveRecovery(replacement.recovery);
      } catch {
        /* quota / private mode — recovery best-effort, продолжаем */
      }
      data = replacement.nextData;
      persistenceEnabled = true;
      save('backup-replace');
      toast('Текущие данные заменены копией (recovery-копия сохранена)');
    }
    pendingImport = null;
    closeAll();
  });
  $('#clearBtn').onclick = async () => {
    if (
      await ask(
        'Будут удалены все ученики, занятия и настройки. Восстановить их можно только из резервной копии.',
        'Очистить все данные?',
        'Очистить всё',
      )
    ) {
      data = structuredClone(blank);
      persistenceEnabled = true;
      save('clear-all');
      closeAll();
      open('onboardingModal');
      toast('Все данные очищены');
    }
  };
  // Кнопки демо-данных удалены из UI. Обработчики оставлять нельзя — иначе TypeError на null.onclick.
  const dataInfo = $('#page-settings .settings-grid .card:nth-child(2) p.sub');
  if (dataInfo)
    dataInfo.textContent =
      'Данные автоматически сохраняются в аккаунте и доступны после входа на другом устройстве. Детальная история занятий и платежей хранится 45 дней; финансовые итоги сохраняются компактно. Рекомендуется делать резервную копию хотя бы раз в месяц.';
  const lessonNotice = $('#lessonForm .notice');
  if (lessonNotice) {
    const context = document.createElement('div');
    context.id = 'lessonContext';
    context.className = 'notice';
    context.style.display = 'none';
    lessonNotice.after(context);
  }
  const progressTitle = $$('#reportCard h3').find((x) => x.textContent.includes('Общий прогресс'));
  if (progressTitle) progressTitle.textContent = 'Средний результат за период';
  const oldHomework = $('#lessonForm [name=homeworkPercent]');
  if (oldHomework) {
    const field = oldHomework.closest('.field'),
      grade = document.createElement('select');
    grade.name = 'homeworkGrade';
    grade.innerHTML =
      '<option value="5">5 — отлично</option><option value="4">4 — хорошо</option><option value="3">3 — удовлетворительно</option><option value="2">2 — нужно повторить</option><option value="1">1 — не выполнено</option>';
    field.querySelector('label').textContent = 'Оценка за предыдущее ДЗ';
    oldHomework.replaceWith(grade);
  }
  const paymentAmount = $('#paymentForm [name=amount]')?.closest('.field');
  if (paymentAmount) {
    const packageField = document.createElement('div');
    packageField.className = 'field';
    packageField.id = 'paymentPackageField';
    packageField.style.display = 'none';
    packageField.innerHTML =
      '<label>Количество занятий</label><input name="packageLessons" type="number" min="1" value="8">';
    paymentAmount.after(packageField);
  }
  const paymentHead = $('#paymentBalances')?.closest('table')?.querySelector('thead');
  if (paymentHead)
    paymentHead.innerHTML = '<tr><th>Ученик</th><th>Формат</th><th>Состояние</th><th></th></tr>';
  const missed = $('#lessonForm [name=status] option[value=missed]'),
    paidMissed = $('#lessonForm [name=status] option[value=paid_missed]');
  if (missed) missed.textContent = 'Пропуск — не списывать занятие';
  if (paidMissed) paidMissed.textContent = 'Пропуск — списать занятие';
  $$('.close').forEach((button) => {
    button.title = 'Закрыть';
    button.setAttribute('aria-label', 'Закрыть');
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if ($('#appDialog').classList.contains('open')) {
      finishDialog(false);
      return;
    }
    if ($('#onboardingModal').classList.contains('open')) return;
    if ($$('.modal-wrap.open').length) requestClose();
  });
  function maybeRemindBackup() {
    if (!data.settings.onboarded) return;
    const now = Date.now(),
      period = 21 * 864e5,
      activity = [
        ...data.lessons.map((l) => new Date(l.date).getTime()),
        ...data.payments.map((p) => new Date(p.date).getTime()),
      ].filter(Number.isFinite),
      first = data.settings.firstUsedAt || Math.min(...activity, now);
    data.settings.firstUsedAt = first;
    const sinceBackup = data.settings.lastBackup || first,
      lastReminder = data.settings.lastBackupReminder || 0;
    if (now - sinceBackup >= period && now - lastReminder >= period) {
      data.settings.lastBackupReminder = now;
      persistLocal();
      setTimeout(() => toast('Давно не скачивали резервную копию'), 900);
    }
  }
  const beforeBootstrap = JSON.stringify(data);
  extendAllSchedules();
  normalizePastLessons();
  data = pruneOldHistory(data, RETENTION_DAYS).data;
  syncFutureGroupBilling();
  if (loaded.stage === 'empty' || loaded.needsWrite || JSON.stringify(data) !== beforeBootstrap)
    persistLocal('bootstrap-maintenance');
  updateReportPeriodName();
  const reportMax = localDay(),
    reportMinDate = new Date();
  reportMinDate.setDate(reportMinDate.getDate() - RETENTION_DAYS);
  for (const input of [$('#reportDateFrom'), $('#reportDateTo')]) {
    input.min = localDay(reportMinDate);
    input.max = reportMax;
  }
  renderAll();
  scheduleReminders();
  setInterval(updateClock, 30000);
  maybeRemindBackup();
  if (!data.settings.onboarded && !data.settings.tutor) open('onboardingModal');
})();
