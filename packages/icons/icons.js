export const ICONS = Object.freeze({
  calendar: [
    { tag: 'path', attrs: { d: 'M7 3v3M17 3v3M4.5 9h15' } },
    {
      tag: 'path',
      attrs: { d: 'M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z' },
    },
  ],
  clock: [
    { tag: 'circle', attrs: { cx: 12, cy: 12, r: 8 } },
    { tag: 'path', attrs: { d: 'M12 7.5V12l3 2' } },
  ],
  'user-plus': [
    { tag: 'circle', attrs: { cx: 9, cy: 8, r: 3 } },
    { tag: 'path', attrs: { d: 'M3.5 19c0-3 2.4-5 5.5-5s5.5 2 5.5 5M18 8v6M15 11h6' } },
  ],
  video: [
    { tag: 'rect', attrs: { x: 3.5, y: 6.5, width: 11.5, height: 11, rx: 2 } },
    { tag: 'path', attrs: { d: 'm15 10 5-2.5v9L15 14' } },
  ],
  search: [
    { tag: 'circle', attrs: { cx: 11, cy: 11, r: 6.5 } },
    { tag: 'path', attrs: { d: 'm16 16 4 4' } },
  ],
  card: [
    { tag: 'rect', attrs: { x: 3.5, y: 6, width: 17, height: 12, rx: 2 } },
    { tag: 'path', attrs: { d: 'M3.5 10h17' } },
  ],
  check: [
    { tag: 'circle', attrs: { cx: 12, cy: 12, r: 8 } },
    { tag: 'path', attrs: { d: 'm8.5 12 2.2 2.2 4.8-5' } },
  ],
});
