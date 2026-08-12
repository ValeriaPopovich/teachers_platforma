import { $, safeExternalUrl } from '../../shared/dom.js';
import { money } from '../../shared/format.js';
import { finances } from '../payments/finances.js';
import { scheduleText } from './students.selectors.js';
import { createStudentFormView } from './student-form.view.js';
import { createGroupFormView } from './group-form.view.js';
import { createProfileView } from './profile.view.js';

export function createStudentsView({ store, service, modal, dialog, toast, schedule, payments }) {
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
    const rows = list.map((student) => {
      const finance = paymentById.get(student.id).finance;
      return {
        student,
        initials: initials(student.name),
        contact: student.contact || student.parentContact || student.grade || 'Класс не указан',
        schedule: scheduleText(student.scheduleSlots || []),
        terms: `${money(student.price)} / ${+student.duration || 60} мин`,
        payment: paymentPresentation(student, finance),
        lessonUrl: safeExternalUrl(student.lessonLink),
      };
    });
    window.dispatchEvent(
      new CustomEvent('app:students-list-change', {
        detail: {
          rows,
          emptyReason: state.students.length ? 'filtered' : 'initial',
        },
      }),
    );
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
    const rows = groups.map((group) => {
      const memberNames = (group.members || [])
        .map((id) => state.students.find((student) => student.id === id)?.name)
        .filter(Boolean);
      return {
        group,
        direction: group.grade || 'Учебная группа',
        schedule: scheduleText(group.scheduleSlots || []),
        membersLabel: `${memberNames.length} ${countWord(memberNames.length, 'участник', 'участника', 'участников')}`,
        durationLabel: `${+group.duration || 60} мин`,
        members: memberNames.slice(0, 5).map((name) => ({ name, initials: firstLetters(name) })),
        moreCount: Math.max(0, memberNames.length - 5),
      };
    });
    window.dispatchEvent(
      new CustomEvent('app:groups-list-change', {
        detail: {
          rows,
          emptyReason: state.groups.length ? 'filtered' : 'initial',
        },
      }),
    );
  }

  function render() {
    renderStudents();
    renderGroups();
    window.dispatchEvent(
      new CustomEvent('app:students-updated', {
        detail: {
          label: `Обновлено: сегодня в ${new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`,
        },
      }),
    );
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
    const menuAction = event.target.closest('[data-menu-action]')?.dataset.menuAction;
    const menuOwnerId = event.target.closest('[data-menu-owner]')?.dataset.menuOwner;
    if (menuAction === 'edit' && menuOwnerId) {
      event.stopPropagation();
      studentForm.openEdit(menuOwnerId);
      return;
    }
    if (menuAction === 'payment' && menuOwnerId) {
      event.stopPropagation();
      payments?.openPayment?.(menuOwnerId);
      return;
    }
    if (menuAction === 'delete' && menuOwnerId) {
      event.stopPropagation();
      const student = store.getState().students.find((item) => item.id === menuOwnerId);
      if (
        student &&
        (await dialog.ask(
          `Удалить ученика «${student.name}», его занятия и платежи? Это действие нельзя отменить.`,
          'Удаление ученика',
          'Удалить',
        ))
      ) {
        service.removeStudent(menuOwnerId);
        toast('Ученик удалён');
      }
      return;
    }
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
    const menuAction = event.target.closest('[data-menu-action]')?.dataset.menuAction;
    const menuOwnerId = event.target.closest('[data-menu-owner]')?.dataset.menuOwner;
    if (menuAction === 'edit' && menuOwnerId) {
      event.stopPropagation();
      groupForm.openEdit(menuOwnerId);
      return;
    }
    if (menuAction === 'delete' && menuOwnerId) {
      event.stopPropagation();
      const group = store.getState().groups.find((item) => item.id === menuOwnerId);
      if (
        group &&
        (await dialog.ask(
          `Удалить группу «${group.name}» и все её занятия?`,
          'Удаление группы',
          'Удалить',
        ))
      ) {
        service.removeGroup(menuOwnerId);
        toast('Группа удалена');
      }
      return;
    }
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
