import { createApp } from 'vue';

import DashboardPage from '../modules/dashboard/components/dashboard-page/index.vue';
import PaymentsPage from '../modules/payments/components/payments-page/index.vue';
import ScheduleCreateSheet from '../modules/schedule/components/schedule-create-sheet/index.vue';
import StudentsPage from '../modules/students/components/students-page/index.vue';
import AppNavigation from './components/app-navigation/index.vue';

const navigationRoot = document.querySelector('#nav');
const dashboardPageRoot = document.querySelector('#dashboardPageRoot');
const studentsPageRoot = document.querySelector('#studentsPageRoot');
const paymentsPageRoot = document.querySelector('#paymentsPageRoot');
const scheduleCreateSheetRoot = document.querySelector('#scheduleCreateSheetRoot');

if (navigationRoot) createApp(AppNavigation).mount(navigationRoot);
if (dashboardPageRoot) createApp(DashboardPage).mount(dashboardPageRoot);
if (studentsPageRoot) createApp(StudentsPage).mount(studentsPageRoot);
if (paymentsPageRoot) createApp(PaymentsPage).mount(paymentsPageRoot);
if (scheduleCreateSheetRoot) createApp(ScheduleCreateSheet).mount(scheduleCreateSheetRoot);
