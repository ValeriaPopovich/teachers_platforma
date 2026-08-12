import { ICONS } from './icons.js';

function attributesMarkup(attributes) {
  return Object.entries(attributes)
    .map(([name, value]) => `${name}="${String(value)}"`)
    .join(' ');
}

export function iconMarkup(name, className = 'ui-icon') {
  const shapes = ICONS[name];
  if (!shapes) return '';
  const content = shapes
    .map(({ tag, attrs }) => `<${tag} ${attributesMarkup(attrs)}></${tag}>`)
    .join('');
  return `<svg class="${className}" viewBox="0 0 24 24" aria-hidden="true">${content}</svg>`;
}
