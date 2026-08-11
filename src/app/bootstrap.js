import {
  MAX_BACKUP_BYTES,
  makeBackup,
  mergeImported,
  replaceImported,
  unwrapBackup,
  validateBackup,
  validateBackupSize,
} from '../domain/backup.js';
import { createBrowserPersistence } from '../state/persistence.js';
import { blankData } from '../state/schema.js';
import { createStore } from '../state/store.js';
import { validateReferential, validateStructural } from '../state/validate.js';
import {
  normalizePastLessons,
  pruneOldHistory,
  syncFutureGroupBilling,
} from '../state/maintenance.js';
import { extendAllSchedules } from '../modules/schedule/schedule.domain.js';
import { createStudentsService } from '../modules/students/students.service.js';
import { createStudentsView } from '../modules/students/students.view.js';
import { createScheduleService } from '../modules/schedule/schedule.service.js';
import { createScheduleView } from '../modules/schedule/schedule.view.js';
import { createPaymentsService } from '../modules/payments/payments.service.js';
import { createPaymentsView } from '../modules/payments/payments.view.js';
import {
  lessonName,
  lessonDuration,
  uniqueSessions,
} from '../modules/schedule/schedule.selectors.js';
import { createReportsView } from '../modules/reports/reports.view.js';
import { createSettingsService } from '../modules/settings/settings.service.js';
import { createSettingsView } from '../modules/settings/settings.view.js';
import { createDashboardView } from '../modules/dashboard/dashboard.view.js';
import { $, $$ } from '../shared/dom.js';
import { createToast } from '../shared/toast.js';
import { createDialog } from '../shared/dialog.js';
import { createModalManager } from '../shared/modal.js';
import { formatTime, localDay } from '../shared/format.js';
import './mount-vue-islands.js';

const STORAGE_KEY = 'tutorCabinet_v1';
const RETENTION_DAYS = 45;
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const toast = createToast();
const dialog = createDialog();
const modal = createModalManager(document, { ask: dialog.ask });
const persistence = createBrowserPersistence({
  key: STORAGE_KEY,
  onPersist: (raw) => window.tutorCloud?.queueSave?.(raw),
});
const loaded = persistence.load();
const store = createStore(loaded.ok ? loaded.envelope.data : blankData(), {
  validate(candidate) {
    const structural = validateStructural(candidate);
    return structural.ok ? validateReferential(candidate) : structural;
  },
});
let persistenceEnabled = loaded.ok;
if (!loaded.ok)
  console.error(
    `Local state rejected at ${loaded.stage}; the last copy was not overwritten.`,
    loaded.errors,
  );

const studentsService = createStudentsService({ store, uid });
const scheduleService = createScheduleService({ store, uid });
const paymentsService = createPaymentsService({ store, uid });
let scheduleView;
const scheduleBridge = {
  openNewLesson: (...args) => scheduleView?.openNewLesson(...args),
  openLesson: (...args) => scheduleView?.openLesson(...args),
  deleteLesson: (...args) => scheduleView?.deleteLesson(...args),
};
const studentsView = createStudentsView({
  store,
  service: studentsService,
  modal,
  dialog,
  toast,
  schedule: scheduleBridge,
});
scheduleView = createScheduleView({ store, service: scheduleService, modal, dialog, toast });
const paymentsView = createPaymentsView({ store, service: paymentsService, modal, dialog, toast });
const settingsService = createSettingsService({ store });
const settingsView = createSettingsView({ store, service: settingsService, toast });
const dashboardView = createDashboardView({
  store,
  openLesson: (id) => scheduleView.openLesson(id),
  retentionDays: RETENTION_DAYS,
});
const reportsView = createReportsView({ store, toast, dialog });

store.subscribe((nextState, actionName) => {
  if (!persistenceEnabled) return;
  const result = persistence.save(nextState);
  if (!result.ok) console.error(`Persistence rejected action "${actionName}".`, result.errors);
});
store.subscribe(() => renderAll());

function setPage(name) {
  $$('.page').forEach((page) => page.classList.toggle('active', page.id === `page-${name}`));
  $$('#nav [data-page]').forEach((button) =>
    button.classList.toggle('active', button.dataset.page === name),
  );
  sessionStorage.setItem('tutorCabinet_activePage', name);
  window.dispatchEvent(new CustomEvent('app:page-change', { detail: { page: name } }));
  renderAll();
}

$('#nav')?.addEventListener('click', (event) => {
  const name = event.target.closest('[data-page]')?.dataset.page;
  if (name) {
    setPage(name);
  }
});
document.addEventListener('click', (event) => {
  const name = event.target.closest('[data-page-go]')?.dataset.pageGo;
  if (name) setPage(name);
});

