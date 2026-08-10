// Persisted state schema. Envelope: { meta:{schemaVersion,updatedAt}, data:{...} }.
// Первая явная версия — 1. Legacy без envelope (flat object) распознаётся как v0 и
// оборачивается в envelope миграцией 0→1 без изменения содержимого data.

export const CURRENT_SCHEMA_VERSION = 1;

/** Пустое приложение. Зеркалит blank из assets/app.js — совместимость важна. */
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
      tutor: '',
      theme: 'light',
      timeZone: 'auto',
      reminder: 15,
      sidebarCompact: false,
      customGoals: [],
      deletedGoals: [],
      scheduleExclusions: [],
    },
  };
}

export function blankState() {
  return {
    meta: { schemaVersion: CURRENT_SCHEMA_VERSION, updatedAt: new Date().toISOString() },
    data: blankData(),
  };
}

/** true, если объект похож на envelope с meta.schemaVersion. */
export function isEnvelope(obj) {
  return !!(
    obj &&
    typeof obj === 'object' &&
    obj.meta &&
    typeof obj.meta.schemaVersion === 'number' &&
    obj.data &&
    typeof obj.data === 'object'
  );
}

/** Оборачивает legacy-объект (flat data) в envelope v1. Не меняет содержимое data. */
export function wrapLegacy(legacyData) {
  return {
    meta: { schemaVersion: 1, updatedAt: new Date().toISOString() },
    data: legacyData,
  };
}
