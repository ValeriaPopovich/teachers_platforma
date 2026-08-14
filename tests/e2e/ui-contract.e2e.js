import { expect, test } from '@playwright/test';
import { blankData, boot, go, persistedData, student } from './helpers.js';

// Keep the same wall-clock time in every environment. The fixture dates are local
// datetime values, so an explicit offset would shift their relation to "now" in CI.
const FIXED_NOW = new Date(2026, 7, 10, 13, 0, 0);

async function freezeTime(page) {
  await page.clock.setFixedTime(FIXED_NOW);
}

function regressionData() {
  const data = blankData();
  data.settings = {
    ...data.settings,
    tutor: 'Валерия',
    reminder: 30,
  };
  data.students.push(
    student({
      id: 's-single',
      name: 'Алиса Тестовая',
      contact: '@alisa',
      parentName: 'Елена',
      parentContact: '+7 900 000-00-00',
      goals: 'Повысить успеваемость',
      notes: 'Любит задачи со звёздочкой',
      lessonLink: 'https://example.com/lesson',
      scheduleSlots: [],
      createdAt: FIXED_NOW.getTime(),
      billingSince: FIXED_NOW.getTime(),
    }),
    student({
      id: 's-package',
      name: 'Дина Абонемент',
      payType: 'package',
      price: 900,
      scheduleSlots: [{ day: 1, time: '18:00' }],
      createdAt: FIXED_NOW.getTime(),
      billingSince: FIXED_NOW.getTime(),
    }),
  );
  data.groups.push({
    id: 'g-e2e',
    name: 'ОГЭ — тестовая группа',
    grade: '9 класс',
    duration: 60,
    members: ['s-single', 's-package'],
    scheduleSlots: [],
    notes: 'Групповая заметка',
  });
  data.lessons.push(
    {
      id: 'l-past',
      studentId: 's-single',
      date: '2026-08-10T12:00',
      status: 'done',
      lessonKind: 'oneoff',
      duration: 45,
      amount: 1200,
      topics: 'Линейные уравнения',
      homework: '№ 15–23',
      comment: 'Хорошая работа',
      previousHomework: 'yes',
      homeworkGrade: '4',
      testDone: 'yes',
      testName: 'Самостоятельная',
      testScore: 8,
      testMax: 10,
      payment: 'paid',
      reportFilled: true,
    },
    {
      id: 'l-future',
      studentId: 's-single',
      date: '2026-08-11T16:00',
      status: 'planned',
      lessonKind: 'regular',
      amount: 1200,
      topics: '',
      homework: '',
      comment: '',
      prepNote: 'Подготовить карточки',
      testDone: 'no',
      payment: 'unpaid',
      reportFilled: false,
    },
  );
  data.events.push({
    id: 'event-e2e',
    title: 'Консультация',
    date: '2026-08-12T16:00',
    duration: 45,
    note: 'Тестовая заметка',
  });
  data.payments.push({
    id: 'payment-e2e',
    studentId: 's-single',
    amount: 1200,
    date: '2026-08-10',
    createdAt: FIXED_NOW.getTime(),
    billingType: 'single',
    lessonId: 'l-past',
    note: 'Оплата тестового урока',
  });
  return data;
}

async function closeModal(page, id) {
  const legacyModal = page.locator(`#${id}`);
  if (await legacyModal.count()) {
    await legacyModal.locator('[data-close]').first().click();
    if (await page.locator('#appDialog.open').isVisible())
      await page.locator('#appDialogConfirm').click();
    await expect(legacyModal).not.toHaveClass(/open/);
    return;
  }

  const titleId = `${id}Title`;
  const modal = page.locator(`.ui-modal-wrap:has(#${titleId})`);
  await modal.getByRole('button', { name: 'Закрыть' }).click();
  const discardModal = page.locator('.ui-modal-wrap:has(.modal-discard)');
  const discardButton = discardModal.getByRole('button', { name: 'Закрыть без сохранения' });
  await discardButton.waitFor({ state: 'visible', timeout: 1000 }).catch(() => {});
  if (await discardButton.isVisible()) await discardButton.click();
  await expect(page.locator(`#${titleId}`)).toBeHidden();
  await expect(discardModal).toBeHidden();
}

async function openScheduleCreateForm(page, kind) {
  await page.getByRole('button', { name: 'Добавить', exact: true }).click();
  await page.getByRole('button', { name: kind, exact: true }).click();
}