function downloadJson(filename, object) {
  const blob = new Blob([JSON.stringify(object, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function exportBackup() {
  downloadJson(
    `teachers-platforma-${localDay()}.json`,
    makeBackup(store.getState(), { appVersion: 'refactor-v5-part2' }),
  );
  toast('Резервная копия скачана');
}
$('#backupBtn')?.addEventListener('click', exportBackup);
$('#exportBtn')?.addEventListener('click', exportBackup);
let pendingImport = null;
$('#importFile')?.addEventListener('change', async (event) => {
  const file = event.target.files?.[0];
  event.target.value = '';
  if (!file) return;
  if (!validateBackupSize(file.size)) {
    dialog.inform(
      `Файл слишком большой. Максимум ${Math.round(MAX_BACKUP_BYTES / 1024 / 1024)} МБ.`,
      'Не удалось загрузить копию',
      true,
    );
    return;
  }
  try {
    const parsed = JSON.parse(await file.text());
    const valid = validateBackup(parsed);
    if (!valid.ok) {
      dialog.inform(
        `Копия повреждена или имеет неподдерживаемый формат.\n${valid.errors.slice(0, 4).join('\n')}`,
        'Не удалось загрузить копию',
        true,
      );
      return;
    }
    pendingImport = unwrapBackup(parsed);
    modal.open('importModal');
  } catch (error) {
    dialog.inform(`Не удалось прочитать файл: ${error.message}`, 'Ошибка импорта', true);
  }
});
$$('[data-import-mode]').forEach((button) =>
  button.addEventListener('click', () => {
    if (!pendingImport) return;
    try {
      if (button.dataset.importMode === 'replace') {
        const result = replaceImported(store.getState(), pendingImport);
        persistence.saveRecovery(result.recovery);
        store.replace(result.nextData, 'backup:replace');
      } else store.replace(mergeImported(store.getState(), pendingImport, uid), 'backup:merge');
      persistenceEnabled = true;
      pendingImport = null;
      modal.closeAll();
      toast('Резервная копия загружена');
    } catch (error) {
      console.error(error);
      dialog.inform('Не удалось применить резервную копию.', 'Ошибка импорта', true);
    }
  }),
);
$('#clearBtn')?.addEventListener('click', async () => {
  if (
    !(await dialog.ask(
      'Удалить всех учеников, занятия, платежи и настройки? Перед удалением будет создана recovery-копия.',
      'Удалить все данные?',
      'Удалить всё',
    ))
  )
    return;
  persistence.saveRecovery(store.getState(), 'before-clear');
  store.replace(blankData(), 'data:clear');
  toast('Данные удалены');
});

function renderAll() {
  settingsView.render();
  dashboardView.render();
  studentsView.render();
  scheduleView.render();
  paymentsView.render();
  reportsView.render();
}

document.addEventListener('click', async (event) => {
  const open = event.target.closest('[data-open]')?.dataset.open;
  if (open === 'student') studentsView.openNewStudent();
  if (open === 'group') studentsView.openNewGroup();
  if (open === 'lesson') scheduleView.openNewLesson();
  if (open === 'event') scheduleView.openEvent();
  if (open === 'payment') paymentsView.openPayment();
  if (event.target.closest('[data-close]')) await modal.requestClose();
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && $('.modal-wrap.open')) modal.requestClose();
});

$('#onboardingForm')?.addEventListener('submit', (event) => {
  event.preventDefault();
  const name = new FormData(event.currentTarget).get('tutor')?.trim();
  if (!name) return;
  settingsService.completeOnboarding(name);
  modal.closeAll();
  toast('Профиль настроен');
});
$('#startTutorial')?.addEventListener('click', () => {
  let step = 0;
  const steps = [
    ['Главная', 'Здесь видно занятия на сегодня и незаполненные уроки.'],
    ['Ученики', 'Карточки учеников, группы, цели и история занятий.'],
    ['Расписание', 'Календарь, разовые и регулярные занятия.'],
    ['Оплаты', 'Долги, абонементы и история платежей.'],
    ['Отчёты', 'Соберите и скачайте отчёт для родителя.'],
  ];
  const render = () => {
    $('#tutorialCount').textContent = `${step + 1} из ${steps.length}`;
    $('#tutorialTitle').textContent = steps[step][0];
    $('#tutorialText').textContent = steps[step][1];
    $('#tutorialProgress').style.width = `${((step + 1) / steps.length) * 100}%`;
    $('#tutorialBack').disabled = step === 0;
    $('#tutorialNext').textContent = step === steps.length - 1 ? 'Готово' : 'Далее';
  };
  $('#tutorialBack').onclick = () => {
    if (step > 0) {
      step--;
      render();
    }
  };
  $('#tutorialNext').onclick = () => {
    if (step === steps.length - 1) modal.closeAll();
    else {
      step++;
      render();
    }
  };
  render();
  modal.open('tutorialModal');
});

function runMaintenance() {
  try {
    let next = extendAllSchedules(store.getState(), { uid });
    next = normalizePastLessons(next, Date.now(), (lesson) => lessonDuration(next, lesson)).data;
    next = syncFutureGroupBilling(next).data;
    next = pruneOldHistory(next, RETENTION_DAYS).data;
    if (JSON.stringify(next) !== JSON.stringify(store.getState()))
      store.replace(next, 'maintenance:bootstrap');
  } catch (error) {
    console.error('Bootstrap maintenance failed:', error);
  }
}

const notified = new Set();
setInterval(() => {
  const minutes = +store.getState().settings.reminder || 0;
  if (!minutes || Notification.permission !== 'granted') return;
  const now = Date.now();
  uniqueSessions(store.getState().lessons)
    .filter((lesson) => lesson.status === 'planned')
    .forEach((lesson) => {
      const diff = new Date(lesson.date).getTime() - now,
        key = lesson.seriesId || lesson.id;
      if (diff > 0 && diff <= minutes * 60000 && !notified.has(key)) {
        notified.add(key);
        new Notification(`Скоро занятие: ${lessonName(store.getState(), lesson)}`, {
          body: `Начало в ${formatTime(lesson.date)}`,
        });
      }
    });
}, 30000);

runMaintenance();
const savedPage = sessionStorage.getItem('tutorCabinet_activePage');
const availablePages = new Set($$('#nav [data-page]').map((item) => item.dataset.page));
if (savedPage && availablePages.has(savedPage)) setPage(savedPage);
else renderAll();
if (!store.getState().settings.tutor) modal.open('onboardingModal');
