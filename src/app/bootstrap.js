import { MAX_BACKUP_BYTES, makeBackup, mergeImported, replaceImported, unwrapBackup, validateBackup, validateBackupSize } from '../domain/backup.js';
import { createBrowserPersistence } from '../state/persistence.js';
import { blankData } from '../state/schema.js';
import { createStore } from '../state/store.js';
import { validateReferential, validateStructural } from '../state/validate.js';
import { normalizePastLessons, pruneOldHistory, syncFutureGroupBilling } from '../state/maintenance.js';
import { extendAllSchedules } from '../modules/schedule/schedule.domain.js';
import { createStudentsService } from '../modules/students/students.service.js';
import { createStudentsView } from '../modules/students/students.view.js';
import { createScheduleService } from '../modules/schedule/schedule.service.js';
import { createScheduleView } from '../modules/schedule/schedule.view.js';
import { createPaymentsService } from '../modules/payments/payments.service.js';
import { createPaymentsView } from '../modules/payments/payments.view.js';
import { getPackageProgress } from '../modules/payments/payments.selectors.js';
import { lessonName, lessonDuration, uniqueSessions } from '../modules/schedule/schedule.selectors.js';
import { $, $$, escapeHtml } from '../shared/dom.js';
import { createToast } from '../shared/toast.js';
import { createDialog } from '../shared/dialog.js';
import { createModalManager } from '../shared/modal.js';
import { formatDate, formatTime, localDay, money } from '../shared/format.js';

const STORAGE_KEY = 'tutorCabinet_v1';
const RETENTION_DAYS = 45;
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const toast = createToast();
const dialog = createDialog();
const modal = createModalManager(document, { ask: dialog.ask });
const persistence = createBrowserPersistence({ key: STORAGE_KEY, onPersist: (raw) => window.tutorCloud?.queueSave?.(raw) });
const loaded = persistence.load();
const store = createStore(loaded.ok ? loaded.envelope.data : blankData(), {
  validate(candidate) {
    const structural = validateStructural(candidate);
    return structural.ok ? validateReferential(candidate) : structural;
  },
});
let persistenceEnabled = loaded.ok;
if (!loaded.ok) console.error(`Local state rejected at ${loaded.stage}; the last copy was not overwritten.`, loaded.errors);

const studentsService = createStudentsService({ store, uid });
const scheduleService = createScheduleService({ store, uid });
const paymentsService = createPaymentsService({ store, uid });
let scheduleView;
const scheduleBridge = {
  openNewLesson: (...args) => scheduleView?.openNewLesson(...args),
  openLesson: (...args) => scheduleView?.openLesson(...args),
  deleteLesson: (...args) => scheduleView?.deleteLesson(...args),
};
const studentsView = createStudentsView({ store, service: studentsService, modal, dialog, toast, schedule: scheduleBridge });
scheduleView = createScheduleView({ store, service: scheduleService, modal, dialog, toast });
const paymentsView = createPaymentsView({ store, service: paymentsService, modal, dialog, toast });

store.subscribe((nextState, actionName) => {
  if (!persistenceEnabled) return;
  const result = persistence.save(nextState);
  if (!result.ok) console.error(`Persistence rejected action "${actionName}".`, result.errors);
});
store.subscribe(() => renderAll());

function setPage(name) {
  $$('.page').forEach((page) => page.classList.toggle('active', page.id === `page-${name}`));
  $$('#nav [data-page]').forEach((button) => button.classList.toggle('active', button.dataset.page === name));
  if (name === 'reports') refreshReportOptions();
  renderAll();
}

$('#nav')?.addEventListener('click', (event) => {
  const name = event.target.closest('[data-page]')?.dataset.page;
  if (name) setPage(name);
});
document.addEventListener('click', (event) => {
  const name = event.target.closest('[data-page-go]')?.dataset.pageGo;
  if (name) setPage(name);
});

