export const ICONS = Object.freeze({
  bell: [
    {
      tag: 'path',
      attrs: {
        d: 'M6.5 9.5a5.5 5.5 0 0 1 11 0c0 5 2 5.5 2 5.5h-15s2-.5 2-5.5ZM10 18h4',
      },
    },
  ],
  bolt: [{ tag: 'path', attrs: { d: 'm13.5 2.5-7 11h5l-1 8 7-11h-5z' } }],
  plus: [{ tag: 'path', attrs: { d: 'M12 5v14M5 12h14' } }],
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
  trash: [
    { tag: 'path', attrs: { d: 'M4.5 7h15M9 3.5h6l1 3.5H8zM7 7l1 13h8l1-13M10 10.5v6M14 10.5v6' } },
  ],
  attendance: [
    {
      tag: 'path',
      attrs: {
        d: 'M8.5 12.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7-1a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM3.5 18.5c0-3 2.2-5 5-5s5 2 5 5M13.5 14.5c2.5 0 4 1.6 4 4',
      },
    },
  ],
  homework: [{ tag: 'path', attrs: { d: 'M5 18.5V14m4 4.5V9m4 9.5V5.5m4 13V11' } }],
  tests: [
    { tag: 'path', attrs: { d: 'M7 3.5h7l4 4v13H7z' } },
    { tag: 'path', attrs: { d: 'M14 3.5v4h4M10 12h5m-5 3h5' } },
  ],
  target: [
    { tag: 'circle', attrs: { cx: 12, cy: 12, r: 8 } },
    { tag: 'circle', attrs: { cx: 12, cy: 12, r: 4 } },
    { tag: 'path', attrs: { d: 'M12 12 20 4' } },
  ],
  note: [
    { tag: 'path', attrs: { d: 'M5 4.5h14v15H5z' } },
    { tag: 'path', attrs: { d: 'M8.5 9h7m-7 4h5' } },
  ],
  info: [
    { tag: 'circle', attrs: { cx: 12, cy: 12, r: 8.5 } },
    { tag: 'path', attrs: { d: 'M12 10.5v5M12 7.5h.01' } },
  ],
  warning: [
    { tag: 'path', attrs: { d: 'M12 3.5 21 19H3L12 3.5Z' } },
    { tag: 'path', attrs: { d: 'M12 9v4.5M12 17h.01' } },
  ],
  user: [
    { tag: 'circle', attrs: { cx: 12, cy: 8, r: 3 } },
    { tag: 'path', attrs: { d: 'M6.5 19c0-3.3 2.2-5.5 5.5-5.5s5.5 2.2 5.5 5.5' } },
  ],
});
