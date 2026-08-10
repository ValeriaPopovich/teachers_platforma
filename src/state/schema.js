export const CURRENT_SCHEMA_VERSION = 1;
export function blankData() { return { students: [], groups: [], lessons: [], events: [], payments: [], financeArchive: {}, topicLog: {}, settings: { tutor: '', theme: 'light', timeZone: 'auto', reminder: 15, sidebarCompact: false, customGoals: [], deletedGoals: [] } }; }
export function blankState() { return { meta: { schemaVersion: CURRENT_SCHEMA_VERSION, updatedAt: new Date().toISOString() }, data: blankData() }; }
export function isEnvelope(obj) { return !!(obj && typeof obj === 'object' && obj.meta && typeof obj.meta.schemaVersion === 'number' && obj.data && typeof obj.data === 'object'); }
export function wrapLegacy(legacyData) { return { meta: { schemaVersion: 1, updatedAt: new Date().toISOString() }, data: legacyData }; }
