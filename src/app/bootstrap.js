import '../../styles/design-system.css';

import {
  MAX_BACKUP_BYTES,
  makeBackup,
  mergeImported,
  replaceImported,
  unwrapBackup,
  validateBackup,
  validateBackupSize,
} from '../domain/backup.js';
import { blankData } from '../state/schema.js';
import { persistence, persistenceState, store, uid } from '../state/app-store.js';
import {
  normalizePastLessons,
  pruneOldEvents,
  syncFutureGroupBilling,
} from '../state/maintenance.js';
import { extendAllSchedules } from '../modules/schedule/schedule.domain.js';
import {
  lessonName,
  lessonDuration,
  uniqueSessions,
} from '../modules/schedule/schedule.selectors.js';
import { settingsService } from '../modules/settings/settings.service.js';
import { $, $$ } from '../shared/dom.js';
import { dialog, modal, toast } from '../shared/app-ui.js';
import { formatTime, localDay } from '../shared/format.js';
import './mount-vue-islands.js';
import {
  ACTIVE_PAGE_STORAGE_KEY,
  DEFAULT_PAGE,
  pageFromPath,
  pagePath,
  resolveInitialPage,
  SPA_REDIRECT_STORAGE_KEY,
} from './navigation-state.js';

// The sidebar shell (theme/collapse buttons) lives outside every Vue page
// root, so it stays wired here rather than owned by SettingsPage.
function applySidebarChrome() {
  const isCompact = !!store.getState().settings.sidebarCompact;
  const isDark = store.getState().settings.theme === 'dark';
  const sidebarToggle = $('#sidebarToggle');
  if (!sidebarToggle) return;
  sidebarToggle.setAttribute('aria-expanded', String(!isCompact));
  sidebarToggle.setAttribute('aria-label', isCompact ? 'Открыть меню' : 'Закрыть меню');
  sidebarToggle.title = isCompact ? 'Открыть меню' : 'Закрыть меню';
  $$('[data-theme-icon]').forEach((icon) => {
    icon.textContent = isDark ? '☀' : '☾';
  });
  $$('[data-theme-toggle]').forEach((button) => {
    const label = isDark ? 'Включить светлую тему' : 'Включить тёмную тему';
    button.setAttribute('aria-label', label);
    button.title = label;
  });
}
$$('[data-theme-toggle]').forEach((button) =>
  button.addEventListener('click', settingsService.toggleTheme),
);
$('#sidebarToggle')?.addEventListener('click', settingsService.toggleSidebar);
store.subscribe(applySidebarChrome);
applySidebarChrome();

const availablePages = new Set($$('#nav [data-page]').map((item) => item.dataset.page));

function setPage(name, { historyMode = 'push' } = {}) {
  if (!availablePages.has(name)) return;
  $$('.page').forEach((page) => page.classList.toggle('active', page.id === `page-${name}`));
  $$('#nav [data-page]').forEach((button) => {
    const isActive = button.dataset.page === name;
    button.classList.toggle('active', isActive);
    if (isActive) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  });
  sessionStorage.setItem(ACTIVE_PAGE_STORAGE_KEY, name);
  const nextPath = pagePath(name);
  if (historyMode !== 'none' && window.location.pathname !== nextPath) {
    window.history[historyMode === 'replace' ? 'replaceState' : 'pushState'](null, '', nextPath);
  }
  window.dispatchEvent(new CustomEvent('app:page-change', { detail: { page: name } }));
}

$('#nav')?.addEventListener('click', (event) => {
  const name = event.target.closest('[data-page]')?.dataset.page;
  if (name) {
    setPage(name);
  }
});
window.addEventListener('app:navigate-request', (event) => {
  if (event.detail?.page) setPage(event.detail.page);
});
window.addEventListener('popstate', () => {
  const page = pageFromPath(window.location.pathname);
  setPage(page || DEFAULT_PAGE, { historyMode: page ? 'none' : 'replace' });
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
      persistenceState.enabled = true;
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

document.addEventListener('click', async (event) => {
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
    next = pruneOldEvents(next).data;
    if (JSON.stringify(next) !== JSON.stringify(store.getState()))
      store.replace(next, 'maintenance:bootstrap');
  } catch (error) {
    console.error('Bootstrap maintenance failed:', error);
  }
}

const notified = new Set();
setInterval(() => {
  const minutes = +store.getState().settings.reminder || 0;
  // Notification нет в незащищённом контексте и на части мобильных браузеров —
  // без проверки интервал падал бы с ReferenceError каждые 30 секунд.
  if (!minutes || typeof Notification === 'undefined' || Notification.permission !== 'granted')
    return;
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
const redirectedPath = sessionStorage.getItem(SPA_REDIRECT_STORAGE_KEY);
if (redirectedPath) {
  sessionStorage.removeItem(SPA_REDIRECT_STORAGE_KEY);
  const redirectedUrl = new URL(redirectedPath, window.location.origin);
  if (pageFromPath(redirectedUrl.pathname)) {
    window.history.replaceState(null, '', redirectedUrl);
  }
}
const initialPage = resolveInitialPage(window.location.pathname, window.location.hash);
setPage(availablePages.has(initialPage) ? initialPage : DEFAULT_PAGE, { historyMode: 'replace' });
if (!store.getState().settings.tutor) modal.open('onboardingModal');
