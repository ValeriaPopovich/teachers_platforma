import { $, escapeHtml } from '../../shared/dom.js';
import { initials, money } from '../../shared/format.js';
import { finances } from '../payments/finances.js';
import { getStudentMetrics, scheduleText } from './students.selectors.js';
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
          `Удалить ученика «${student.name}» вместе с его занятиями и платежами?`,
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

  function renderStudents() {
    const state = store.getState();
    const query = ($('#studentSearch')?.value || '').trim().toLowerCase();
    const filter = $('#studentFilter')?.value || 'all';
    const list = state.students.filter((student) => {
      const haystack =
        `${student.name || ''} ${student.grade || ''} ${student.contact || ''} ${student.parentContact || ''}`.toLowerCase();
      if (query && !haystack.includes(query)) return false;
      if (filter === 'debt' && finances(state, student.id).debt <= 0) return false;
      return true;
    });
    const grid = $('#studentGrid');
    if (!grid) return;
    grid.innerHTML = list.length
      ? list
          .map((student) => {
            const metric = getStudentMetrics(state, student.id);
            const finance = finances(state, student.id);
            const payment =
              student.payType === 'package'
                ? `${finance.balanceLessons ?? 0} зан. осталось`
                : finance.debt > 0
                  ? `Долг ${money(finance.debt)}`
                  : `Баланс ${money(Math.max(0, finance.balance || 0))}`;
            return `<article class="card student-card" data-student="${student.id}" tabindex="0" role="button" aria-label="Открыть карточку ученика ${escapeHtml(student.name)}"><div class="student-head"><div class="avatar">${escapeHtml(initials(student.name))}</div><div><h3>${escapeHtml(student.name)}</h3><div class="sub">${escapeHtml(student.grade || 'Класс не указан')}</div></div><button class="icon-btn quick-delete-student" type="button" data-delete-student="${student.id}" aria-label="Удалить ученика">×</button></div><div class="student-card-meta"><span>${escapeHtml(scheduleText(student.scheduleSlots || []))}</span><span>${escapeHtml(payment)}</span></div><div class="student-card-kpis"><span><b>${metric.attendance}%</b><small>посещаемость</small></span><span><b>${metric.homework == null ? '—' : `${String(metric.homework).replace('.', ',')}/5`}</b><small>ДЗ</small></span></div></article>`;
          })
          .join('')
      : '<div class="empty">Ученики не найдены</div>';
  }

  function renderGroups() {
    const state = store.getState();
    const grid = $('#groupGrid');
    if (!grid) return;
    grid.innerHTML = state.groups.length
      ? state.groups
          .map(
            (group) =>
              `<article class="card student-card group-card" data-group="${group.id}" tabindex="0" role="button" aria-label="Редактировать группу ${escapeHtml(group.name)}"><div class="student-head"><div class="avatar">${escapeHtml(initials(group.name))}</div><div><h3>${escapeHtml(group.name)}</h3><div class="sub">${escapeHtml(group.grade || 'Группа')}</div></div><button class="icon-btn quick-delete-group" type="button" data-delete-group="${group.id}" aria-label="Удалить группу">×</button></div><div class="student-card-meta"><span>${escapeHtml(scheduleText(group.scheduleSlots || []))}</span><span>${(group.members || []).length} уч.</span></div><div class="sub">${
                (group.members || [])
                  .map((id) => state.students.find((student) => student.id === id)?.name)
                  .filter(Boolean)
                  .map(escapeHtml)
                  .join(', ') || 'Без участников'
              }</div></article>`,
          )
          .join('')
      : '<div class="empty">Групп пока нет</div>';
  }

  function render() {
    renderStudents();
    renderGroups();
    const active = profile.getActiveStudentId();
    if (
      active &&
      $('#profileModal')?.classList.contains('open') &&
      store.getState().students.some((student) => student.id === active)
    )
      profile.render(active);
  }

  $('#studentSearch')?.addEventListener('input', renderStudents);
  $('#studentFilter')?.addEventListener('change', renderStudents);
  $('#studentGrid')?.addEventListener('click', async (event) => {
    const deleteId = event.target.closest('[data-delete-student]')?.dataset.deleteStudent;
    if (deleteId) {
      event.stopPropagation();
      const student = store.getState().students.find((item) => item.id === deleteId);
      if (
        student &&
        (await dialog.ask(
          `Удалить ученика «${student.name}» вместе с его занятиями и платежами?`,
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
    if (!['Enter', ' '].includes(event.key) || event.target.closest('button')) return;
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
    if (!['Enter', ' '].includes(event.key) || event.target.closest('button')) return;
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
