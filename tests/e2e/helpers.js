import { expect } from '@playwright/test';

export const STORAGE_KEY = 'tutorCabinet_v1';

export function blankData() {
  return {
    students: [],
    groups: [],
    lessons: [],
    events: [],
    payments: [],
    financeArchive: {},
    topicLog: {},
    settings: {
      tutor: 'E2E Tutor',
      theme: 'light',
      timeZone: 'auto',
      reminder: 0,
      sidebarCompact: false,
      customGoals: [],
      deletedGoals: [],
    },
  };
}

export function localDay(value = new Date()) {
  const date = new Date(value);
  const pad = (number) => String(number).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function localDateTime(offsetMinutes = 0) {
  const date = new Date(Date.now() + offsetMinutes * 60_000);
  const pad = (number) => String(number).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function student(overrides = {}) {
  return {
    id: 's-e2e',
    name: 'Анна E2E',
    grade: '8 класс',
    price: 1200,
    duration: 60,
    payType: 'single',
    scheduleSlots: [],
    createdAt: Date.now(),
    billingSince: Date.now(),
    ...overrides,
  };
}

export async function boot(page, data = blankData()) {
  await page.route('**/assets/auth.js', async (route) => {
    await route.fulfill({
      contentType: 'application/javascript',
      body: `window.tutorCloud = {
        user: { email: 'e2e@example.test' },
        profile: { email: 'e2e@example.test', access_until: null },
        queueSave() {},
      };`,
    });
  });
  await page.route('https://cdn.jsdelivr.net/npm/@supabase/**', async (route) => {
    await route.fulfill({ contentType: 'application/javascript', body: 'window.supabase = {};' });
  });
  await page.route('https://cdn.jsdelivr.net/npm/html2canvas@**', async (route) => {
    await route.fulfill({
      contentType: 'application/javascript',
      body: "window.html2canvas = async () => ({ toDataURL: () => 'data:image/png;base64,iVBORw0KGgo=' });",
    });
  });
  await page.route('https://fonts.googleapis.com/**', (route) => route.abort());
  await page.route('https://fonts.gstatic.com/**', (route) => route.abort());
  await page.addInitScript(({ key, state }) => {
    if (localStorage.getItem(key) !== null) return;
    localStorage.setItem(key, JSON.stringify({
      meta: { schemaVersion: 1, updatedAt: new Date().toISOString() },
      data: state,
    }));
  }, { key: STORAGE_KEY, state: data });
  await page.goto('/');
  await expect(page.locator('#page-dashboard')).toHaveClass(/active/);
  await expect(page.locator('#onboardingModal')).not.toHaveClass(/open/);
}

export async function persistedData(page) {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key)).data, STORAGE_KEY);
}

export async function go(page, name) {
  await page.locator(`#nav [data-page="${name}"]`).click();
  await expect(page.locator(`#page-${name}`)).toHaveClass(/active/);
}