test('all pages render their production data contract', async ({ page }) => {
  await freezeTime(page);
  await boot(page, regressionData());
  const pages = [
    ['dashboard', 'понедельник, 10 августа'],
    ['schedule', ''],
    ['students', 'Ученики и группы'],
    ['payments', 'Управление расчётами'],
    ['reports', 'Отчёты родителям'],
    ['settings', 'Профиль'],
  ];
  for (const [name, heading] of pages) {
    await go(page, name);
    if (heading) await expect(page.locator(`#page-${name} h1`)).toContainText(heading);
    await expect(page.locator(`#page-${name}`)).toBeVisible();
  }

  await go(page, 'schedule');
  await expect(page.locator('#calendar')).toHaveAttribute('data-calendar-view', 'week');
  await expect(page.locator('#calendar .timeline-day-head')).toHaveCount(7);
  await expect(page.locator('#calendar')).toContainText('Алиса Тестовая');

  await go(page, 'students');
  await expect(page.locator('.students-grid')).toContainText('Алиса Тестовая');
  await expect(page.locator('.group-grid')).toContainText('ОГЭ — тестовая группа');

  await go(page, 'payments');
  await expect(page.locator('#paymentStats .stat')).toHaveCount(3);
  await expect(page.locator('#paymentStats')).toContainText('Фактически получено');
  await page.getByRole('tab', { name: /История/ }).click();
  await expect(page.locator('#paymentHistory')).toContainText('Оплата тестового урока');

  await go(page, 'reports');
  await expect(page.locator('#reportStudent option')).toHaveCount(3);

  await go(page, 'settings');
  await expect(page.locator('#settingTutor')).toHaveValue('Валерия');
  await expect(page.locator('#settingReminder')).toHaveValue('30');
  await expect(page.locator('#accountEmail')).toBeVisible();
});

test('student, group and profile popups restore stored values', async ({ page }) => {
  await freezeTime(page);
  await boot(page, regressionData());
  await go(page, 'students');

  await page.locator('[data-student="s-single"]').click();
  await expect(page.locator('.ui-modal-wrap:has(.profile-modal-card)')).toBeVisible();
  await expect(page.locator('#profileBody')).toContainText('Алиса Тестовая');
  await expect(page.locator('#profileBody')).toContainText('@alisa');
  await expect(page.locator('#profileBody')).toContainText('Подготовить карточки');
  await page.locator('#editStudent').click();
  await expect(page.locator('#studentModalTitle')).toHaveText('Редактировать ученика');
  await expect(page.locator('#studentForm [name="name"]')).toHaveValue('Алиса Тестовая');
  await expect(page.locator('#studentForm [name="parentDetails"]')).toHaveValue(
    'Елена · +7 900 000-00-00',
  );
  await expect(page.locator('#studentForm [name="lessonLink"]')).toHaveValue(
    'https://example.com/lesson',
  );
  await expect(page.locator('#studentForm .schedule-slot')).toHaveCount(0);
  await closeModal(page, 'studentModal');

  await page.locator('[data-group="g-e2e"]').click();
  await expect(page.locator('#groupModalTitle')).toHaveText('Редактировать группу');
  await expect(page.locator('#groupForm [name="name"]')).toHaveValue('ОГЭ — тестовая группа');
  await expect(page.locator('#groupForm .member-chips input:checked')).toHaveCount(2);
  await expect(page.locator('#groupForm .schedule-slot')).toHaveCount(0);
  await closeModal(page, 'groupModal');

  await page.locator('[data-open="student"]').first().click();
  await expect(page.locator('#studentModalTitle')).toHaveText('Новый ученик');
  await expect(page.locator('#studentForm [name="id"]')).toHaveValue('');
  await expect(page.locator('#studentForm [name="name"]')).toBeFocused();
  await closeModal(page, 'studentModal');

  await page.locator('[data-open="group"]').first().click();
  await expect(page.locator('#groupModalTitle')).toHaveText('Новая группа');
  await expect(page.locator('#groupForm [name="id"]')).toHaveValue('');
  await closeModal(page, 'groupModal');

  await page.getByRole('button', { name: 'Опции ученика Алиса Тестовая' }).click();
  await page.getByRole('menuitem', { name: 'Удалить' }).click();
  await expect(page.locator('#appDialogMessage')).toHaveText(
    'Удалить ученика «Алиса Тестовая», его занятия и платежи? Это действие нельзя отменить.',
  );
  await page.locator('#appDialogCancel').click();
});

