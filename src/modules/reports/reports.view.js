import { $, $$, escapeHtml } from '../../shared/dom.js';
import { localDay } from '../../shared/format.js';
import { buildReportSource, getNextPackageSummary, getReportBounds } from './reports.model.js';
import { createReportInteractions } from './report-drag.js';

function rowEditor(name = '') {
  return `<div class="builder-item"><button type="button" class="report-drag-handle" draggable="true" aria-label="Перетащить строку" title="Перетащить"></button><input class="r-name" value="${escapeHtml(name)}" placeholder="Введите текст"><button class="icon-btn r-remove" type="button" aria-label="Удалить строку">×</button></div>`;
}

export function createReportsView({ store, toast, dialog }) {
  const page = $('#page-reports');
  let bound = false;
  let interactions;

  function builderValues(selector) {
    return $$(`${selector} .r-name`).map((input) => input.value.trim()).filter(Boolean);
  }

  function boundsFromForm() {
    return getReportBounds({
      period: $('#reportPeriod')?.value || '30',
      dateFrom: $('#reportDateFrom')?.value || '',
      dateTo: $('#reportDateTo')?.value || '',
    });
  }

  function sourceFromForm() {
    return buildReportSource(store.getState(), $('#reportStudent')?.value || '', boundsFromForm());
  }

  function resetEmptyStudent() {
    ['#reportTopics', '#reportTests', '#reportHws'].forEach((selector) => { const list = $(selector); if (list) list.innerHTML = ''; });
    const comment = $('#reportComment');
    if (comment) comment.value = '';
    const pills = $('#paperPills');
    if (pills) pills.innerHTML = '<span class="paper-pill">Выберите ученика</span>';
    const paperComment = $('#paperComment');
    if (paperComment) paperComment.textContent = '—';
    ['#paperTopics', '#paperHws', '#paperTests'].forEach((selector) => {
      const target = $(selector);
      if (target) { target.className = 'report-empty'; target.textContent = '—'; }
    });
    if ($('#paperPct')) $('#paperPct').textContent = '0%';
    const ring = $('#paperRingValue');
    if (ring) { ring.style.stroke = ''; ring.style.strokeDasharray = '326.726'; ring.style.strokeDashoffset = '326.726'; }
    if ($('#reportNextPackageBuilder')) $('#reportNextPackageBuilder').style.display = 'none';
    if ($('#paperNextPackageSection')) $('#paperNextPackageSection').style.display = 'none';
    const editor = $('#reportNextPackagePreview');
    if (editor) { editor.value = ''; delete editor.dataset.autoValue; delete editor.dataset.studentId; }
    interactions?.syncAll();
  }

  function renderList(selector, values) {
    const target = $(selector);
    if (!target) return;
    target.className = values.length ? '' : 'report-empty';
    target.innerHTML = values.length ? `<ul>${values.map((value) => `<li>${escapeHtml(value)}</li>`).join('')}</ul>` : '—';
  }

  function renderPaper() {
    const { student, progressPercent } = sourceFromForm();
    if (!student) { resetEmptyStudent(); return; }
    if ($('#paperPills')) $('#paperPills').innerHTML = `<span class="paper-pill">${escapeHtml(student.name)}</span><span class="paper-pill">${escapeHtml($('#reportPeriod')?.selectedOptions?.[0]?.textContent || '')}</span>`;
    if ($('#paperComment')) $('#paperComment').textContent = $('#reportComment')?.value.trim() || '—';
    renderList('#paperTopics', builderValues('#reportTopics'));
    renderList('#paperTests', builderValues('#reportTests'));
    renderList('#paperHws', builderValues('#reportHws'));
    if ($('#paperPct')) $('#paperPct').textContent = `${progressPercent}%`;
    const ring = $('#paperRingValue');
    if (ring) {
      const circumference = 326.726;
      ring.style.strokeDasharray = String(circumference);
      ring.style.strokeDashoffset = String(circumference * (1 - progressPercent / 100));
    }
    const next = $('#reportNextPackagePreview')?.value.trim() || '';
    if ($('#paperNextPackage')) $('#paperNextPackage').textContent = next || '—';
    if ($('#paperNextPackageSection')) $('#paperNextPackageSection').style.display = student.payType === 'package' ? '' : 'none';
    $$('[data-report-block]').forEach((checkbox) => {
      const section = $(`[data-report-section="${checkbox.dataset.reportBlock}"]`);
      if (section) section.style.display = checkbox.checked ? '' : 'none';
    });
  }

  function fillBuilder() {
    const id = $('#reportStudent')?.value || '';
    if (!id) { resetEmptyStudent(); return; }
    const source = sourceFromForm();
    if ($('#reportTopics')) $('#reportTopics').innerHTML = source.topics.map(rowEditor).join('');
    if ($('#reportTests')) $('#reportTests').innerHTML = source.tests.map(rowEditor).join('');
    if ($('#reportHws')) $('#reportHws').innerHTML = source.homeworks.map(rowEditor).join('');
    const nextBuilder = $('#reportNextPackageBuilder');
    if (nextBuilder) nextBuilder.style.display = source.student?.payType === 'package' ? '' : 'none';
    const nextEditor = $('#reportNextPackagePreview');
    if (source.student?.payType === 'package' && nextEditor) {
      const auto = getNextPackageSummary(store.getState(), id);
      if (!nextEditor.value || nextEditor.dataset.studentId !== id) {
        nextEditor.value = auto;
        nextEditor.dataset.studentId = id;
        nextEditor.dataset.autoValue = auto;
      }
    } else if (nextEditor) {
      nextEditor.value = '';
      delete nextEditor.dataset.studentId;
      delete nextEditor.dataset.autoValue;
    }
    interactions?.syncAll();
    renderPaper();
  }

  function refreshStudentOptions() {
    const select = $('#reportStudent');
    if (!select) return;
    const state = store.getState();
    const current = select.value;
    select.innerHTML = `<option value="">Выберите ученика</option>${state.students.map((student) => `<option value="${student.id}">${escapeHtml(student.name)}</option>`).join('')}`;
    if (state.students.some((student) => student.id === current)) select.value = current;
    else if (current) resetEmptyStudent();
  }

  async function copyText() {
    const student = store.getState().students.find((item) => item.id === $('#reportStudent')?.value);
    if (!student) { toast('Сначала выберите ученика'); return; }
    const sections = [];
    if ($('[data-report-block="general"]')?.checked) sections.push(`Комментарий: ${$('#reportComment')?.value.trim() || '—'}`);
    if ($('[data-report-block="topics"]')?.checked) sections.push(`Темы: ${builderValues('#reportTopics').join('; ') || '—'}`);
    if ($('[data-report-block="hws"]')?.checked) sections.push(`Домашние задания: ${builderValues('#reportHws').join('; ') || '—'}`);
    if ($('[data-report-block="tests"]')?.checked) sections.push(`Проверочные: ${builderValues('#reportTests').join('; ') || '—'}`);
    if ($('[data-report-block="nextPackage"]')?.checked && $('#reportNextPackagePreview')?.value.trim()) sections.push(`Следующий месяц: ${$('#reportNextPackagePreview').value.trim()}`);
    try {
      await navigator.clipboard.writeText(`Отчёт по ученику ${student.name}\n\n${sections.join('\n\n')}`);
      toast('Текст отчёта скопирован');
    } catch (error) {
      console.error(error);
      dialog.inform('Не удалось скопировать текст отчёта.', 'Ошибка копирования', true);
    }
  }

  async function savePng() {
    if (!$('#reportStudent')?.value) { toast('Сначала выберите ученика'); return; }
    try {
      const canvas = await window.html2canvas($('#reportCard'), { scale: 2, backgroundColor: null });
      const link = document.createElement('a');
      link.download = `report-${localDay()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      toast('PNG сохранён');
    } catch (error) {
      console.error(error);
      dialog.inform('Не удалось сохранить PNG.', 'Ошибка экспорта', true);
    }
  }

  function bind() {
    if (bound || !page) return;
    bound = true;
    interactions = createReportInteractions({ page, onRowsChanged: renderPaper });
    $('#reportStudent')?.addEventListener('change', fillBuilder);
    $('#reportPeriod')?.addEventListener('change', () => {
      if ($('#customPeriodFields')) $('#customPeriodFields').style.display = $('#reportPeriod').value === 'custom' ? 'block' : 'none';
      fillBuilder();
    });
    ['#reportDateFrom', '#reportDateTo'].forEach((selector) => $(selector)?.addEventListener('change', fillBuilder));
    $('#reportComment')?.addEventListener('input', renderPaper);
    $('#reportNextPackagePreview')?.addEventListener('input', renderPaper);
    page.addEventListener('input', (event) => {
      if (event.target.matches('.r-name,[data-report-block]')) {
        interactions.syncAll();
        renderPaper();
      }
    });
    page.addEventListener('click', (event) => {
      const remove = event.target.closest('.r-remove');
      if (remove) {
        remove.closest('.builder-item')?.remove();
        interactions.syncAll();
        renderPaper();
        return;
      }
      const add = event.target.closest('#addReportTopic, #addReportTest, #addReportHw');
      if (!add) return;
      const kind = add.id === 'addReportTopic' ? 'topics' : add.id === 'addReportTest' ? 'tests' : 'hws';
      const selector = kind === 'topics' ? '#reportTopics' : kind === 'tests' ? '#reportTests' : '#reportHws';
      const list = $(selector);
      if (!list) return;
      list.insertAdjacentHTML('beforeend', rowEditor(''));
      interactions.openSection(kind);
      interactions.syncList(kind);
      list.lastElementChild?.querySelector('.r-name')?.focus();
      renderPaper();
    });
    $('#copyReportText')?.addEventListener('click', copyText);
    $('#saveReportPng')?.addEventListener('click', savePng);
  }

  function render() {
    bind();
    refreshStudentOptions();
    interactions?.syncAll();
    interactions?.syncActionBar();
  }

  return { render, fillBuilder, renderPaper };
}
