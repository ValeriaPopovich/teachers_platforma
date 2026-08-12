export const NAVIGATION_PAGES = Object.freeze([
  {
    name: 'dashboard',
    label: 'Главная',
    title: 'Главная',
    icon: '<path d="M4 10.5 12 4l8 6.5"/><path d="M6 9.5V20h12V9.5"/>',
  },
  {
    name: 'schedule',
    label: 'Расписание',
    title: 'Расписание',
    icon: '<rect x="3.5" y="5" width="17" height="15" rx="2.2"/><path d="M3.5 9.5h17M8 3.5v3.5M16 3.5v3.5"/>',
  },
  {
    name: 'students',
    label: 'Ученики',
    title: 'Ученики и группы',
    icon: '<circle cx="9.2" cy="8.5" r="3"/><path d="M3.6 19.5c0-3.1 2.5-5.2 5.6-5.2s5.6 2.1 5.6 5.2"/><path d="M16.2 6a3 3 0 0 1 .2 5.7M17.8 19.5c0-2.4-.8-4.2-2.3-5.2"/>',
  },
  {
    name: 'payments',
    label: 'Оплаты',
    title: 'Оплаты',
    icon: '<rect x="3.5" y="6" width="17" height="12.5" rx="2.4"/><path d="M3.5 10.5h17"/><circle cx="16.3" cy="14.4" r="1.15"/>',
  },
  {
    name: 'reports',
    label: 'Отчёты',
    title: 'Отчёты родителям',
    icon: '<path d="M6.5 3.5h6.5l4.5 4.5v10.5a2 2 0 0 1-2 2h-9a2 2 0 0 1-2-2v-13a2 2 0 0 1 2-2z"/><path d="M13 3.5V8h4.5"/><path d="M8.5 13h6M8.5 16.5h4.5"/>',
  },
  {
    name: 'board',
    label: 'Доска',
    title: 'Доска',
    icon: '<rect x="3.5" y="4" width="17" height="14" rx="2"/><path d="m8 20 1.5-2h5L16 20M8 9h8M8 13h5"/>',
  },
  {
    name: 'settings',
    label: 'Профиль',
    title: 'Профиль',
    secondary: true,
    icon: '<circle cx="12" cy="12" r="3.1"/><path d="M12 2.6v2.4M12 19v2.4M21.4 12H19M5 12H2.6M18.6 5.4l-1.7 1.7M7.1 16.9l-1.7 1.7M18.6 18.6l-1.7-1.7M7.1 7.1 5.4 5.4"/>',
  },
]);