function renderDashboard() {
  const state = store.getState();
  const now = new Date();
  const today = localDay(now);
  const sessions = uniqueSessions(state.lessons);
  const upcoming = sessions.filter((lesson) => String(lesson.date).slice(0, 10) === today && ['planned', 'unconfirmed'].includes(lesson.status) && new Date(lesson.date) >= now).sort((a, b) => new Date(a.date) - new Date(b.date));
  const completed = sessions.filter((lesson) => String(lesson.date).slice(0, 10) === today && ['done', 'missed', 'paid_missed', 'moved', 'cancelled', 'unconfirmed'].includes(lesson.status) && new Date(lesson.date) < now).sort((a, b) => new Date(b.date) - new Date(a.date));
  const cutoff = Date.now() - RETENTION_DAYS * 86400000;
  const unfilled = sessions.filter((lesson) => new Date(lesson.date).getTime() >= cutoff && new Date(lesson.date) < now && (lesson.status === 'unconfirmed' || (lesson.status === 'done' && lesson.reportFilled === false))).sort((a, b) => new Date(b.date) - new Date(a.date));
  $('#hello').textContent = `${new Date().getHours() < 12 ? 'Доброе утро' : new Date().getHours() < 18 ? 'Добрый день' : 'Добрый вечер'}${state.settings.tutor ? `, ${state.settings.tutor}` : ''}!`;
  $('#todayText').textContent = now.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });
  const rows = (list, empty) => list.length ? list.map((lesson) => `<button type="button" class="list-row lesson-row" data-open-lesson="${lesson.seriesId || lesson.id}"><span><b>${escapeHtml(lessonName(state, lesson))}</b><small>${formatTime(lesson.date)} · ${escapeHtml(({planned:'Запланировано',unconfirmed:'Заполнить занятие',done:'Проведено',missed:'Пропуск',paid_missed:'Пропуск с оплатой',moved:'Перенесено',cancelled:'Отменено'})[lesson.status] || lesson.status)}</small></span><span>→</span></button>`).join('') : `<div class="empty">${empty}</div>`;
  $('#upcoming').innerHTML = rows(upcoming, 'На сегодня больше нет предстоящих занятий.');
  $('#todayCompleted').innerHTML = rows(completed, 'Сегодня ещё нет прошедших занятий.');
  $('#unfilledLessons').innerHTML = rows(unfilled, 'Все прошедшие занятия заполнены.');
  $('#dashboardUnfilledAlert').innerHTML = unfilled.length ? `<button type="button" class="notice" data-scroll-unfilled>Незаполненных занятий: <b>${unfilled.length}</b></button>` : '';
}

['#upcoming', '#todayCompleted', '#unfilledLessons'].forEach((selector) => $(selector)?.addEventListener('click', (event) => {
  const id = event.target.closest('[data-open-lesson]')?.dataset.openLesson;
  if (id) scheduleView.openLesson(id);
}));
$('#dashboardUnfilledAlert')?.addEventListener('click', () => $('#unfilledSection')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));

function applySettings() {
  const settings = store.getState().settings;
  document.documentElement.dataset.theme = settings.theme || 'light';
  document.body.classList.toggle('dark', settings.theme === 'dark');
  $('.app')?.classList.toggle('sidebar-compact', !!settings.sidebarCompact);
  if ($('#settingTutor')) $('#settingTutor').value = settings.tutor || '';
  if ($('#settingReminder')) $('#settingReminder').value = String(settings.reminder ?? 15);
  if ($('#themeBtn')) $('#themeBtn').firstChild.textContent = settings.theme === 'dark' ? '☀ ' : '☾ ';
  const profile = window.tutorCloud?.profile;
  if ($('#accountEmail') && window.tutorCloud?.user) $('#accountEmail').textContent = profile?.email || window.tutorCloud.user.email || '—';
  if ($('#accountAccess') && profile) $('#accountAccess').textContent = profile.access_until ? `до ${new Date(profile.access_until).toLocaleDateString('ru-RU')}` : 'Без ограничения';
}

function toggleTheme() {
  store.update('settings:theme', (draft) => { draft.settings.theme = draft.settings.theme === 'dark' ? 'light' : 'dark'; });
}
$('#themeBtn')?.addEventListener('click', toggleTheme);
$('#profileThemeBtn')?.addEventListener('click', toggleTheme);
$('#sidebarToggle')?.addEventListener('click', () => store.update('settings:sidebar', (draft) => { draft.settings.sidebarCompact = !draft.settings.sidebarCompact; }));
$('#saveSettings')?.addEventListener('click', () => {
  store.update('settings:update', (draft) => {
    draft.settings.tutor = $('#settingTutor').value.trim();
    draft.settings.reminder = +$('#settingReminder').value || 0;
  });
  toast('Настройки сохранены');
});

