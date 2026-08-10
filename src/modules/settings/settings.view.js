import { $ } from '../../shared/dom.js';

export function createSettingsView({ store, service, toast, getAccount = () => window.tutorCloud }) {
  let bound = false;

  function render() {
    const settings = store.getState().settings;
    document.documentElement.dataset.theme = settings.theme || 'light';
    document.body.classList.toggle('dark', settings.theme === 'dark');
    $('.app')?.classList.toggle('sidebar-compact', !!settings.sidebarCompact);
    if ($('#settingTutor')) $('#settingTutor').value = settings.tutor || '';
    if ($('#settingReminder')) $('#settingReminder').value = String(settings.reminder ?? 15);
    const themeButton = $('#themeBtn');
    if (themeButton?.firstChild) themeButton.firstChild.textContent = settings.theme === 'dark' ? '☀ ' : '☾ ';

    const cloud = getAccount?.() || {};
    const profile = cloud.profile;
    if ($('#accountEmail') && cloud.user) $('#accountEmail').textContent = profile?.email || cloud.user.email || '—';
    if ($('#accountAccess') && profile) $('#accountAccess').textContent = profile.access_until ? `до ${new Date(profile.access_until).toLocaleDateString('ru-RU')}` : 'Без ограничения';
  }

  function bind() {
    if (bound) return;
    bound = true;
    $('#themeBtn')?.addEventListener('click', service.toggleTheme);
    $('#profileThemeBtn')?.addEventListener('click', service.toggleTheme);
    $('#sidebarToggle')?.addEventListener('click', service.toggleSidebar);
    $('#saveSettings')?.addEventListener('click', () => {
      service.save({ tutor: $('#settingTutor')?.value || '', reminder: $('#settingReminder')?.value || 0 });
      toast('Настройки сохранены');
    });
  }

  bind();
  return { render };
}