test('lesson, event and payment forms restore context and conditional fields', async ({ page }) => {
  await freezeTime(page);
  await boot(page, regressionData());
  await go(page, 'schedule');

  await page.locator('#calendar [data-lesson="l-past"]').click();
  await expect(page.locator('#lessonModalTitle')).toHaveText('Алиса Тестовая');
  await expect(page.locator('#lessonForm [name="targetId"]')).toHaveCount(0);
  await expect(page.locator('#lessonForm [name="topics"]')).toHaveValue('Линейные уравнения');
  await expect(page.locator('#lessonForm [name="duration"]')).toHaveValue('45');
  await expect(
    page.locator('#lessonForm [name="status"] + .custom-select-trigger .custom-select-value'),
  ).toHaveText('Проведено');
  await expect(page.locator('#previousHomeworkToggle')).toBeChecked();
  await expect(page.locator('#lessonForm [name="homeworkGrade"]')).toHaveValue('4');
  await expect(
    page.locator(
      '#lessonForm [name="homeworkGrade"] + .custom-select-trigger .custom-select-value',
    ),
  ).toContainText('4 — хорошо');
  await expect(page.locator('#testDoneToggle')).toBeChecked();
  await expect(page.locator('#lessonPaymentToggle')).toBeChecked();
  await expect(page.locator('#lessonPaymentField')).toContainText('Занятие оплачено');
  await expect(page.locator('#lessonPaymentField')).toBeVisible();
  await expect(page.locator('#parentMessage')).toHaveValue(/Линейные уравнения/);
  await closeModal(page, 'lessonModal');

  await page.locator('#calendar [data-event="event-e2e"]').click();
  await expect(page.locator('#eventModalTitle')).toHaveText('Редактировать событие');
  await expect(page.locator('#eventForm [name="title"]')).toHaveValue('Консультация');
  await expect(page.locator('#eventForm [name="endDate"]')).toHaveValue('2026-08-12T16:45');
  await expect(page.locator('#eventForm button[type="submit"]')).toHaveText('Сохранить событие');
  await closeModal(page, 'eventModal');

  await openScheduleCreateForm(page, 'Занятие');
  await expect(page.locator('#lessonModalTitle')).toHaveText('Занятие');
  await expect(page.locator('#lessonForm [name="id"]')).toHaveValue('');
  await closeModal(page, 'lessonModal');

  await openScheduleCreateForm(page, 'Дело');
  await expect(page.locator('#eventModalTitle')).toHaveText('Своё событие');
  await expect(page.locator('#eventForm [name="id"]')).toHaveValue('');
  await closeModal(page, 'eventModal');

  await go(page, 'payments');
  await page.locator('[data-open="payment"]').click();
  await expect(page.locator('#paymentModalTitle')).toHaveText('Добавить оплату');
  await page.locator('#paymentForm [name="studentId"]').selectOption('s-package');
  await expect(page.locator('#paymentModalTitle')).toHaveText('Пополнить абонемент');
  await expect(page.locator('#paymentForm [name="amount"]')).toBeEnabled();
  await expect(page.locator('#paymentForm')).toContainText('900 ₽');
  await closeModal(page, 'paymentModal');
});

test('reports, settings, tutorial, import and onboarding remain interactive', async ({ page }) => {
  await freezeTime(page);
  const data = regressionData();
  await boot(page, data);
  await go(page, 'reports');
  await page.locator('#reportStudent').selectOption('s-single');
  await expect(page.locator('#reportTopics .r-name')).toHaveValue('Линейные уравнения');
  await expect(page.locator('#paperPills')).toContainText('Алиса Тестовая');
  await expect(page.locator('#paperComment')).not.toHaveText('');

  await go(page, 'settings');
  await page.locator('#startTutorial').click();
  await expect(page.locator('#tutorialModal')).toHaveClass(/open/);
  await expect(page.locator('#tutorialCount')).toHaveText('1 из 5');
  await page.locator('#tutorialNext').click();
  await expect(page.locator('#tutorialTitle')).toHaveText('Ученики');
  await closeModal(page, 'tutorialModal');

  await page.locator('#importFile').setInputFiles({
    name: 'backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ meta: { schemaVersion: 1 }, data })),
  });
  await expect(page.locator('#importModal')).toHaveClass(/open/);
  await expect(page.locator('#importModalTitle')).toHaveText('Как загрузить копию?');
  await closeModal(page, 'importModal');
});

test('onboarding saves tutor name and closes its blocking popup', async ({ page }) => {
  await freezeTime(page);
  const onboarding = blankData();
  onboarding.settings.tutor = '';
  await boot(page, onboarding, { onboarding: true });
  await page.locator('#onboardingForm [name="tutor"]').fill('Новый педагог');
  await page.locator('#onboardingForm button[type="submit"]').click();
  await expect(page.locator('#onboardingModal')).not.toHaveClass(/open/);
  expect((await persistedData(page)).settings.tutor).toBe('Новый педагог');
});

