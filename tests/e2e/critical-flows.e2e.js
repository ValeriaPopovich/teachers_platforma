import fs from 'node:fs/promises';
import { test, expect } from '@playwright/test';
import { blankData, boot, go, localDateTime, persistedData, student } from './helpers.js';

test('SPA routes survive reload and browser history navigation', async ({ page }) => {
  await boot(page);
  await go(page, 'schedule');

  await page.reload();
  await expect(page.locator('#page-schedule')).toHaveClass(/active/);

  await go(page, 'students');
  await page.goBack();
  await expect(page).toHaveURL(/\/schedule$/);
  await expect(page.locator('#page-schedule')).toHaveClass(/active/);
});

test('new account creates its first student and lesson from the dashboard', async ({ page }) => {
  await boot(page);
  await expect(page.getByRole('heading', { name: 'Начните с первого ученика' })).toBeVisible();
  await page.getByRole('button', { name: '+ Добавить ученика' }).click();
  await page.locator('#studentForm [name="name"]').fill('Первый ученик');
  await page.locator('#studentForm [name="price"]').fill('1200');
  await page.getByRole('button', { name: 'Сохранить ученика' }).click();

  await expect(page.locator('#page-dashboard')).toHaveClass(/active/);
  await page.locator('#page-dashboard [data-open="lesson"]').click();
  await expect(page.locator('#lessonModalTitle')).toHaveText('Занятие');
  await page.locator('#lessonForm [name="targetId"]').selectOption({ label: 'Первый ученик' });
  await page.locator('#lessonForm [name="date"]').fill(localDateTime(60));
  await page.locator('#lessonForm button[type="submit"]').click();

  const data = await persistedData(page);
  expect(data.students).toHaveLength(1);
  expect(data.lessons).toHaveLength(1);
  expect(data.lessons[0].studentId).toBe(data.students[0].id);
});

test('empty payment history keeps its period calendar inside the mobile viewport', async ({
  page,
}) => {
  await page.setViewportSize({ width: 425, height: 900 });
  await boot(page);
  await page.locator('#nav [data-page="payments"]').evaluate((element) => element.click());
  await expect(page.locator('#page-payments')).toHaveClass(/active/);
  await page.getByRole('tab', { name: 'История платежей' }).click();
  await expect(page.getByRole('heading', { name: 'Платежей за этот период нет' })).toBeVisible();
  await page.getByRole('button', { name: /Этот месяц/ }).click();

  const calendar = page.locator('.payments-mini-calendar');
  await expect(calendar).toBeVisible();
  const box = await calendar.boundingBox();
  expect(box).not.toBeNull();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(425);
});

test('student lifecycle: create, edit and persist after reload', async ({ page }) => {
  await boot(page);
  await go(page, 'students');
  await page.locator('#page-students [data-open="student"]').first().click();
  await page.locator('#studentForm [name="name"]').fill('Мария E2E');
  await page.locator('#studentForm [name="grade"]').selectOption({ label: '9 класс' });
  await page.locator('#studentForm [name="price"]').fill('1500');
  await page.locator('#studentForm [name="contact"]').fill('@maria_e2e');
  await page.getByRole('button', { name: '+ Ещё день' }).click();
  await page.getByRole('button', { name: 'Сохранить ученика' }).click();
  await expect(page.getByRole('heading', { name: 'Мария E2E' })).toBeVisible();

  await page.getByRole('button', { name: 'Открыть карточку: Мария E2E' }).click();
  await page.locator('#editStudent').click();
  await page.locator('#studentForm [name="name"]').fill('Мария Обновлённая');
  await page.getByRole('button', { name: 'Сохранить ученика' }).click();
  await expect(page.getByRole('heading', { name: 'Мария Обновлённая' })).toBeVisible();

  await page.reload();
  await go(page, 'students');
  await expect(page.getByRole('heading', { name: 'Мария Обновлённая' })).toBeVisible();
  const data = await persistedData(page);
  expect(data.students).toHaveLength(1);
  expect(data.students[0]).toMatchObject({
    name: 'Мария Обновлённая',
    price: 1500,
    scheduleSlots: [{ day: 1, time: '17:00' }],
  });
});

