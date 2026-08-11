import { createApp } from 'vue';
import AppNavigation from './components/AppNavigation.vue';

const navigationRoot = document.querySelector('#nav');

if (navigationRoot) createApp(AppNavigation).mount(navigationRoot);
