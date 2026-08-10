export function localDay(value = new Date()) {
  const date = new Date(value);
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function formatDate(value, full = false) {
  if (!value) return '—';
  return new Date(value).toLocaleString(
    'ru-RU',
    full
      ? { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }
      : { day: '2-digit', month: '2-digit', year: 'numeric' },
  );
}

export function formatTime(value) {
  return new Date(value).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

export function money(value) {
  return `${new Intl.NumberFormat('ru-RU').format(Number(value) || 0)} ₽`;
}

export function initials(name = '') {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toUpperCase() || '?'
  );
}

export function monthName(date = new Date()) {
  return date
    .toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })
    .replace(/^./, (x) => x.toUpperCase());
}

export function lessonCountWord(count) {
  const mod100 = count % 100;
  const mod10 = count % 10;
  if (mod100 >= 11 && mod100 <= 14) return 'занятий';
  if (mod10 === 1) return 'занятие';
  if (mod10 >= 2 && mod10 <= 4) return 'занятия';
  return 'занятий';
}
