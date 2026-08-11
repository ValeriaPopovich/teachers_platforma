import { $, escapeHtml, safeExternalUrl } from '../../shared/dom.js';
import { money } from '../../shared/format.js';
import { finances } from '../payments/finances.js';
import { scheduleText } from './students.selectors.js';
import { createStudentFormView } from './student-form.view.js';
import { createGroupFormView } from './group-form.view.js';
import { createProfileView } from './profile.view.js';

export function createStudentsView({ store, service, modal, dialog, toast, schedule }) {
  const studentForm = createStudentFormView({ store, service, modal, dialog, toast });
  const groupForm = createGroupFormView({ store, service, modal, dialog, toast });
  const profile = createProfileView({
    store,
    modal,
    onEditStudent: studentForm.openEdit,
    onAddLesson: (studentId) => schedule?.openNewLesson?.({ studentId }),
    onEditLesson: (lessonId) => schedule?.openLesson?.(lessonId),
    onDeleteLesson: (lessonId) => schedule?.deleteLesson?.(lessonId),
    onDeleteStudent: async (id) => {
      const student = store.getState().students.find((item) => item.id === id);
      if (!student) return false;
      if (
        !(await dialog.ask(
          `Удалить ученика «${student.name}», его занятия и платежи? Это действие нельзя отменить.`,
          'Удаление ученика',
          'Удалить',
        ))
      )
        return false;
      service.removeStudent(id);
      toast('Ученик удалён');
      return true;
    },
  });

  const calendarIcon =
    '<svg class="student-fact-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3v3M17 3v3M4.5 9h15M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z"/></svg>';
  const clockIcon =
    '<svg class="student-fact-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M12 7.5V12l3 2"/></svg>';
  const videoIcon =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="6.5" width="11.5" height="11" rx="2"/><path d="m15 10 5-2.5v9L15 14"/></svg>';

  function lessonWord(value) {
    const count = Math.abs(Math.round(Number(value) || 0));
    const mod10 = count % 10;
    const mod100 = count % 100;
    if (mod10 === 1 && mod100 !== 11) return 'занятие';
    if ([2, 3, 4].includes(mod10) && ![12, 13, 14].includes(mod100)) return 'занятия';
    return 'занятий';
  }

  function countWord(value, one, few, many) {
    const count = Math.abs(Math.round(Number(value) || 0));
    const mod10 = count % 10;
    const mod100 = count % 100;
    if (mod10 === 1 && mod100 !== 11) return one;
    if ([2, 3, 4].includes(mod10) && ![12, 13, 14].includes(mod100)) return few;
    return many;
  }

  function initials(value) {
    return String(value || '')
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toUpperCase();
  }

  function firstLetters(value) {
    return [
      ...String(value || '')
        .trim()
        .replace(/\s+/g, ''),
    ]
      .slice(0, 2)
      .join('')
      .toUpperCase();
  }

  function paymentPresentation(student, finance) {
    if (student.payType === 'package') {
      if (finance.balanceLessons < 0) {
        const count = Math.abs(Math.floor(finance.balanceLessons));
        return { label: `Долг ${count} ${lessonWord(count)}`, kind: 'debt' };
      }
      if (finance.extraDebt > 0)
        return {
          label: finance.paid > 0 ? 'Частично оплачено' : `Долг ${money(finance.extraDebt)}`,
          kind: finance.paid > 0 ? 'partial' : 'debt',
        };
      if (finance.balanceLessons === 0) return { label: 'Требует оплаты', kind: 'partial' };
      return { label: 'Оплачено', kind: 'paid' };
    }
    if (finance.debt > 0)
      return {
        label: finance.paid > 0 ? 'Частично оплачено' : `Долг ${money(finance.debt)}`,
        kind: finance.paid > 0 ? 'partial' : 'debt',
      };
    return { label: 'Оплачено', kind: 'paid' };
  }

  function renderStudents() {
    const state = store.getState();
    const query = ($('#studentSearch')?.value || '').trim().toLowerCase();
    const filter = $('#studentFilter [aria-pressed="true"]')?.dataset.studentFilter || 'all';
    const sort = $('#studentSort')?.value || 'name';
    const paymentById = new Map(
      state.students.map((student) => {
        const finance = finances(state, student.id);
        return [student.id, { finance, payment: paymentPresentation(student, finance) }];
      }),
    );
    const debtCount = [...paymentById.values()].filter(
      ({ payment }) => payment.kind !== 'paid',
    ).length;
    if ($('#studentsSummary'))
      $('#studentsSummary').innerHTML =
        `<span>${state.students.length} ${countWord(state.students.length, 'ученик', 'ученика', 'учеников')}</span><i>·</i><span>${state.groups.length} ${countWord(state.groups.length, 'группа', 'группы', 'групп')}</span><i>·</i><span class="has-debt">${debtCount} с долгом</span>`;
    const list = state.students.filter((student) => {
      const haystack =
        `${student.name || ''} ${student.grade || ''} ${student.contact || ''} ${student.parentContact || ''}`.toLowerCase();
      if (query && !haystack.includes(query)) return false;
      const payment = paymentById.get(student.id).payment;
      if (filter === 'debt' && payment.kind === 'paid') return false;
      if (filter === 'paid' && payment.kind !== 'paid') return false;
      if (filter === 'unscheduled' && (student.scheduleSlots || []).length) return false;
      return true;
    });
    const nextLesson = (student) =>
      Math.min(
        ...state.lessons
          .filter(
            (lesson) =>
              lesson.studentId === student.id && new Date(lesson.date).getTime() >= Date.now(),
          )
          .map((lesson) => new Date(lesson.date).getTime()),
        Number.POSITIVE_INFINITY,
      );
    list.sort((a, b) => {
      if (sort === 'next')
        return nextLesson(a) - nextLesson(b) || String(a.name).localeCompare(String(b.name), 'ru');
      if (sort === 'debt') {
        const rank = { debt: 0, partial: 1, paid: 2 };
        return (
          rank[paymentById.get(a.id).payment.kind] - rank[paymentById.get(b.id).payment.kind] ||
          String(a.name).localeCompare(String(b.name), 'ru')
        );
      }
      return String(a.name || '').localeCompare(String(b.name || ''), 'ru');
    });
    if ($('#studentCount')) $('#studentCount').textContent = String(list.length);
    const grid = $('#studentGrid');
    if (!grid) return;
    grid.innerHTML = list.length
      ? list
          .map((student) => {
            const finance = paymentById.get(student.id).finance;
            const lessonUrl = safeExternalUrl(student.lessonLink);
            const payment = paymentPresentation(student, finance);
            const schedule = scheduleText(student.scheduleSlots || []);
            const stripe = payment.kind;
            const contact =
              student.contact || student.parentContact || student.grade || 'Класс не указан';
            return `<article class="card student-card student-card-${stripe}"><details class="student-menu"><summary aria-label="Опции ученика ${escapeHtml(student.name)}" title="Опции">•••</summary><button type="button" data-delete-student="${student.id}">Удалить</button></details><div class="student-card-main" role="button" tabindex="0" aria-label="Открыть карточку: ${escapeHtml(student.name)}" data-student="${student.id}"><div class="student-top"><span class="student-avatar" aria-hidden="true">${escapeHtml(initials(student.name))}</span><div class="student-identity"><h3>${escapeHtml(student.name)}</h3><div class="meta">${escapeHtml(contact)}</div></div></div><div class="student-card-facts"><div class="student-card-grade">${escapeHtml(student.grade || 'Класс не указан')}</div><div class="student-fact student-fact-schedule">${calendarIcon}<b>${escapeHtml(schedule)}</b></div><div class="student-fact student-fact-terms">${clockIcon}<b>${money(student.price)} / ${+student.duration || 60} мин</b></div></div><div class="student-card-footer"><span class="student-payment-status is-${payment.kind}">${escapeHtml(payment.label)}</span>${lessonUrl ? `<a class="student-lesson-link has-video" href="${escapeHtml(lessonUrl)}" target="_blank" rel="noopener" aria-label="Открыть видеозвонок ученика ${escapeHtml(student.name)}" data-tooltip="Начать видеозвонок">${videoIcon}</a>` : `<button class="student-lesson-link is-empty" type="button" data-add-lesson-link="${student.id}" aria-label="Добавить видеозвонок для ${escapeHtml(student.name)}" data-tooltip="Добавить видеозвонок"><span aria-hidden="true">＋</span></button>`}</div></div></article>`;
          })
          .join('')
      : state.students.length
        ? '<div class="students-empty"><span aria-hidden="true">⌕</span><b>Ничего не нашли</b><p>Попробуйте изменить запрос или фильтр</p></div>'
        : '<div class="students-empty"><span aria-hidden="true">☺</span><b>Здесь появятся ваши ученики</b><p>Добавьте первого ученика, чтобы настроить расписание и оплаты</p><button class="btn primary" type="button" data-open="student">+ Добавить первого ученика</button></div>';
  }

  function renderGroups() {
    const state = store.getState();
    const grid = $('#groupGrid');
    if (!grid) return;
    const query = ($('#studentSearch')?.value || '').trim().toLowerCase();
    const groups = state.groups.filter((group) => {
      const memberNames = (group.members || [])
        .map((id) => state.students.find((student) => student.id === id)?.name || '')
        .join(' ');
      return `${group.name || ''} ${group.grade || ''} ${memberNames}`
        .toLowerCase()
        .includes(query);
    });
    if ($('#groupCount')) $('#groupCount').textContent = String(groups.length);
    grid.innerHTML = groups.length
      ? groups
          .map((group) => {
            const members = (group.members || [])
              .map((id) => state.students.find((student) => student.id === id)?.name)
              .filter(Boolean);
            return `<article class="card group-card"><details class="student-menu"><summary aria-label="Опции группы ${escapeHtml(group.name)}" title="Опции">•••</summary><button type="button" data-delete-group="${group.id}">Удалить</button></details><div class="student-card-main" role="button" tabindex="0" aria-label="Открыть группу: ${escapeHtml(group.name)}" data-group="${group.id}"><div class="student-top"><div class="group-direction">${escapeHtml(group.grade || 'Учебная группа')}</div><h3>${escapeHtml(group.name)}</h3></div><div class="student-card-facts"><div class="student-fact student-fact-schedule group-schedule">${calendarIcon}<b>${escapeHtml(scheduleText(group.scheduleSlots || []))}</b></div><div class="group-facts"><span><b>${members.length} ${countWord(members.length, 'участник', 'участника', 'участников')}</b></span><i>·</i><span>${+group.duration || 60} мин</span></div></div><div class="group-card-bottom"><div class="member-chips">${members
              .slice(0, 5)
              .map(
                (name) =>
                  `<span class="member-chip" title="${escapeHtml(name)}">${escapeHtml(firstLetters(name))}</span>`,
              )
              .join(
                '',
              )}${members.length > 5 ? `<span class="member-chip member-chip-more">+${members.length - 5}</span>` : ''}</div><span class="group-open-icon" aria-hidden="true">${videoIcon}</span></div></div></article>`;
          })
          .join('')
      : state.groups.length
        ? '<div class="students-empty"><span aria-hidden="true">⌕</span><b>Группы не найдены</b><p>Попробуйте изменить поисковый запрос</p></div>'
        : '<div class="empty">Групп пока нет</div>';
  }

  function render() {
    renderStudents();
    renderGroups();
    if ($('#studentsUpdated'))
      $('#studentsUpdated').lastChild.textContent =
        ` Обновлено: сегодня в ${new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`;
    const active = profile.getActiveStudentId();
    if (
      active &&
      $('#profileModal')?.classList.contains('open') &&
      store.getState().students.some((student) => student.id === active)
    )
      profile.render(active);
  }

  $('#studentSearch')?.addEventListener('input', render);
  $('#studentSort')?.addEventListener('change', renderStudents);
  $('#studentFilter')?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-student-filter]');
    if (!button) return;
    $('#studentFilter')
      .querySelectorAll('button')
      .forEach((item) => {
        const active = item === button;
        item.classList.toggle('is-active', active);
        item.setAttribute('aria-pressed', String(active));
      });
    renderStudents();
  });
  $('#page-students')?.addEventListener('click', (event) => {
    const control = event.target.closest('[data-carousel]');
    if (!control) return;
    const carousel = document.getElementById(control.dataset.carousel);
    if (!carousel) return;
    carousel.scrollBy({
      left: (control.dataset.direction === 'prev' ? -1 : 1) * carousel.clientWidth * 0.82,
      behavior: 'smooth',
    });
  });
  $('#studentGrid')?.addEventListener('click', async (event) => {
    const addLinkId = event.target.closest('[data-add-lesson-link]')?.dataset.addLessonLink;
    if (addLinkId) {
      event.stopPropagation();
      studentForm.openEdit(addLinkId);
      return;
    }
    const deleteId = event.target.closest('[data-delete-student]')?.dataset.deleteStudent;
    if (deleteId) {
      event.stopPropagation();
      const student = store.getState().students.find((item) => item.id === deleteId);
      if (
        student &&
        (await dialog.ask(
          `Удалить ученика «${student.name}», его занятия и платежи? Это действие нельзя отменить.`,
          'Удаление ученика',
          'Удалить',
        ))
      ) {
        service.removeStudent(deleteId);
        toast('Ученик удалён');
      }
      return;
    }
    const id = event.target.closest('[data-student]')?.dataset.student;
    if (id) profile.render(id);
  });
  $('#studentGrid')?.addEventListener('keydown', (event) => {
    if (!['Enter', ' '].includes(event.key) || event.target.closest('button, a')) return;
    const id = event.target.closest('[data-student]')?.dataset.student;
    if (id) {
      event.preventDefault();
      profile.render(id);
    }
  });
  $('#groupGrid')?.addEventListener('click', async (event) => {
    const deleteId = event.target.closest('[data-delete-group]')?.dataset.deleteGroup;
    if (deleteId) {
      event.stopPropagation();
      const group = store.getState().groups.find((item) => item.id === deleteId);
      if (
        group &&
        (await dialog.ask(
          `Удалить группу «${group.name}» и все её занятия?`,
          'Удаление группы',
          'Удалить',
        ))
      ) {
        service.removeGroup(deleteId);
        toast('Группа удалена');
      }
      return;
    }
    const id = event.target.closest('[data-group]')?.dataset.group;
    if (id) groupForm.openEdit(id);
  });
  $('#groupGrid')?.addEventListener('keydown', (event) => {
    if (!['Enter', ' '].includes(event.key) || event.target.closest('button, a')) return;
    const id = event.target.closest('[data-group]')?.dataset.group;
    if (id) {
      event.preventDefault();
      groupForm.openEdit(id);
    }
  });
  $('#deleteGroup')?.addEventListener('click', async () => {
    const id = $('#groupForm')?.elements.id.value;
    const group = store.getState().groups.find((item) => item.id === id);
    if (
      group &&
      (await dialog.ask(
        `Удалить группу «${group.name}» и все её занятия?`,
        'Удаление группы',
        'Удалить',
      ))
    ) {
      service.removeGroup(id);
      modal.closeAll();
      toast('Группа удалена');
    }
  });

  return {
    render,
    openNewStudent: studentForm.openNew,
    openStudent: profile.render,
    editStudent: studentForm.openEdit,
    openNewGroup: groupForm.openNew,
    editGroup: groupForm.openEdit,
  };
}