function downloadJson(filename, object) {
  const blob = new Blob([JSON.stringify(object, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = filename; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function exportBackup() {
  downloadJson(`teachers-platforma-${localDay()}.json`, makeBackup(store.getState(), { appVersion: 'refactor-v5-part1' }));
  toast('Резервная копия скачана');
}
$('#backupBtn')?.addEventListener('click', exportBackup);
$('#exportBtn')?.addEventListener('click', exportBackup);
let pendingImport = null;
$('#importFile')?.addEventListener('change', async (event) => {
  const file = event.target.files?.[0]; event.target.value = '';
  if (!file) return;
  if (!validateBackupSize(file.size)) { dialog.inform(`Файл слишком большой. Максимум ${Math.round(MAX_BACKUP_BYTES / 1024 / 1024)} МБ.`, 'Не удалось загрузить копию', true); return; }
  try {
    const parsed = JSON.parse(await file.text());
    const valid = validateBackup(parsed);
    if (!valid.ok) { dialog.inform(`Копия повреждена или имеет неподдерживаемый формат.\n${valid.errors.slice(0, 4).join('\n')}`, 'Не удалось загрузить копию', true); return; }
    pendingImport = unwrapBackup(parsed); modal.open('importModal');
  } catch (error) { dialog.inform(`Не удалось прочитать файл: ${error.message}`, 'Ошибка импорта', true); }
});
$$('[data-import-mode]').forEach((button) => button.addEventListener('click', () => {
  if (!pendingImport) return;
  try {
    if (button.dataset.importMode === 'replace') {
      const result = replaceImported(store.getState(), pendingImport);
      persistence.saveRecovery(result.recovery);
      store.replace(result.nextData, 'backup:replace');
    } else store.replace(mergeImported(store.getState(), pendingImport, uid), 'backup:merge');
    persistenceEnabled = true; pendingImport = null; modal.closeAll(); toast('Резервная копия загружена');
  } catch (error) { console.error(error); dialog.inform('Не удалось применить резервную копию.', 'Ошибка импорта', true); }
}));
$('#clearBtn')?.addEventListener('click', async () => {
  if (!(await dialog.ask('Удалить всех учеников, занятия, платежи и настройки? Перед удалением будет создана recovery-копия.', 'Удалить все данные?', 'Удалить всё'))) return;
  persistence.saveRecovery(store.getState(), 'before-clear');
  store.replace(blankData(), 'data:clear'); toast('Данные удалены');
});

function rowEditor(name = '', extra = '') {
  return `<div class="builder-item"><input class="r-name" value="${escapeHtml(name)}" placeholder="Введите текст">${extra}<button class="icon-btn r-remove" type="button" aria-label="Удалить строку">×</button></div>`;
}
function reportBounds() {
  const value = $('#reportPeriod').value;
  if (value === 'custom') {
    const from = new Date(`${$('#reportDateFrom').value || localDay()}T00:00`).getTime();
    const to = new Date(`${$('#reportDateTo').value || localDay()}T23:59:59`).getTime();
    return { from, to };
  }
  const days = +value || 30, to = Date.now(), from = to - (days - 1) * 86400000;
  return { from, to };
}
function reportLessons() {
  const id = $('#reportStudent').value, { from, to } = reportBounds();
  return store.getState().lessons.filter((lesson) => lesson.studentId === id && new Date(lesson.date).getTime() >= from && new Date(lesson.date).getTime() <= to && ['done','missed','paid_missed'].includes(lesson.status)).sort((a,b)=>new Date(a.date)-new Date(b.date));
}
function fillReportBuilder() {
  const id = $('#reportStudent').value;
  if (!id) { ['#reportTopics','#reportTests','#reportHws'].forEach((selector)=>$(selector).innerHTML=''); renderReportPaper(); return; }
  const lessons = reportLessons();
  const topics = lessons.flatMap((lesson) => String(lesson.topics || '').split(',').map((topic)=>topic.trim()).filter(Boolean));
  const tests = lessons.filter((lesson)=>lesson.testDone==='yes').map((lesson)=>`${lesson.testName || 'Проверочная работа'}${lesson.testScore || lesson.testMax ? ` — ${lesson.testScore || '—'}/${lesson.testMax || '—'}` : ''}`);
  const hws = lessons.filter((lesson)=>lesson.homework).map((lesson)=>`${formatDate(lesson.date)} — ${lesson.homework}`);
  $('#reportTopics').innerHTML = [...new Set(topics)].map((topic)=>rowEditor(topic)).join('');
  $('#reportTests').innerHTML = tests.map((test)=>rowEditor(test)).join('');
  $('#reportHws').innerHTML = hws.map((hw)=>rowEditor(hw)).join('');
  const student = store.getState().students.find((item)=>item.id===id);
  const nextBuilder = $('#reportNextPackageBuilder');
  if (nextBuilder) nextBuilder.style.display = student?.payType === 'package' ? '' : 'none';
  if (student?.payType === 'package') {
    const nextMonth = new Date(); nextMonth.setMonth(nextMonth.getMonth()+1,1);
    const progress = getPackageProgress(store.getState(), id, nextMonth);
    const auto = `В следующем месяце по регулярному расписанию запланировано ${progress?.planned || 0} занятий на сумму ${money(progress?.amount || 0)}.`;
    const editor = $('#reportNextPackagePreview');
    if (editor && (!editor.value || editor.dataset.studentId !== id)) { editor.value = auto; editor.dataset.studentId = id; editor.dataset.autoValue = auto; }
  }
  renderReportPaper();
}
function builderValues(selector) { return $$(selector + ' .r-name').map((input)=>input.value.trim()).filter(Boolean); }
function renderReportPaper() {
  const state = store.getState(), id = $('#reportStudent')?.value, student = state.students.find((item)=>item.id===id);
  if (!student) {
    $('#paperPills').innerHTML='<span class="paper-pill">Выберите ученика</span>'; $('#paperComment').textContent='—'; ['#paperTopics','#paperHws','#paperTests'].forEach((selector)=>{ $(selector).className='report-empty'; $(selector).textContent='—'; }); $('#paperPct').textContent='0%'; return;
  }
  const lessons=reportLessons(),done=lessons.filter((lesson)=>lesson.status==='done').length,total=lessons.length,pct=total?Math.round(done/total*100):100;
  $('#paperPills').innerHTML=`<span class="paper-pill">${escapeHtml(student.name)}</span><span class="paper-pill">${escapeHtml($('#reportPeriod').selectedOptions[0]?.textContent || '')}</span>`;
  $('#paperComment').textContent=$('#reportComment').value.trim()||'—';
  const renderList=(selector,values)=>{const target=$(selector);target.className=values.length?'':'report-empty';target.innerHTML=values.length?`<ul>${values.map((value)=>`<li>${escapeHtml(value)}</li>`).join('')}</ul>`:'—';};
  renderList('#paperTopics',builderValues('#reportTopics'));renderList('#paperTests',builderValues('#reportTests'));renderList('#paperHws',builderValues('#reportHws'));
  $('#paperPct').textContent=`${pct}%`; const ring=$('#paperRingValue'); if(ring){const circumference=326.726;ring.style.strokeDasharray=String(circumference);ring.style.strokeDashoffset=String(circumference*(1-pct/100));}
  const next=$('#reportNextPackagePreview')?.value.trim()||''; $('#paperNextPackage').textContent=next||'—'; $('#paperNextPackageSection').style.display=student.payType==='package'?'':'none';
  $$('[data-report-block]').forEach((checkbox)=>{const section=$(`[data-report-section="${checkbox.dataset.reportBlock}"]`);if(section)section.style.display=checkbox.checked?'':'none';});
}
function refreshReportOptions() {
  const select=$('#reportStudent'); if(!select)return; const current=select.value; select.innerHTML=`<option value="">Выберите ученика</option>${store.getState().students.map((student)=>`<option value="${student.id}">${escapeHtml(student.name)}</option>`).join('')}`; if(store.getState().students.some((student)=>student.id===current))select.value=current;
  if(!select.dataset.bound){select.dataset.bound='1';select.addEventListener('change',fillReportBuilder);$('#reportPeriod').addEventListener('change',()=>{$('#customPeriodFields').style.display=$('#reportPeriod').value==='custom'?'block':'none';fillReportBuilder();});['#reportDateFrom','#reportDateTo'].forEach((selector)=>$(selector).addEventListener('change',fillReportBuilder));$('#reportComment').addEventListener('input',renderReportPaper);$('#reportNextPackagePreview')?.addEventListener('input',renderReportPaper);$('#page-reports').addEventListener('input',(event)=>{if(event.target.matches('.r-name,[data-report-block]'))renderReportPaper();});$('#page-reports').addEventListener('click',(event)=>{if(event.target.closest('.r-remove')){event.target.closest('.builder-item').remove();renderReportPaper();}});}
}
[['#addReportTopic','#reportTopics'],['#addReportTest','#reportTests'],['#addReportHw','#reportHws']].forEach(([button,list])=>$(button)?.addEventListener('click',()=>{$(list).insertAdjacentHTML('beforeend',rowEditor(''));$(list).lastElementChild?.querySelector('.r-name')?.focus();renderReportPaper();}));
$('#copyReportText')?.addEventListener('click',async()=>{const student=store.getState().students.find((item)=>item.id===$('#reportStudent').value);if(!student){toast('Сначала выберите ученика');return;}const sections=[];if($('[data-report-block="general"]')?.checked)sections.push(`Комментарий: ${$('#reportComment').value.trim()||'—'}`);if($('[data-report-block="topics"]')?.checked)sections.push(`Темы: ${builderValues('#reportTopics').join('; ')||'—'}`);if($('[data-report-block="hws"]')?.checked)sections.push(`Домашние задания: ${builderValues('#reportHws').join('; ')||'—'}`);if($('[data-report-block="tests"]')?.checked)sections.push(`Проверочные: ${builderValues('#reportTests').join('; ')||'—'}`);if($('[data-report-block="nextPackage"]')?.checked&&$('#reportNextPackagePreview')?.value.trim())sections.push(`Следующий месяц: ${$('#reportNextPackagePreview').value.trim()}`);await navigator.clipboard.writeText(`Отчёт по ученику ${student.name}\n\n${sections.join('\n\n')}`);toast('Текст отчёта скопирован');});
$('#saveReportPng')?.addEventListener('click',async()=>{if(!$('#reportStudent').value){toast('Сначала выберите ученика');return;}try{const canvas=await window.html2canvas($('#reportCard'),{scale:2,backgroundColor:null});const link=document.createElement('a');link.download=`report-${localDay()}.png`;link.href=canvas.toDataURL('image/png');link.click();toast('PNG сохранён');}catch(error){console.error(error);dialog.inform('Не удалось сохранить PNG.','Ошибка экспорта',true);}});

function renderAll() {
  applySettings();
  renderDashboard();
  studentsView.render();
  scheduleView.render();
  paymentsView.render();
  refreshReportOptions();
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
document.addEventListener('keydown',(event)=>{if(event.key==='Escape'&&$('.modal-wrap.open'))modal.requestClose();});

$('#onboardingForm')?.addEventListener('submit',(event)=>{event.preventDefault();const name=new FormData(event.currentTarget).get('tutor')?.trim();if(!name)return;store.update('onboarding:complete',(draft)=>{draft.settings.tutor=name;});modal.closeAll();toast('Профиль настроен');});
$('#startTutorial')?.addEventListener('click',()=>{let step=0;const steps=[['Главная','Здесь видно занятия на сегодня и незаполненные уроки.'],['Ученики','Карточки учеников, группы, цели и история занятий.'],['Расписание','Календарь, разовые и регулярные занятия.'],['Оплаты','Долги, абонементы и история платежей.'],['Отчёты','Соберите и скачайте отчёт для родителя.']];const render=()=>{$('#tutorialCount').textContent=`${step+1} из ${steps.length}`;$('#tutorialTitle').textContent=steps[step][0];$('#tutorialText').textContent=steps[step][1];$('#tutorialProgress').style.width=`${((step+1)/steps.length)*100}%`;$('#tutorialBack').disabled=step===0;$('#tutorialNext').textContent=step===steps.length-1?'Готово':'Далее';};$('#tutorialBack').onclick=()=>{if(step>0){step--;render();}};$('#tutorialNext').onclick=()=>{if(step===steps.length-1)modal.closeAll();else{step++;render();}};render();modal.open('tutorialModal');});

function runMaintenance() {
  try {
    let next = extendAllSchedules(store.getState(), { uid });
    next = normalizePastLessons(next, Date.now(), (lesson) => lessonDuration(next, lesson)).data;
    next = syncFutureGroupBilling(next).data;
    next = pruneOldHistory(next, RETENTION_DAYS).data;
    if (JSON.stringify(next) !== JSON.stringify(store.getState())) store.replace(next, 'maintenance:bootstrap');
  } catch (error) { console.error('Bootstrap maintenance failed:', error); }
}

const notified = new Set();
setInterval(()=>{const minutes=+store.getState().settings.reminder||0;if(!minutes||Notification.permission!=='granted')return;const now=Date.now();uniqueSessions(store.getState().lessons).filter((lesson)=>lesson.status==='planned').forEach((lesson)=>{const diff=new Date(lesson.date).getTime()-now,key=lesson.seriesId||lesson.id;if(diff>0&&diff<=minutes*60000&&!notified.has(key)){notified.add(key);new Notification(`Скоро занятие: ${lessonName(store.getState(),lesson)}`,{body:`Начало в ${formatTime(lesson.date)}`});}});},30000);

runMaintenance();
renderAll();
if (!store.getState().settings.tutor) modal.open('onboardingModal');