test('empty group state spans and centers across the whole grid', async ({ page }) => {
  await freezeTime(page);
  const data = regressionData();
  data.groups = [];
  await boot(page, data);
  await go(page, 'students');
  const empty = page.locator('.group-grid .ui-empty-state');
  await expect(empty).toContainText('Групп пока нет');
  await expect(empty).toHaveCSS('grid-column-start', '1');
  await expect(empty).toHaveCSS('grid-column-end', '-1');
  await expect(empty).toHaveCSS('text-align', 'center');
});

test('form selects show full placeholder and long selected values', async ({ page }) => {
  await freezeTime(page);
  await boot(page, regressionData());

  await go(page, 'schedule');
  await openScheduleCreateForm(page, 'Занятие');
  const lessonTarget = page.locator(
    '#lessonForm [name="targetId"] + .custom-select-trigger .custom-select-value',
  );
  await expect(lessonTarget).toHaveText('Выберите ученика или группу');
  await page.locator('#lessonForm [name="lessonKind"]').selectOption('regular');
  await expect(
    page.locator('#lessonForm [name="lessonKind"] + .custom-select-trigger .custom-select-value'),
  ).toHaveText('Из регулярного расписания');
  await page.locator('#lessonForm [name="status"]').selectOption('unconfirmed');
  await expect(
    page.locator('#lessonForm [name="status"] + .custom-select-trigger .custom-select-value'),
  ).toHaveText('Требует подтверждения');
  await closeModal(page, 'lessonModal');

  await go(page, 'payments');
  await page.locator('[data-open="payment"]').click();
  await expect(
    page.locator('#paymentForm [name="studentId"] + .custom-select-trigger .custom-select-value'),
  ).toHaveText('Выберите ученика');
  await closeModal(page, 'paymentModal');

  await go(page, 'reports');
  await page.locator('#reportPeriod').selectOption('custom');
  await expect(
    page.locator('#reportPeriod + .custom-select-trigger .custom-select-value'),
  ).toHaveText('Свой период (до 45 дней)');
});

test('lesson form keeps conditional billing and status fields in valid states', async ({
  page,
}) => {
  await freezeTime(page);
  await boot(page, regressionData());
  await go(page, 'schedule');
  await openScheduleCreateForm(page, 'Занятие');

  const target = page.locator('#lessonForm [name="targetId"]');
  const kind = page.locator('#lessonForm [name="lessonKind"]');
  const status = page.locator('#lessonForm [name="status"]');
  const billing = page.locator('#packageOneoffBilling');
  const amount = page.locator('#lessonAmountField');
  const payment = page.locator('#lessonPaymentField');
  const packageChoice = page.locator('#packageOneoffField');
  const movedTo = page.locator('#movedToField');
  const testFields = page.locator('#testFields');
  const homeworkGrade = page.locator('#homeworkGradeField');
  const parentMessage = page.locator('#parentMessageField');

  await expect(testFields).toBeHidden();
  await expect(homeworkGrade).toBeHidden();
  await page.locator('#testDoneToggle').evaluate((element) => element.click());
  await expect(testFields).toBeVisible();
  await page.locator('#previousHomeworkToggle').evaluate((element) => element.click());
  await expect(homeworkGrade).toBeVisible();
  await expect(page.locator('#lessonForm [name="homeworkGrade"]')).toBeEnabled();

  await target.selectOption('s:s-single');
  await expect(packageChoice).toBeHidden();
  await expect(amount).toBeVisible();
  await expect(payment).toBeVisible();
  await expect(parentMessage).toBeVisible();

  await target.selectOption('s:s-package');
  await expect(packageChoice).toBeVisible();
  await expect(amount).toBeHidden();
  await expect(payment).toBeHidden();

  await billing.selectOption('extra_unpaid');
  await expect(amount).toBeVisible();
  await expect(payment).toBeHidden();

  await billing.selectOption('package');
  await kind.selectOption('regular');
  await expect(packageChoice).toBeHidden();
  await expect(amount).toBeHidden();
  await expect(payment).toBeVisible();

  await target.selectOption('g:g-e2e');
  await expect(amount).toBeHidden();
  await expect(payment).toBeHidden();
  await expect(parentMessage).toBeHidden();

  await status.selectOption('moved');
  await expect(movedTo).toBeVisible();
  await status.selectOption('planned');
  await expect(movedTo).toBeHidden();
});

