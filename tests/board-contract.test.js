import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const html = read('index.html');
const board = read('assets/board.js');
const app = read('assets/app.js');

describe('standalone local board', () => {
  it('is connected as a separate page and module', () => {
    expect(html).toContain('data-page="board"');
    expect(html).toContain('id="page-board"');
    expect(html).toContain('src="assets/board.js"');
    expect(html).toContain('href="assets/board.css"');
  });

  it('uses an isolated IndexedDB store and never enters platform persistence', () => {
    expect(board).toContain("const DB = 'tutorBoards_v1'");
    expect(board).toContain('indexedDB.open(DB, 1)');
    expect(board).not.toContain('localStorage');
    expect(board).not.toContain('tutorCloud');
    expect(board).not.toContain('supabase');
    expect(app).not.toContain('tutorBoards_v1');
  });

  it('supports the promised drawing and page tools', () => {
    for (const tool of [
      'select',
      'pen',
      'highlighter',
      'eraser',
      'text',
      'line',
      'arrow',
      'rect',
      'ellipse',
    ]) {
      expect(html).toContain(`data-board-tool="${tool}"`);
    }
    expect(board).toContain("$('#boardAddPage').onclick");
    expect(board).toContain('blankPage(currentPage().background)');
    expect(board).toContain('ctx.quadraticCurveTo');
    expect(board).toContain('getCoalescedEvents');
    expect(board).toContain("text: { color: '#24232b', width: 5 }");
    expect(board).toContain("arrow: { color: '#24232b', width: 4 }");
    expect(board).toContain('const MAX_PAGES = 20');
    expect(board).toContain('Можно добавить не больше 20 страниц.');
    expect(html).toContain('id="boardPageError"');
    expect(board).toContain("$('#boardUndo').onclick");
    expect(board).toContain("$('#boardRedo').onclick");
    expect(board).toContain("$('#boardImage').onchange");
    expect(html).toContain('id="boardImageButton"');
    expect(board).toContain("$('#boardImageButton').onclick = () => $('#boardImage').click()");
    expect(board).toContain("window.addEventListener(\n    'paste'");
    expect(board).toContain('clipboard?.files');
    expect(board).toContain("item.type.startsWith('image/')");
    expect(board).toContain('addImageFile(file)');
  });

  it('supports selecting, moving, deleting and zooming objects', () => {
    expect(html).toContain('id="boardDeleteObject"');
    expect(html).toContain('id="boardZoomIn"');
    expect(html).toContain('id="boardZoomOut"');
    expect(board).toContain('function hitTest(point)');
    expect(board).toContain('function translateObject(object, dx, dy)');
    expect(board).toContain('function moveObjectInsideCanvas(object, dx, dy)');
    expect(board).toContain('function deleteSelected()');
    expect(board).toContain("['Delete', 'Backspace'].includes(event.key)");
    expect(board).toContain('function setZoom(next)');
    expect(board).toContain('const imageCache = new Map()');
    expect(board).toContain('function hitResizeHandle(point)');
    expect(board).toContain("resizeHandle.includes('e')");
    // Текст можно двигать, масштабировать и редактировать двойным кликом.
    expect(board).toContain("['image', 'rect', 'ellipse', 'text'].includes(object.type)");
    expect(board).toContain("if (object.type === 'text')");
    expect(board).toContain("canvas.addEventListener('dblclick'");
    expect(board).toContain('async function editTextAt(index)');
    expect(board).toContain('function setTool(next)');
    expect(board).toContain('const nudges = {');
    // Ластик стирает и текст, и картинки (через общий objectBounds).
    expect(board).toContain('const b = objectBounds(o);');
    // Сдвиги стрелками — одна запись в истории на серию.
    expect(board).toContain('if (!nudgeActive) {');
    expect(board).toContain('function fitCanvasToWrap()');
    expect(board).toContain('new ResizeObserver');
    expect(board).toContain('function fitCanvasDisplay()');
    expect(board).toContain('window.devicePixelRatio');
    expect(board).toContain('boardPage.pixelRatio = nextScale');
    expect(board).toContain('Math.round(wrap.clientWidth)');
    expect(board).toContain('Math.round(wrap.clientHeight)');
  });

  it('exports every page into a self-contained PDF', () => {
    expect(board).toContain('function makePdf(images)');
    expect(board).toContain("new Blob(chunks, { type: 'application/pdf' })");
    expect(board).toContain('for (let i = 0; i < board.pages.length; i++)');
    expect(board).toContain('preloadPageImages(board.pages[i])');
    expect(board).toContain('function renderPageForExport(boardPage)');
    expect(board).toContain('w = img.pageWidth');
    expect(board).toContain('h = img.pageHeight');
    expect(board).toContain('const contentScale = Math.min');
    // Экспорт адаптивный: лист подгоняется под содержимое, разрешение — под DPI.
    expect(board).toContain('canvasScale = renderScale');
    expect(board).toContain("canvas.toDataURL('image/jpeg', 0.98)");
  });

  it('opens the standalone editor full-screen and exits with its button or Escape', () => {
    expect(html).toContain('id="boardFullscreen"');
    expect(board).toContain("page.classList.add('board-fullscreen')");
    expect(html).toContain('id="boardFullscreenExit"');
    expect(board).toContain("$('#boardFullscreenExit').onclick = closeEditor");
    expect(board).toContain("event.key === 'Escape'");
  });

  it('keeps the library separate and opens boards in a dedicated editor', () => {
    expect(html).toContain('class="board-library-screen"');
    expect(html).toContain('id="boardNew"');
    expect(board).toContain('function openEditor()');
    expect(board).toContain('function closeEditor()');
    expect(board).toContain('function deleteBoard(id)');
    expect(board).toContain("setStatus('Досок пока нет')");
    expect(html).toContain('id="boardList"');
    expect(html).toContain('id="boardDialog"');
    expect(board).not.toMatch(/\bconfirm\(/);
    expect(board).not.toMatch(/\balert\(/);
    expect(board).not.toMatch(/\bprompt\(/);
    expect(html).toContain('id="boardMore"');
    expect(board).toContain("page.classList.toggle('board-more-open')");
    // Явно предупреждаем, что доски привязаны к устройству и браузеру.
    expect(html).toContain('class="board-device-note"');
    expect(html).toContain('только на этом устройстве');
  });

  it('lets you rename boards and back them up', () => {
    expect(html).toContain('data-rename-board');
    expect(board).toContain('async function renameBoard(id)');
    expect(html).toContain('id="boardExport"');
    expect(html).toContain('id="boardImport"');
    expect(board).toContain('async function exportBoards()');
    expect(board).toContain('async function importBoards(file)');
    expect(board).toContain("type: 'tutor-boards-backup'");
  });

  it('supports area selection, group actions and keyboard shortcuts', () => {
    expect(board).toContain('function objectsInRect(rect)');
    expect(board).toContain('function moveSelection(dx, dy)');
    expect(board).toContain('function copySelection()');
    expect(board).toContain('function pasteClipboard()');
    expect(board).toContain('function setSelection(indices)');
    expect(board).toContain('marquee = { x: p.x, y: p.y, w: 0, h: 0 }');
    expect(board).toContain('if (!(event.ctrlKey || event.metaKey)) return;');
    // Ctrl/Cmd+Z / Shift+Z / Y / C / V / X / A / D.
    expect(board).toContain("$('#boardUndo').click()");
    expect(board).toContain("$('#boardRedo').click()");
    // Инструмент «Ручка» — текстовая кнопка вместо иконки карандаша.
    expect(html).toContain('board-tool--text');
    expect(html).toContain('board-tool-word');
  });

  it('protects board data: image compression, flush-on-hide, persistent storage', () => {
    expect(board).toContain('function compressImageSrc(img, originalSrc, mime)');
    expect(board).toContain('const MAX_IMAGE_DIM = 1600');
    expect(board).toContain('async function flushSave()');
    expect(board).toContain("document.addEventListener('visibilitychange'");
    expect(board).toContain("window.addEventListener('pagehide', flushIfPending)");
    expect(board).toContain('navigator.storage?.persist?.()');
  });
});
