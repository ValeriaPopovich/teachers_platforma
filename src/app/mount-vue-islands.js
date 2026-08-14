import { UiPageSkeleton } from '@ui';
import { createApp, h } from 'vue';

import { DashboardPage } from '../modules/dashboard/index.js';
import { PaymentsPage } from '../modules/payments/index.js';
import { ReportsPage } from '../modules/reports/index.js';
import { SchedulePage } from '../modules/schedule/index.js';
import { SettingsPage } from '../modules/settings/index.js';
import { StudentsPage } from '../modules/students/index.js';
import AppNavigation from './components/app-navigation/index.vue';
import { appUiState } from './app-ui-state.js';

const navigationRoot = document.querySelector('#nav');
const dashboardPageRoot = document.querySelector('#dashboardPageRoot');
const studentsPageRoot = document.querySelector('#studentsPageRoot');
const paymentsPageRoot = document.querySelector('#paymentsPageRoot');
const settingsPageRoot = document.querySelector('#settingsPageRoot');
const reportsPageRoot = document.querySelector('#reportsPageRoot');
const schedulePageRoot = document.querySelector('#schedulePageRoot');

if (navigationRoot) createApp(AppNavigation).mount(navigationRoot);
function mountPage(root, Page, variant) {
  if (!root) return;
  createApp({
    name: `${Page.name || variant}Island`,
    setup: () => () => [appUiState.hydrating ? h(UiPageSkeleton, { variant }) : null, h(Page)],
  }).mount(root);
}

mountPage(dashboardPageRoot, DashboardPage, 'dashboard');
mountPage(studentsPageRoot, StudentsPage, 'students');
mountPage(paymentsPageRoot, PaymentsPage, 'payments');
mountPage(settingsPageRoot, SettingsPage, 'settings');
mountPage(reportsPageRoot, ReportsPage, 'reports');
mountPage(schedulePageRoot, SchedulePage, 'schedule');
