import fs from 'node:fs/promises';
import { test, expect } from '@playwright/test';
import { blankData, boot, go, localDateTime, localDay, persistedData, student } from './helpers.js';

test('student lifecycle: create, edit and persist after reload', async ({ page }) => {
  await boot(page);
  await go(page, 'students');
  await page.locator('#page-students [data-open="student"]').first().click();
  await page.locator('#studentForm [name="name"]').fill('Мария E2E');
  await page.locator('#studentForm [name="grade"]').selectOption({ label: '9 класс' });
  await page.locator('#studentForm [name="price"]').fill('1500');
  await page.locator('#studentForm [name="contact"]').fill('@maria_e2e');
  await page.locator('#studentForm button[type="submit"]').click();
  await expect(page.locator('#studentGrid')).toContainText('Мария E2E');

  await page.locator('#studentGrid [data-student]').filter({ hasText: 'Мария E2E' }).click();
  await page.locator('#editStudent').click();
  await page.locator('#studentForm [name="name"]').fill('Мария Обновлённая');
  await page.locator('#studentForm button[type="submit"]').click();
  await expect(page.locator('#studentGrid')).toContainText('Мария Обновлённая');

  await page.reload();
  await go(page, 'students');
  await expect(page.locator('#studentGrid')).toContainText('Мария Обновлённая');
  const data = await persistedData(page);
  expect(data.students).toHaveLength(1);
  expect(data.students[0]).toMatchObject({ name: 'Мария Обновлённая', price: 1500 });
});

test('lesson lifecycle: create, reopen with locked owner and persist', async ({ page }) => {
  const data = blankData();
  data.students.push(student());
  await boot(page, data);
  await go(page, 'schedule');
  await page.locator('#page-schedule [data-open="lesson"]').first().click();
  await page.locator('#lessonForm [name="targetId"]').selectOption('s:s-e2e');
  await page.locator('#lessonForm [name="date"]').fill(localDateTime(60));
  await page.locator('#lessonForm [name="status"]').selectOption('done');
  await page.locator('#lessonForm [name="topics"]').fill('Квадратные уравнения');
  await page.locator('#lessonForm button[type="submit"]').click();

  const stored = await persistedData(page);
  expect(stored.lessons).toHaveLength(1);
  expect(stored.lessons[0]).toMatchObject({ studentId: 's-e2e', status: 'done', topics: 'Квадратные уравнения' });

  await page.locator('#calendar [data-lesson]').first().click();
  await expect(page.locator('#lessonForm [name="targetId"]')).toBeDisabled();
  await page.locator('#lessonForm [data-close], #lessonModal [data-close]').first().click();
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
  await page.locator('#paymentForm [name="note"]').fill('Оплата E2E');
  await page.locator('#paymentForm button[type="submit"]').click();
  await expect(page.locator('#paymentHistory')).toContainText('Анна E2E');
  await expect(page.locator('#paymentHistory')).toContainText('2 400');

  await page.reload();
  const stored = await persistedData(page);
  expect(stored.payments).toHaveLength(1);
  expect(stored.payments[0]).toMatchObject({ studentId: 's-e2e', amount: 2400, billingType: 'single' });
});

test('package billing: schedule determines lesson count and amount', async ({ page }) => {
  const data = blankData();
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  data.students.push(student({
    payType: 'package',
    price: 800,
    createdAt: monthStart,
    billingSince: monthStart,
    scheduleSlots: [{ day: now.getDay(), time: '17:00' }],
  }));
  await boot(page, data);
  await go(page, 'payments');
  await page.locator('#page-payments [data-open="payment"]').click();
  await page.locator('#paymentForm [name="studentId"]').selectOption('s-e2e');
  await page.locator('#paymentForm [name="date"]').fill(localDay());
  await expect(page.locator('#paymentPackageField')).toBeVisible();
  const lessons = Number(await page.locator('#paymentForm [name="packageLessons"]').inputValue());
  const amount = Number(await page.locator('#paymentForm [name="amount"]').inputValue());
  expect(lessons).toBeGreaterThan(0);
  expect(amount).toBe(lessons * 800);
  await page.locator('#paymentForm button[type="submit"]').click();

  const stored = await persistedData(page);
  expect(stored.payments[0]).toMatchObject({ billingType: 'package', packageLessons: lessons, amount });
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
  await page.locator('#reportStudent').selectOption('s-e2e');
  await expect(page.locator('#reportTopics .r-name').first()).toHaveValue('Линейные уравнения');
  await page.locator('#reportTopics .r-name').first().fill('Квадратные уравнения');
  await expect(page.locator('#paperTopics')).toContainText('Квадратные уравнения');
  await page.locator('#addReportTopic').click();
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
  await page.locator('#backupBtn').click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^teachers-platforma-\d{4}-\d{2}-\d{2}\.json$/);
  const file = await download.path();
  const parsed = JSON.parse(await fs.readFile(file, 'utf8'));
  expect(parsed).toMatchObject({ app: 'teachers-platforma', schemaVersion: 1 });
  expect(parsed.data.students[0].name).toBe('Backup E2E');
});
