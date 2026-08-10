import { $, $$ } from '../../shared/dom.js';
import { ownSlotConflict, recurringConflicts } from '../schedule/schedule.selectors.js';
import { getGroupById } from './students.selectors.js';
import { getSlots, setSlots, slotRow } from './student-form.view.js';

function syncMemberChips() {
  const box = $('#groupMembers');
  if (!box) return;
  const items = [...box.children];
  items.forEach((item) =>
    item.classList.toggle('selected', !!item.querySelector('input')?.checked),
  );
  items.filter((item) => item.querySelector('input')?.checked).forEach((item) => box.append(item));
  items.filter((item) => !item.querySelector('input')?.checked).forEach((item) => box.append(item));
}

export function createGroupFormView({ store, service, modal, dialog, toast }) {
  const form = $('#groupForm');
  function fillMemberOptions() {
    $('#groupMembers').innerHTML = store
      .getState()
      .students.map(
        (student) =>
          `<label class="member-chip"><input type="checkbox" name="members" value="${student.id}">${student.name}</label>`,
      )
      .join('');
  }
  if (!form) return { openNew() {}, openEdit() {} };

  function openNew() {
    if (!store.getState().students.length) {
      dialog.inform(
        'Сначала добавьте хотя бы одного ученика — участников группы вы будете выбирать из своих учеников.',
        'Нет учеников',
      );
      return;
    }
    form.reset();
    form.elements.id.value = '';
    form.elements.duration.value = 60;
    $('#deleteGroup').style.display = 'none';
    fillMemberOptions();
    setSlots('#groupScheduleSlots', [], false);
    modal.open('groupModal');
  }

  function openEdit(id) {
    const group = getGroupById(store.getState(), id);
    if (!group) return;
    form.reset();
    fillMemberOptions();
    Object.keys(group).forEach((key) => {
      if (form.elements[key] && key !== 'members') form.elements[key].value = group[key] ?? '';
    });
    $$('#groupMembers input').forEach((input) => {
      input.checked = (group.members || []).includes(input.value);
    });
    syncMemberChips();
    setSlots('#groupScheduleSlots', group.scheduleSlots || [], false);
    $('#deleteGroup').style.display = 'inline-block';
    modal.closeAll();
    modal.open('groupModal');
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const fd = new FormData(form);
    const input = Object.fromEntries(fd);
    input.members = fd.getAll('members');
    input.duration = +input.duration || 60;
    input.scheduleSlots = getSlots('#groupScheduleSlots');
    const own = ownSlotConflict(input.scheduleSlots, input.duration);
    const conflicts = recurringConflicts(
      store.getState(),
      input.scheduleSlots,
      input.duration,
      'group',
      input.id,
    );
    const warnings = [
      own ? `занятия ${own} пересекаются между собой` : '',
      conflicts.length ? `расписание пересекается с: ${conflicts.join(', ')}` : '',
    ].filter(Boolean);
    const result = service.saveGroup(input);
    if (!result.ok) {
      dialog.inform(result.message || 'Не удалось сохранить группу.', 'Проверьте данные', true);
      return;
    }
    modal.closeAll();
    toast(
      warnings.length
        ? `Сохранено. Внимание: ${warnings.join('; ')}`
        : 'Группа и расписание на 8 недель сохранены',
    );
  });

  $('#addGroupSlot').addEventListener('click', () => $('#groupScheduleSlots').append(slotRow()));
  $('#groupScheduleSlots').addEventListener('click', (event) => {
    if (event.target.classList.contains('remove-slot'))
      event.target.closest('.schedule-slot').remove();
  });
  $('#groupMembers').addEventListener('change', syncMemberChips);

  return { openNew, openEdit };
}
