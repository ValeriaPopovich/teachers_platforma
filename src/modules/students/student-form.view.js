import { $, $$, escapeHtml } from '../../shared/dom.js';
import { localDay, money, lessonCountWord } from '../../shared/format.js';
import { countMonthlyRecurringLessonsFrom } from '../schedule/schedule.domain.js';
import { ownSlotConflict, recurringConflicts } from '../schedule/schedule.selectors.js';
import { getStudentById } from './students.selectors.js';

export const BUILTIN_GOALS = [
  'Повысить успеваемость',
  'Подготовиться к ОГЭ',
  'Подготовиться к ВПР',
  'Устранить пробелы',
  'Подготовиться к контрольной',
  'Углубить знания',
  'Поступить в профильный класс',
];

export function slotRow(slot = { day: 1, time: '17:00' }) {
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
  row.innerHTML = `<select class="slot-day">${days.map(([label, day]) => `<option value="${day}" ${+slot.day === day ? 'selected' : ''}>${label}</option>`).join('')}</select><input class="slot-time" type="time" value="${slot.time || '17:00'}"><button type="button" class="icon-btn remove-slot">×</button>`;
  return row;
}

export function setSlots(target, slots = [], ensureRow = true) {
  const element = $(target);
  if (!element) return;
  element.innerHTML = '';
  (slots.length ? slots : ensureRow ? [{ day: 1, time: '17:00' }] : []).forEach((slot) =>
    element.append(slotRow(slot)),
  );
}

export function getSlots(target) {
  return $$(target + ' .schedule-slot')
    .map((row) => ({ day: +$('.slot-day', row).value, time: $('.slot-time', row).value }))
    .filter((slot) => slot.time);
}

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

