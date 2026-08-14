import { UiButton, UiEmptyState } from '@ui';
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';

import { dialog, toast } from '../../../../../shared/app-ui.js';
import { localDay } from '../../../../../shared/format.js';
import { useAppState } from '../../../../../state/use-app-state.js';
import { openNewStudent } from '../../../../students/students-ui.js';
import { createReportInteractions } from '../../../report-drag.js';
import {
  buildReportSource,
  getNextPackageSummary,
  getReportBounds,
} from '../../../reports.model.js';
import { REPORT_PERIOD_OPTIONS, RING_CIRCUMFERENCE } from './constants.js';

let rowIdSeq = 0;
const nextRowId = () => (rowIdSeq += 1);
const rowsFrom = (values) => values.map((value) => ({ id: nextRowId(), value }));

export default {
  name: 'ReportsPage',
  components: { UiButton, UiEmptyState },
  setup() {
    const state = useAppState();

    const studentId = ref(state.value.students.length === 1 ? state.value.students[0].id : '');
    const period = ref('30');
    const dateFrom = ref('');
    const dateTo = ref('');
    const comment = ref('');
    const nextPackagePreview = ref('');
    let nextPackageAutoFor = ''; // student id the current auto-generated text belongs to

    const blocks = reactive({
      general: true,
      topics: true,
      tests: true,
      hws: true,
      nextPackage: true,
    });
    const topics = ref([]);
    const tests = ref([]);
    const hws = ref([]);
    const topicsListEl = ref(null);
    const testsListEl = ref(null);
    const hwsListEl = ref(null);

    let interactions = null;

    const bounds = computed(() =>
      getReportBounds({ period: period.value, dateFrom: dateFrom.value, dateTo: dateTo.value }),
    );
    const source = computed(() => buildReportSource(state.value, studentId.value, bounds.value));
    const student = computed(() => source.value.student);
    const showNextPackage = computed(() => student.value?.payType === 'package');
    const periodLabel = computed(
      () => REPORT_PERIOD_OPTIONS.find((option) => option.value === period.value)?.label || '',
    );

    function rowsContainer(kind) {
      return { topics: topicsListEl, tests: testsListEl, hws: hwsListEl }[kind].value;
    }

    function rowsRef(kind) {
      return { topics, tests, hws }[kind];
    }

    /** Re-derives array order from the DOM after report-drag.js moves a row. */
    function resyncRowOrder() {
      for (const kind of ['topics', 'tests', 'hws']) {
        const container = rowsContainer(kind);
        if (!container) continue;
        const listRef = rowsRef(kind);
        const domOrder = [...container.querySelectorAll('.builder-item')].map(
          (node) => node.dataset.rowId,
        );
        listRef.value = domOrder
          .map((id) => listRef.value.find((row) => String(row.id) === id))
          .filter(Boolean);
      }
    }

    function onRowsChanged() {
      resyncRowOrder();
    }

    function onListInput() {
      interactions?.syncAll();
    }

    function fillBuilderFromSource() {
      topics.value = rowsFrom(source.value.topics);
      tests.value = rowsFrom(source.value.tests);
      hws.value = rowsFrom(source.value.homeworks);
      if (showNextPackage.value) {
        const auto = getNextPackageSummary(state.value, studentId.value);
        if (!nextPackagePreview.value || nextPackageAutoFor !== studentId.value) {
          nextPackagePreview.value = auto;
          nextPackageAutoFor = studentId.value;
        }
      } else {
        nextPackagePreview.value = '';
        nextPackageAutoFor = '';
      }
      nextTick(() => interactions?.syncAll());
    }

    watch([studentId, period, dateFrom, dateTo], fillBuilderFromSource);
    watch(
      () => state.value.students,
      () => {
        // A student referenced by the current selection may have been removed.
        if (studentId.value && !state.value.students.some((item) => item.id === studentId.value)) {
          studentId.value = '';
        }
      },
    );

    function onAddRow(kind) {
      rowsRef(kind).value.push({ id: nextRowId(), value: '' });
      nextTick(() => {
        interactions?.openSection(kind);
        interactions?.syncList(kind);
        rowsContainer(kind)?.querySelector('.builder-item:last-child .r-name')?.focus();
      });
    }

    function onStudentChange(event) {
      studentId.value = event.target.value;
      fillBuilderFromSource();
    }

    function onRemoveRow(kind, id) {
      const listRef = rowsRef(kind);
      listRef.value = listRef.value.filter((row) => row.id !== id);
      nextTick(() => interactions?.syncList(kind));
    }

    const paperTopics = computed(() => topics.value.map((row) => row.value.trim()).filter(Boolean));
    const paperTests = computed(() => tests.value.map((row) => row.value.trim()).filter(Boolean));
    const paperHws = computed(() => hws.value.map((row) => row.value.trim()).filter(Boolean));

    const ringOffset = computed(
      () => RING_CIRCUMFERENCE * (1 - source.value.progressPercent / 100),
    );

    function onBlockCheckboxChange(kind) {
      blocks[kind] = !blocks[kind];
    }

    async function onCopyTextButtonClick() {
      if (!student.value) {
        toast('Сначала выберите ученика');
        return;
      }
      const sections = [];
      if (blocks.general) sections.push(`Комментарий: ${comment.value.trim() || '—'}`);
      if (blocks.topics) sections.push(`Темы: ${paperTopics.value.join('; ') || '—'}`);
      if (blocks.hws) sections.push(`Домашние задания: ${paperHws.value.join('; ') || '—'}`);
      if (blocks.tests) sections.push(`Проверочные: ${paperTests.value.join('; ') || '—'}`);
      if (blocks.nextPackage && nextPackagePreview.value.trim())
        sections.push(`Следующий месяц: ${nextPackagePreview.value.trim()}`);
      try {
        await navigator.clipboard.writeText(
          `Отчёт по ученику ${student.value.name}\n\n${sections.join('\n\n')}`,
        );
        toast('Текст отчёта скопирован');
      } catch (error) {
        console.error(error);
        dialog.inform('Не удалось скопировать текст отчёта.', 'Ошибка копирования', true);
      }
    }

    async function onSavePngButtonClick() {
      if (!studentId.value) {
        toast('Сначала выберите ученика');
        return;
      }
      try {
        const canvas = await window.html2canvas(document.getElementById('reportCard'), {
          scale: 2,
          backgroundColor: null,
        });
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

    // The sticky action bar measures the (possibly hidden) page's layout, so
    // it needs to re-measure whenever the reports tab becomes active.
    function onAppPageChange(event) {
      if (event.detail?.page === 'reports') interactions?.syncActionBar();
    }

    onMounted(() => {
      fillBuilderFromSource();
      interactions = createReportInteractions({
        page: document.getElementById('page-reports'),
        onRowsChanged,
      });
      interactions.syncAll();
      interactions.syncActionBar();
      window.addEventListener('app:page-change', onAppPageChange);
    });
    onBeforeUnmount(() => {
      window.removeEventListener('app:page-change', onAppPageChange);
      interactions = null;
    });

    return {
      blocks,
      comment,
      dateFrom,
      dateTo,
      hws,
      hwsListEl,
      nextPackagePreview,
      openNewStudent,
      onAddRow,
      onBlockCheckboxChange,
      onCopyTextButtonClick,
      onListInput,
      onRemoveRow,
      onSavePngButtonClick,
      onStudentChange,
      paperHws,
      paperTests,
      paperTopics,
      period,
      periodLabel,
      periodOptions: REPORT_PERIOD_OPTIONS,
      ringCircumference: RING_CIRCUMFERENCE,
      ringOffset,
      showNextPackage,
      source,
      student,
      studentId,
      students: computed(() => state.value.students),
      tests,
      testsListEl,
      topics,
      topicsListEl,
    };
  },
};
