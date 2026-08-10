import { $, escapeHtml, safeExternalUrl } from '../../shared/dom.js';
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
    list.sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'ru'));
    const grid = $('#studentGrid');
    if (!grid) return;
    grid.innerHTML = list.length
      ? list
          .map((student) => {
            const metric = getStudentMetrics(state, student.id);
            const finance = finances(state, student.id);
            const lessonUrl = safeExternalUrl(student.lessonLink);
            const parent = [student.parentName, student.parentContact].filter(Boolean).join(' · ');
            const payment =
              student.payType === 'package'
                ? finance.balanceLessons < 0
                  ? `Долг ${Math.abs(finance.balanceLessons)} зан.`
                  : finance.balanceLessons === 0
                    ? 'Закончился'
                    : `${finance.balanceLessons} зан.`
                : finance.debt > 0
                  ? `Долг ${money(finance.debt)}`
                  : '✓';
            return `<article class="card student-card"><button class="btn student-delete" type="button" data-delete-student="${student.id}" title="Удалить ученика" aria-label="Удалить ученика">🗑</button><div class="student-card-main" role="button" tabindex="0" aria-label="Открыть карточку: ${escapeHtml(student.name)}" data-student="${student.id}"><div class="student-top"><div><h3>${escapeHtml(student.name)}</h3><div class="meta">${escapeHtml(student.grade || 'Класс не указан')} · ${escapeHtml(scheduleText(student.scheduleSlots || []))}</div></div></div><div class="student-card-details">${student.contact ? `<div><span>Контакт ученика</span><b>${escapeHtml(student.contact)}</b></div>` : ''}${parent ? `<div><span>Родитель</span><b>${escapeHtml(parent)}</b></div>` : ''}<div><span>Условия занятий</span><b>${money(student.price)} · ${+student.duration || 60} мин · ${student.payType === 'package' ? 'абонемент' : 'разовая оплата'}</b></div>${student.goals ? `<div><span>Цели</span><b>${escapeHtml(student.goals)}</b></div>` : ''}${student.notes ? `<div class="student-card-notes"><span>Заметки</span><b>${escapeHtml(student.notes)}</b></div>` : ''}${lessonUrl ? `<a class="student-lesson-link" href="${escapeHtml(lessonUrl)}" target="_blank" rel="noopener">↗ Открыть ссылку на занятие</a>` : ''}</div><div class="student-metrics"><div><b>${metric.attendance}%</b><small>Посещение</small></div><div><b>${metric.homework == null ? '—' : `${String(metric.homework).replace('.', ',')}/5`}</b><small>Средняя оценка ДЗ</small></div><div><b class="${(student.payType === 'package' && finance.balanceLessons <= 0) || finance.debt ? 'danger-text' : ''}">${escapeHtml(payment)}</b><small>${student.payType === 'package' ? 'Абонемент' : finance.debt ? 'Долг' : 'Оплачено'}</small></div></div></div></article>`;
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
          .map((group) => {
            const members = (group.members || [])
              .map((id) => state.students.find((student) => student.id === id)?.name)
              .filter(Boolean);
            return `<article class="card student-card group-card"><button class="btn student-delete" type="button" data-delete-group="${group.id}" title="Удалить группу" aria-label="Удалить группу">🗑</button><div class="student-card-main" role="button" tabindex="0" aria-label="Открыть группу: ${escapeHtml(group.name)}" data-group="${group.id}"><div class="student-top"><div class="avatar">${escapeHtml(initials(group.name))}</div><div><h3>${escapeHtml(group.name)}</h3><div class="meta">${escapeHtml(group.grade || 'Направление не указано')} · ${escapeHtml(scheduleText(group.scheduleSlots || []))}</div></div></div><div class="student-metrics" style="grid-template-columns:repeat(2,1fr)"><div><b>${members.length}</b><small>Участников</small></div><div><b>${+group.duration || 60} мин</b><small>Длительность</small></div></div><div class="member-chips">${members.map((name) => `<span class="member-chip">${escapeHtml(name)}</span>`).join('')}</div></div></article>`;
          })
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