test('lesson lifecycle: create, reopen with locked owner and persist', async ({ page }) => {
  const data = blankData();
  data.students.push(student());
  await boot(page, data);
  await go(page, 'schedule');
  await page.getByRole('button', { name: 'Добавить', exact: true }).click();
  await page.getByRole('button', { name: 'Занятие', exact: true }).click();
  await expect(page.locator('#lessonModalTitle')).toHaveText('Занятие');
  await page.locator('#lessonForm [name="targetId"]').selectOption('s:s-e2e');
  await page.locator('#lessonForm [name="date"]').fill(localDateTime(60));
  await page.locator('#lessonForm [name="status"]').selectOption('done');
  await page.locator('#lessonForm [name="topics"]').fill('Квадратные уравнения');
  await page.locator('#previousHomeworkToggle').focus();
  await page.keyboard.press('Space');
  await page.locator('#lessonForm [name="homeworkGrade"]').selectOption('4');
  await page.locator('#lessonPaymentToggle').focus();
  await page.keyboard.press('Space');
  await expect(page.locator('#parentMessage')).toHaveValue(/Квадратные уравнения/);
  await page.locator('#lessonForm button[type="submit"]').click();

  const stored = await persistedData(page);
  expect(stored.lessons).toHaveLength(1);
  expect(stored.lessons[0]).toMatchObject({
    studentId: 's-e2e',
    status: 'done',
    topics: 'Квадратные уравнения',
    previousHomework: 'yes',
    homeworkGrade: '4',
    payment: 'paid',
  });
  expect(stored.payments).toHaveLength(1);

  await page.locator('#calendar [data-lesson]').first().click();
  await expect(page.locator('#lessonModalTitle')).toHaveText('Анна E2E');
  await expect(page.locator('#previousHomeworkToggle')).toBeChecked();
  await expect(page.locator('#lessonForm [name="homeworkGrade"]')).toHaveValue('4');
  await expect(page.locator('#lessonPaymentToggle')).toBeChecked();
  await page.locator('.ui-modal-wrap:has(#lessonModalTitle) button.close').click();
  await page.reload();
  const afterReload = await persistedData(page);
  expect(afterReload.lessons[0].studentId).toBe('s-e2e');
});

test('single payment: record payment and keep it after reload', async ({ page }) => {
  const data = blankData();
  data.students.push(student());
  await boot(page, data);
  await go(page, 'payments');
  await page.locator('#page-payments [data-open="payment"]').click();
  await page.locator('#paymentForm [name="studentId"]').selectOption('s-e2e');
  await page.locator('#paymentForm [name="amount"]').fill('2400');
  await page.locator('#paymentForm button[type="submit"]').click();

  await page.reload();
  const stored = await persistedData(page);
  expect(stored.payments).toHaveLength(1);
  expect(stored.payments[0]).toMatchObject({
    studentId: 's-e2e',
    amount: 2400,
    billingType: 'single',
  });
});

test('package billing: payment amount determines covered lessons', async ({ page }) => {
  const data = blankData();
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  data.students.push(
    student({
      payType: 'package',
      price: 800,
      createdAt: monthStart,
      billingSince: monthStart,
      scheduleSlots: [{ day: now.getDay(), time: '17:00' }],
    }),
  );
  await boot(page, data);
  await go(page, 'payments');
  await page.locator('#page-payments [data-open="payment"]').click();
  await page.locator('#paymentForm [name="studentId"]').selectOption('s-e2e');
  const lessons = 4;
  const amount = lessons * 800;
  await page.locator('#paymentForm [name="amount"]').fill(String(amount));
  await expect(page.locator('#paymentForm')).toContainText(`Будет оплачено ещё ${lessons} зан.`);
  await page.locator('#paymentForm button[type="submit"]').click();

  const stored = await persistedData(page);
  expect(stored.payments[0]).toMatchObject({
    billingType: 'package',
    packageLessons: lessons,
    amount,
  });
});

test('reports: builder changes update preview and copy text', async ({ page }) => {
  const data = blankData();
  data.students.push(student({ name: 'София E2E' }));
  data.lessons.push({
    id: 'l-report',
    studentId: 's-e2e',
    date: localDateTime(-24 * 60),
    status: 'done',
    payment: 'unpaid',
    amount: 1200,
    topics: 'Линейные уравнения',
    homework: '№ 1–5',
    homeworkResult: 5,
    testDone: 'yes',
    testName: 'Мини-тест',
    testScore: '9',
    testMax: '10',
    reportFilled: true,
  });
  await boot(page, data);
  await go(page, 'reports');
  await page.locator('#reportStudent + .custom-select-trigger').click();
  await page.locator('.custom-select-popover').getByRole('option', { name: 'София E2E' }).click();
  await expect(page.locator('#reportTopics .r-name').first()).toHaveValue('Линейные уравнения');
  await page.locator('#reportTopics .r-name').first().fill('Квадратные уравнения');
  await expect(page.locator('#paperTopics')).toContainText('Квадратные уравнения');
  await page.getByRole('button', { name: 'Добавить тему' }).click();
  await page.locator('#reportTopics .r-name').last().fill('Формулы сокращённого умножения');
  await expect(page.locator('#paperTopics')).toContainText('Формулы сокращённого умножения');

  await page.locator('#copyReportText').click();
  const clipboard = await page.evaluate(() => navigator.clipboard.readText());
  expect(clipboard).toContain('София E2E');
  expect(clipboard).toContain('Квадратные уравнения');
});

test('backup export downloads valid current state', async ({ page }) => {
  const data = blankData();
  data.students.push(student({ name: 'Backup E2E' }));
  await boot(page, data);
  const downloadPromise = page.waitForEvent('download');
  await go(page, 'settings');
  await page.locator('#exportBtn').click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^teachers-platforma-\d{4}-\d{2}-\d{2}\.json$/);
  const file = await download.path();
  const parsed = JSON.parse(await fs.readFile(file, 'utf8'));
  expect(parsed).toMatchObject({ app: 'teachers-platforma', schemaVersion: 1 });
  expect(parsed.data.students[0].name).toBe('Backup E2E');
});