export function createStudentFormView({ store, service, modal, dialog, toast }) {
  const form = $('#studentForm');
  if (!form) return { openNew() {}, openEdit() {} };

  function renderGoalOptions(selected = []) {
    const state = store.getState();
    const deleted = new Set(state.settings.deletedGoals || []);
    const unknown = selected.filter(
      (goal) => !BUILTIN_GOALS.includes(goal) && !(state.settings.customGoals || []).includes(goal),
    );
    const custom = [...new Set([...(state.settings.customGoals || []), ...unknown])];
    const all = [...BUILTIN_GOALS.filter((goal) => !deleted.has(goal)), ...custom];
    $('#goalChips').innerHTML = all
      .map(
        (goal) =>
          `<span class="goal-option" data-goal-option="${escapeHtml(goal)}"><label class="goal-chip"><input type="checkbox" value="${escapeHtml(goal)}">${escapeHtml(goal)}</label><button type="button" class="goal-remove" data-remove-goal="${escapeHtml(goal)}" title="Удалить цель из списка" aria-label="Удалить цель из списка">×</button></span>`,
      )
      .join('');
  }

  function setGoalChecks(goals = '') {
    const selected = String(goals)
      .split(',')
      .map((goal) => goal.trim())
      .filter(Boolean);
    renderGoalOptions(selected);
    $$('#goalChips input').forEach((input) => {
      input.checked = selected.includes(input.value);
    });
    syncSelectableChips('#goalChips', '.goal-option');
    $('#customGoal').value = '';
  }

  function collectGoals() {
    return [
      ...$$('#goalChips input:checked').map((input) => input.value),
      ...$('#customGoal')
        .value.split(',')
        .map((goal) => goal.trim())
        .filter(Boolean),
    ].join(', ');
  }

  function syncPackageField() {
    const enabled = form.elements.payType.value === 'package';
    const current = form.elements.id.value
      ? getStudentById(store.getState(), form.elements.id.value)
      : null;
    const startInput = form.elements.billingStartDate;
    const selectedStart = startInput.value
      ? startInput.value === localDay()
        ? Date.now()
        : new Date(`${startInput.value}T00:00`).getTime()
      : Date.now();
    const start = current
      ? Math.max(+current.createdAt || 0, +current.billingSince || 0)
      : selectedStart;
    const slots = getSlots('#studentScheduleSlots');
    const count = countMonthlyRecurringLessonsFrom(slots, new Date(start), start);
    form.elements.packageSize.disabled = !enabled;
    $('#studentBillingStartField').style.display = enabled && !current ? 'block' : 'none';
    if (!enabled) return;
    form.elements.packageSize.value = count;
    const hint = $('#studentBillingStartHint');
    if (hint && !current)
      hint.textContent = slots.length
        ? `${count} ${lessonCountWord(count)} · ${money(count * (+form.elements.price.value || 0))}`
        : 'Добавьте регулярное расписание — сумма рассчитается автоматически';
  }

  function slotWarnings(input) {
    const own = ownSlotConflict(input.scheduleSlots, input.duration);
    const conflicts = recurringConflicts(
      store.getState(),
      input.scheduleSlots,
      input.duration,
      'student',
      input.id,
    );
    return [
      own ? `занятия ${own} пересекаются между собой` : '',
      conflicts.length ? `время пересекается с: ${conflicts.join(', ')}` : '',
    ].filter(Boolean);
  }

  function serialize() {
    const input = Object.fromEntries(new FormData(form));
    input.goals = collectGoals();
    input.scheduleSlots = getSlots('#studentScheduleSlots');
    input.price = +input.price || 0;
    input.duration = +input.duration || 60;
    return input;
  }

  async function submit(event) {
    event.preventDefault();
    const input = serialize();
    const warnings = slotWarnings(input);
    let result = service.saveStudent(input, { today: localDay() });
    if (!result.ok && result.code === 'PAYMENT_FORMAT_CONFIRM_REQUIRED') {
      const confirmed = await dialog.ask(
        result.message,
        'Сменить формат оплаты?',
        'Сменить формат',
      );
      if (!confirmed) return;
      result = service.saveStudent(input, { today: localDay(), confirmPaymentFormatChange: true });
    }
    if (!result.ok) {
      dialog.inform(result.message || 'Не удалось сохранить ученика.', 'Проверьте данные', true);
      return;
    }
    modal.closeAll();
    form.reset();
    toast(
      warnings.length
        ? `Сохранено. Внимание: ${warnings.join('; ')}`
        : result.formatChanged
          ? 'Формат оплаты изменён, новый баланс начат'
          : 'Ученик и расписание сохранены',
    );
  }

  function openNew() {
    form.reset();
    form.elements.id.value = '';
    form.elements.duration.value = 60;
    form.elements.packageSize.value = 0;
    form.elements.billingStartDate.value = localDay();
    setGoalChecks('');
    setSlots('#studentScheduleSlots', [], false);
    $('#studentModalTitle').textContent = 'Новый ученик';
    syncPackageField();
    modal.open('studentModal');
  }

  function openEdit(id) {
    const student = getStudentById(store.getState(), id);
    if (!student) return;
    form.reset();
    Object.keys(student).forEach((key) => {
      if (form.elements[key]) form.elements[key].value = student[key] ?? '';
    });
    setGoalChecks(student.goals || '');
    setSlots('#studentScheduleSlots', student.scheduleSlots || [], false);
    $('#studentModalTitle').textContent = 'Редактировать ученика';
    syncPackageField();
    modal.closeAll();
    modal.open('studentModal');
  }

  form.addEventListener('submit', submit);
  form.elements.payType.addEventListener('change', syncPackageField);
  form.elements.billingStartDate.addEventListener('change', syncPackageField);
  form.elements.price.addEventListener('input', syncPackageField);
  $('#addStudentSlot').addEventListener('click', () => {
    $('#studentScheduleSlots').append(slotRow());
    syncPackageField();
  });
  $('#studentScheduleSlots').addEventListener('click', (event) => {
    if (!event.target.classList.contains('remove-slot')) return;
    event.target.closest('.schedule-slot').remove();
    syncPackageField();
  });
  $('#studentScheduleSlots').addEventListener('change', syncPackageField);
  $('#studentModal').addEventListener('change', (event) => {
    if (event.target.matches('#goalChips input[type=checkbox]'))
      syncSelectableChips('#goalChips', '.goal-option');
  });
  $('#customGoal').addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    const value = event.target.value.trim();
    if (!value) return;
    const selected = $$('#goalChips input:checked').map((input) => input.value);
    const existing = $$('#goalChips input').find(
      (input) => input.value.toLowerCase() === value.toLowerCase(),
    );
    if (existing) existing.checked = true;
    else {
      service.addCustomGoal(value);
      selected.push(value);
      renderGoalOptions(selected);
      $$('#goalChips input').forEach((input) => {
        input.checked = selected.includes(input.value);
      });
    }
    syncSelectableChips('#goalChips', '.goal-option');
    event.target.value = '';
    toast('Цель выбрана');
  });
  $('#studentModal').addEventListener('click', async (event) => {
    const button = event.target.closest('[data-remove-goal]');
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    const goal = button.dataset.removeGoal;
    if ($$('#goalChips input').find((input) => input.value === goal)?.checked) return;
    if (
      !(await dialog.ask(
        `Удалить цель «${goal}» из списка? Она также будет убрана у учеников, которым назначена.`,
        'Удаление цели',
        'Удалить',
      ))
    )
      return;
    service.removeGoal(goal, BUILTIN_GOALS);
    setGoalChecks(collectGoals());
    toast('Цель удалена');
  });

  return { openNew, openEdit, syncPackageField };
}
