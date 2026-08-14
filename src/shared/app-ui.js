import { createDialog } from './dialog.js';
import { createModalManager } from './modal.js';
import { createToast } from './toast.js';

// Shared UI infrastructure singletons (toast/dialog/legacy modal manager),
// used by both bootstrap.js and Vue module components.
export const toast = createToast();
export const dialog = createDialog();
export const modal = createModalManager(document, { ask: dialog.ask });