test('responsive light and dark layouts remain stable with reduced motion', async ({ page }) => {
  await freezeTime(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await boot(page, regressionData());

  for (const width of [1440, 1024, 768, 425]) {
    await page.setViewportSize({ width, height: 900 });
    for (const theme of ['light', 'dark']) {
      await page.evaluate((value) => {
        document.documentElement.dataset.theme = value;
        document.documentElement.classList.toggle('dark', value === 'dark');
        document.body.classList.toggle('dark', value === 'dark');
      }, theme);
      await go(page, 'dashboard');
      await expect(page.locator('.app')).toHaveScreenshot(
        `responsive-dashboard-${width}-${theme}.png`,
        { animations: 'disabled' },
      );
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(1);
    }
  }
});

test('mobile navigation keeps profile reachable without an app header', async ({ page }) => {
  await freezeTime(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 425, height: 900 });
  await boot(page, regressionData());

  await expect(page.locator('.mobile-app-header')).toHaveCount(0);
  await expect(page.locator('#nav [data-page]:visible')).toHaveCount(7);
  await page.locator('#nav [data-page="settings"]').click();
  await expect(page.locator('#page-settings')).toBeVisible();

  const themeButton = page.locator('#page-settings').getByRole('button', { name: 'Сменить тему' });
  await themeButton.click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

  await page.locator('#authGate').evaluate((gate) => {
    gate.hidden = false;
  });
  await expect(page.locator('.auth-header')).toBeVisible();
  await expect(
    page.locator('.auth-header').getByRole('button', { name: 'Включить светлую тему' }),
  ).toBeVisible();
});

test('desktop sidebar is compact, centered and keeps utilities in profile', async ({ page }) => {
  await freezeTime(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1440, height: 900 });
  await boot(page, regressionData());

  const sidebar = page.locator('#sidebar');
  const box = await sidebar.boundingBox();
  const mainBox = await page.locator('.app > .main').boundingBox();
  expect(box).not.toBeNull();
  expect(mainBox).not.toBeNull();
  expect(box.height).toBeLessThan(800);
  expect(Math.abs(box.y + box.height / 2 - 450)).toBeLessThanOrEqual(12);
  expect(mainBox.x).toBeGreaterThanOrEqual(300);
  expect(mainBox.width).toBeGreaterThan(1000);
  await expect(sidebar.locator('#backupBtn, .side-warning, .subscribe')).toHaveCount(0);

  await page.locator('#sidebarToggle').click();
  await expect(page.locator('.app')).toHaveClass(/sidebar-compact/);
  const compactMainBox = await page.locator('.app > .main').boundingBox();
  expect(compactMainBox.x).toBeGreaterThanOrEqual(90);
  expect(compactMainBox.width).toBeGreaterThan(1200);

  await page.locator('#nav [data-page="settings"]').click();
  await expect(page.locator('#exportBtn')).toBeVisible();
});

test('visual baseline covers every page and the main data forms', async ({ page }) => {
  await freezeTime(page);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await boot(page, regressionData());
  for (const name of ['dashboard', 'schedule', 'students', 'payments', 'reports', 'settings']) {
    await go(page, name);
    await expect(page.locator('.app')).toHaveScreenshot(`page-${name}.png`, {
      animations: 'disabled',
    });
  }

  await go(page, 'students');
  await page.locator('[data-student="s-single"]').click();
  await page.locator('#editStudent').click();
  await expect(page.locator('.ui-modal-wrap:has(#studentModalTitle) .modal')).toHaveScreenshot(
    'form-student-edit.png',
    { animations: 'disabled' },
  );
  await closeModal(page, 'studentModal');

  await go(page, 'schedule');
  await page.locator('#calendar [data-lesson="l-past"]').click();
  await expect(page.locator('.ui-modal-wrap:has(#lessonModalTitle) .modal')).toHaveScreenshot(
    'form-lesson-edit.png',
    { animations: 'disabled' },
  );
  await closeModal(page, 'lessonModal');

  await go(page, 'payments');
  await page.locator('[data-open="payment"]').click();
  await page.locator('#paymentForm [name="studentId"]').selectOption('s-package');
  await expect(page.locator('.ui-modal-wrap:has(#paymentModalTitle) .modal')).toHaveScreenshot(
    'form-payment-package.png',
    { animations: 'disabled' },
  );
  await closeModal(page, 'paymentModal');

  await go(page, 'settings');
  await page.locator('#startTutorial').click();
  await expect(page.locator('#tutorialModal .modal')).toHaveScreenshot('popup-tutorial.png', {
    animations: 'disabled',
  });
});
