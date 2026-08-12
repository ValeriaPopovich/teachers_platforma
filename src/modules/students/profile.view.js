import { escapeHtml, safeExternalUrl } from '../../shared/dom.js';
import { formatDate, money } from '../../shared/format.js';
import { finances } from '../payments/finances.js';
import {
  getStudentById,
  getStudentLessons,
  getStudentMetrics,
  homeworkGrade,
  scheduleText,
} from './students.selectors.js';

function icon(name) {
  const paths = {
    attendance:
      '<path d="M8.5 12.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7-1a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM3.5 18.5c0-3 2.2-5 5-5s5 2 5 5M13.5 14.5c2.5 0 4 1.6 4 4"/>',
    homework: '<path d="M5 18.5V14m4 4.5V9m4 9.5V5.5m4 13V11"/>',
    tests: '<path d="M7 3.5h7l4 4v13H7z"/><path d="M14 3.5v4h4M10 12h5m-5 3h5"/>',
    calendar:
      '<rect x="3.5" y="5.5" width="17" height="15" rx="3"/><path d="M7.5 3v5m9-5v5M3.5 10h17"/>',
    target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><path d="M12 12 20 4"/>',
    note: '<path d="M5 4.5h14v15H5z"/><path d="M8.5 9h7m-7 4h5"/>',
    user: '<circle cx="12" cy="8" r="3"/><path d="M6.5 19c0-3.3 2.2-5.5 5.5-5.5s5.5 2.2 5.5 5.5"/>',
    clock: '<circle cx="12" cy="12" r="8"/><path d="M12 7.5V12l3 2"/>',
  };
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[name] || ''}</svg>`;
}

function statusName(value) {
  return (
    {
      planned: 'Запланировано',
      unconfirmed: 'Требует подтверждения',
      done: 'Проведено',
      missed: 'Пропуск',
      paid_missed: 'Пропуск с оплатой',
      moved: 'Перенесено',
      cancelled: 'Отменено',
    }[value] || 'Статус не указан'
  );
}

function historyRow(lesson) {
  const grade = homeworkGrade(lesson);
  return `<tr class="profile-history-row" data-edit-history-lesson="${lesson.id}" tabindex="0" role="button" aria-label="Открыть занятие ${escapeHtml(formatDate(lesson.date, true))}">
    <td data-label="Дата">${formatDate(lesson.date, true)}</td>
    <td data-label="Статус">${statusName(lesson.status)}</td>
    <td data-label="Темы / комментарий">${escapeHtml(lesson.topics || '—')}<br><span class="sub">${escapeHtml(lesson.comment || '')}</span></td>
    <td data-label="ДЗ">${lesson.homework ? `${escapeHtml(lesson.homework)}${grade == null ? '' : `<br><b>Оценка ${grade}</b>`}` : grade == null ? '—' : `Оценка ${grade}`}</td>
    <td data-label="Проверочная">${lesson.testDone === 'yes' ? `${escapeHtml(lesson.testName || 'Работа')}: ${escapeHtml(lesson.testScore || '—')}/${escapeHtml(lesson.testMax || '—')}` : '—'}</td>
    <td data-label=""><button class="icon-btn" type="button" data-delete-history-lesson="${lesson.id}" title="Удалить занятие" aria-label="Удалить занятие ${escapeHtml(formatDate(lesson.date, true))}">×</button></td>
  </tr>`;
}

export function createProfileView({
  store,
  modal,
  onEditStudent,
  onAddLesson,
  onEditLesson,
  onDeleteLesson,
  onDeleteStudent,
}) {
  let activeStudentId = null;
  const body = document.querySelector('#profileBody');
  const editButton = document.querySelector('#editStudent');
  const addButton = document.querySelector('#addStudentLesson');
  const deleteButton = document.querySelector('#deleteStudent');

  function render(id) {
    const state = store.getState();
    const student = getStudentById(state, id);
    if (!student || !body) return;
    activeStudentId = id;
    const metrics = getStudentMetrics(state, id);
    const lessons = getStudentLessons(state, id);
    const tests = lessons.filter(
      (lesson) => lesson.status === 'done' && lesson.testDone === 'yes',
    ).length;
    const next = state.lessons
      .filter(
        (lesson) =>
          lesson.studentId === id &&
          lesson.status === 'planned' &&
          new Date(lesson.date) > new Date(),
      )
      .sort((a, b) => new Date(a.date) - new Date(b.date))[0];
    const nextDate = next ? formatDate(next.date, true) : 'Ближайшее занятие не запланировано';
    const nextNote = next?.prepNote || 'Пометки пока нет';
    const lessonUrl = safeExternalUrl(student.lessonLink);
    const paymentFormat = student.payType === 'package' ? 'Абонемент' : 'Разовая оплата';
    const lastLesson = lessons[0];
    const finance = finances(state, id);
    const lessonPreview = lastLesson
      ? `<div class="profile-preview-row"><span><small>Дата</small><b>${formatDate(lastLesson.date, true)}</b></span><span><small>Статус</small><b>${statusName(lastLesson.status)}</b></span><span><small>Темы / комментарий</small><b>${escapeHtml(lastLesson.topics || '—')}</b></span><span><small>ДЗ</small><b>${escapeHtml(lastLesson.homework || '—')}</b></span><span><small>Проверочная</small><b>${lastLesson.testDone === 'yes' ? escapeHtml(lastLesson.testName || 'Работа') : '—'}</b></span></div>`
      : '<p class="profile-empty-history">Проведённых занятий пока нет.</p>';

    body.innerHTML = `<div class="profile-redesign">
      <section class="profile-hero">
        <div class="profile-identity"><div class="profile-summary"><div><div class="profile-kicker">Ученик</div><h2 style="margin:0">${escapeHtml(student.name)}</h2><div class="sub">${escapeHtml(student.grade || 'Класс не указан')}</div>${lessonUrl ? `<a class="btn profile-lesson-link" href="${escapeHtml(lessonUrl)}" target="_blank" rel="noopener">Открыть занятие ↗</a>` : ''}</div></div></div>
        <div class="profile-meta"><div class="profile-meta-item"><span class="profile-meta-icon">${icon('user')}</span><span><small>Имя родителя</small><b>${escapeHtml(student.parentName || 'Не указано')}</b></span></div><div class="profile-meta-item"><span class="profile-meta-icon">${icon('clock')}</span><span><small>Условия занятий</small><b>${money(student.price)} · ${+student.duration || 60} мин · ${paymentFormat}</b></span></div>${student.contact || student.parentContact ? `<div class="profile-extra-contacts">${student.contact ? `<div><span>Контакт ученика</span><b>${escapeHtml(student.contact)}</b></div>` : ''}${student.parentContact ? `<div><span>Контакт родителя</span><b>${escapeHtml(student.parentContact)}</b></div>` : ''}</div>` : ''}</div>
      </section>
      <div class="student-metrics"><div class="profile-kpi"><span class="profile-kpi-icon profile-kpi-icon-attendance">${icon('attendance')}</span><b>${metrics.attendance}%</b><small>Посещаемость</small></div><div class="profile-kpi"><span class="profile-kpi-icon profile-kpi-icon-homework">${icon('homework')}</span><b>${metrics.homework == null ? '—' : `${String(metrics.homework).replace('.', ',')}/5`}</b><small>Средняя оценка ДЗ</small></div><div class="profile-kpi"><span class="profile-kpi-icon profile-kpi-icon-tests">${icon('tests')}</span><b>${tests}</b><small>Проверочных</small></div></div>
      <div class="profile-tabs" role="tablist" aria-label="Разделы карточки ученика"><button type="button" class="profile-tab" data-profile-tab="overview" role="tab" aria-selected="true">Обзор</button><button type="button" class="profile-tab" data-profile-tab="history" role="tab" aria-selected="false">История занятий</button></div>
      <section class="profile-panel profile-panel-overview" data-profile-panel="overview">
        <section class="profile-next-card"><div class="profile-next-icon">${icon('calendar')}</div><div class="profile-next-column profile-next-primary"><b>Следующее занятие</b><small>Дата и время</small><strong>${escapeHtml(nextDate)}</strong></div><div class="profile-next-column"><small>Регулярное расписание</small><span>${escapeHtml(scheduleText(student.scheduleSlots))}</span></div><div class="profile-next-column"><small>Пометка на следующий урок</small><span>${escapeHtml(nextNote)}</span></div></section>
        <div class="profile-notes-grid"><section class="profile-info-card"><span class="profile-info-icon profile-info-goals">${icon('target')}</span><div><b>Цели</b><p>${escapeHtml(student.goals || 'не указаны')}</p></div></section><section class="profile-info-card"><span class="profile-info-icon profile-info-notes">${icon('note')}</span><div><b>Заметки</b><p>${escapeHtml(student.notes || 'нет')}</p></div></section></div>
        <section class="profile-history-preview"><div class="profile-section-title"><b>Последнее занятие</b><button type="button" class="profile-history-link" data-open-history>Вся история →</button></div>${lessonPreview}</section>
      </section>
      <section class="profile-panel profile-panel-history" data-profile-panel="history" hidden><h3 class="profile-history-heading">История занятий</h3>${lessons.length ? `<div style="overflow:auto"><table class="mini-table"><thead><tr><th>Дата</th><th>Статус</th><th>Темы / комментарий</th><th>ДЗ</th><th>Проверочная</th><th aria-label="Действия"></th></tr></thead><tbody>${lessons.slice(0, 20).map(historyRow).join('')}</tbody></table></div>` : '<div class="empty">Занятий пока нет</div>'}${
        state.topicLog[id]?.length
          ? `<h3 style="margin-top:18px">Ранее пройденные темы (архив)</h3><ul style="margin:0;padding-left:18px;max-height:220px;overflow:auto">${[
              ...state.topicLog[id],
            ]
              .sort((a, b) => b.d.localeCompare(a.d))
              .map(
                (entry) =>
                  `<li style="margin:3px 0"><b>${formatDate(entry.d)}</b> — ${escapeHtml(entry.t)}</li>`,
              )
              .join('')}</ul>`
          : ''
      }</section>
      <div class="profile-finance-sr" hidden>${finance.debt}</div>
    </div>`;
    modal.open('profileModal');
  }

  function activateTab(name) {
    body.querySelectorAll('[data-profile-panel]').forEach((panel) => {
      panel.hidden = panel.dataset.profilePanel !== name;
    });
    body
      .querySelectorAll('[data-profile-tab]')
      .forEach((button) =>
        button.setAttribute('aria-selected', String(button.dataset.profileTab === name)),
      );
  }

  body?.addEventListener('click', async (event) => {
    const tab = event.target.closest('[data-profile-tab]')?.dataset.profileTab;
    if (tab) activateTab(tab);
    if (event.target.closest('[data-open-history]')) activateTab('history');
    const editId = event.target.closest('[data-edit-history-lesson]')?.dataset.editHistoryLesson;
    if (editId && !event.target.closest('[data-delete-history-lesson]')) onEditLesson?.(editId);
    const deleteId = event.target.closest('[data-delete-history-lesson]')?.dataset
      .deleteHistoryLesson;
    if (deleteId && (await onDeleteLesson?.(deleteId))) render(activeStudentId);
  });
  body?.addEventListener('keydown', (event) => {
    if (!['Enter', ' '].includes(event.key) || event.target.closest('button')) return;
    const id = event.target.closest('[data-edit-history-lesson]')?.dataset.editHistoryLesson;
    if (id) {
      event.preventDefault();
      onEditLesson?.(id);
    }
  });
  editButton?.addEventListener('click', () => activeStudentId && onEditStudent?.(activeStudentId));
  addButton?.addEventListener('click', () => activeStudentId && onAddLesson?.(activeStudentId));
  deleteButton?.addEventListener('click', async () => {
    if (activeStudentId && (await onDeleteStudent?.(activeStudentId))) modal.closeAll();
  });

  return { render, getActiveStudentId: () => activeStudentId };
}
