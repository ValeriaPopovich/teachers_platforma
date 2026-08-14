export const ACTIVE_PAGE_STORAGE_KEY = 'tutorCabinet_activePage';
export const SPA_REDIRECT_STORAGE_KEY = 'tutorCabinet_spaRedirect';
export const DEFAULT_PAGE = 'dashboard';
export const PAGE_NAMES = Object.freeze([
  'dashboard',
  'schedule',
  'students',
  'payments',
  'reports',
  'board',
  'settings',
]);

const PAGE_NAME_SET = new Set(PAGE_NAMES);

export function isPageName(page) {
  return PAGE_NAME_SET.has(page);
}

export function pagePath(page) {
  const validPage = isPageName(page) ? page : DEFAULT_PAGE;
  return validPage === DEFAULT_PAGE ? '/' : `/${validPage}`;
}

// Kept for migrating links created before clean History API routes were introduced.
export function pageFromHash(hash = '') {
  const route = hash.replace(/^#\/?/, '').split(/[?/]/, 1)[0];
  return isPageName(route) ? route : null;
}

export function pageFromPath(pathname = '/') {
  const route = pathname.replace(/^\/+|\/+$/g, '');
  if (!route) return DEFAULT_PAGE;
  return isPageName(route) ? route : null;
}

export function resolveInitialPage(pathname = '/', hash = '') {
  return pageFromHash(hash) || pageFromPath(pathname) || DEFAULT_PAGE;
}

export function clearActivePage(storage = sessionStorage) {
  storage.removeItem(ACTIVE_PAGE_STORAGE_KEY);
}
