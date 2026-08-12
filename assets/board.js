const page = document.getElementById('page-board');
if (page) {
  const $ = (s) => page.querySelector(s);
  const canvas = $('#boardCanvas');
  const ctx = canvas.getContext('2d');
  const DB = 'tutorBoards_v1';
  const STORE = 'boards';
  const CANVAS_WIDTH = 1600;
  const CANVAS_HEIGHT = 900;
  const PDF_WIDTH = 842;
  const PDF_HEIGHT = 595;
  const PDF_RENDER_WIDTH = 2400;
  const PDF_RENDER_HEIGHT = 1696;
  const MAX_PAGES = 20;
  let db;
  let boards = [];
  let board = null;
  let pageIndex = 0;
  let tool = 'pen';
  let drawing = false;
  let start = null;
  let points = [];
  let preview = null;
  let saveTimer;
  let selectedIndex = -1;
  let selection = [];
  let marquee = null;
  let marqueeStart = null;
  let clipboard = [];
  let moving = false;
  let lastPoint = null;
  let zoom = 1;
  let canvasLogicalWidth = CANVAS_WIDTH;
  let canvasLogicalHeight = CANVAS_HEIGHT;
  let canvasScale = 1;
  let resizing = false;
  let resizeHandle = null;
  let resizeOrigin = null;
  let nudgeActive = false;
  let nudgeTimer = null;
  const imageCache = new Map();
  const brushSettings = {
    pen: { color: '#24232b', width: 4 },
    highlighter: { color: '#f4d84a', width: 16 },
    text: { color: '#24232b', width: 5 },
    line: { color: '#24232b', width: 4 },
    arrow: { color: '#24232b', width: 4 },
    rect: { color: '#24232b', width: 4 },
    ellipse: { color: '#24232b', width: 4 },
  };
  let dialogResolve = null;
  let brushOptionsTimer = null;
  let brushOptionsType = 'pen';
  let brushOptionsPinned = false;

  const uid = () => crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`;
  const currentPage = () => board?.pages?.[pageIndex];
  const openDb = () =>
    new Promise((resolve, reject) => {
      const request = indexedDB.open(DB, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: 'id' });
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  const transaction = (mode, action) =>
    new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const result = action(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(result?.result);
      tx.onerror = () => reject(tx.error);
    });
  const blankPage = (background = 'plain') => ({
    id: uid(),
    background,
    objects: [],
    undo: [],
    redo: [],
    canvasWidth: CANVAS_WIDTH,
    canvasHeight: CANVAS_HEIGHT,
  });
  const blankBoard = () => ({
    id: uid(),
    title: 'Новая доска',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    pages: [blankPage()],
  });
  const safeCopy = (value) =>
    JSON.parse(
      JSON.stringify(value, (key, item) => (['undo', 'redo'].includes(key) ? undefined : item)),
    );

  function setStatus(text) {
    $('#boardSaveStatus').textContent = text;
  }
  function closeBoardDialog(value) {
    $('#boardDialog').hidden = true;
    const resolve = dialogResolve;
    dialogResolve = null;
    resolve?.(value);
  }
  function showBoardDialog({ title, message, input = false, confirmText = 'Хорошо', value = '' }) {
    $('#boardDialogTitle').textContent = title;
    $('#boardDialogMessage').textContent = message;
    $('#boardDialogConfirm').textContent = confirmText;
    $('#boardDialogCancel').hidden = title === 'Сообщение';
    $('#boardDialogInput').hidden = !input;
    $('#boardDialogInput').value = value;
    $('#boardDialog').hidden = false;
    requestAnimationFrame(() => (input ? $('#boardDialogInput') : $('#boardDialogConfirm')).focus());
    return new Promise((resolve) => {
      dialogResolve = resolve;
    });
  }
  const boardConfirm = (message, confirmText = 'Удалить') =>
    showBoardDialog({ title: 'Подтвердите действие', message, confirmText });
  const boardAlert = (message) => showBoardDialog({ title: 'Сообщение', message });
  const boardPrompt = (message, value = '') =>
    showBoardDialog({ title: 'Введите текст', message, input: true, confirmText: 'Добавить', value });
  $('#boardDialogCancel').onclick = () => closeBoardDialog(false);
  $('#boardDialogConfirm').onclick = () =>
    closeBoardDialog(
      $('#boardDialogInput').hidden ? true : $('#boardDialogInput').value.trim() || false,
    );
  function syncFullscreenButton() {
    const active =
      document.fullscreenElement === page || page.classList.contains('board-fullscreen');
    $('#boardFullscreen').innerHTML = active
      ? '⛶ <span>Свернуть доску</span>'
      : '⛶ <span>На весь экран</span>';
    $('#boardFullscreen').setAttribute('aria-pressed', String(active));
  }
  function snapshot() {
    return JSON.stringify(currentPage().objects);
  }
  function remember() {
    const p = currentPage();
    p.undo ||= [];
    p.undo.push(snapshot());
    if (p.undo.length > 40) p.undo.shift();
    p.redo = [];
  }
  async function flushSave() {
    if (!board || !db) return;
    clearTimeout(saveTimer);
    saveTimer = null;
    board.updatedAt = Date.now();
    await transaction('readwrite', (store) => store.put(safeCopy(board)));
    const at = boards.findIndex((item) => item.id === board.id);
    if (at >= 0) boards[at] = safeCopy(board);
    else boards.unshift(safeCopy(board));
    renderBoardList();
    setStatus('Сохранено на устройстве');
  }
  function scheduleSave() {
    if (!board || !db) return;
    clearTimeout(saveTimer);
    setStatus('Сохраняем…');
    saveTimer = setTimeout(flushSave, 250);
  }
  // Досохраняем последнее изменение, если вкладку сворачивают/закрывают
  // раньше, чем сработает отложенное сохранение.
  const flushIfPending = () => {
    if (saveTimer) flushSave();
  };
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushIfPending();
  });
  window.addEventListener('pagehide', flushIfPending);
  function background(type) {
    ctx.setTransform(canvasScale, 0, 0, canvasScale, 0, 0);
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvasLogicalWidth, canvasLogicalHeight);
    drawBackgroundPattern(type, canvasLogicalWidth, canvasLogicalHeight);
  }
  function drawBackgroundPattern(type, width, height) {
    ctx.strokeStyle = type === 'grid' ? '#e7e5ea' : '#d5d2da';
    ctx.fillStyle = '#ccd6e5';
    ctx.lineWidth = 1;
    if (type === 'grid')
      for (let x = 0; x < width; x += 24) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
    if (type === 'grid')
      for (let y = 0; y < height; y += 24) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }
    if (type === 'dots')
      for (let y = 20; y < height; y += 40)
        for (let x = 20; x < width; x += 40) {
          ctx.beginPath();
          ctx.arc(x, y, 1.5, 0, Math.PI * 2);
          ctx.fill();
        }
  }
  function drawObject(o) {
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = o.color || '#222';
    ctx.fillStyle = o.color || '#222';
    ctx.lineWidth = o.width || 4;
    ctx.globalAlpha = o.alpha ?? 1;
    if (o.type === 'stroke') {
      ctx.beginPath();
      if (o.points.length === 1) {
        ctx.arc(o.points[0].x, o.points[0].y, Math.max(1, o.width / 2), 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.moveTo(o.points[0].x, o.points[0].y);
        for (let i = 1; i < o.points.length - 1; i++) {
          const midpoint = {
            x: (o.points[i].x + o.points[i + 1].x) / 2,
            y: (o.points[i].y + o.points[i + 1].y) / 2,
          };
          ctx.quadraticCurveTo(o.points[i].x, o.points[i].y, midpoint.x, midpoint.y);
        }
        const last = o.points[o.points.length - 1];
        ctx.lineTo(last.x, last.y);
        ctx.stroke();
      }
    }
    if (o.type === 'line' || o.type === 'arrow') {
      ctx.beginPath();
      ctx.moveTo(o.x1, o.y1);
      ctx.lineTo(o.x2, o.y2);
      ctx.stroke();
      if (o.type === 'arrow') {
        const a = Math.atan2(o.y2 - o.y1, o.x2 - o.x1),
          s = 16 + o.width;
        ctx.beginPath();
        ctx.moveTo(o.x2, o.y2);
        ctx.lineTo(o.x2 - s * Math.cos(a - 0.45), o.y2 - s * Math.sin(a - 0.45));
        ctx.moveTo(o.x2, o.y2);
        ctx.lineTo(o.x2 - s * Math.cos(a + 0.45), o.y2 - s * Math.sin(a + 0.45));
        ctx.stroke();
      }
    }
    if (o.type === 'rect') ctx.strokeRect(o.x, o.y, o.w, o.h);
    if (o.type === 'ellipse') {
      ctx.beginPath();
      ctx.ellipse(
        o.x + o.w / 2,
        o.y + o.h / 2,
        Math.abs(o.w / 2),
        Math.abs(o.h / 2),
        0,
        0,
        Math.PI * 2,
      );
      ctx.stroke();
    }
    if (o.type === 'text') {
      ctx.globalAlpha = 1;
      ctx.font = `${o.size || 32}px Manrope, sans-serif`;
      ctx.fillText(o.text, o.x, o.y);
    }
    if (o.type === 'image') {
      let img = imageCache.get(o.src);
      if (!img) {
        img = new Image();
        imageCache.set(o.src, img);
        img.onload = redraw;
        img.src = o.src;
      }
      if (img.complete && img.naturalWidth) ctx.drawImage(img, o.x, o.y, o.w, o.h);
    }
    ctx.restore();
  }
  function objectBounds(object) {
    if (object.type === 'stroke') {
      const xs = object.points.map((point) => point.x),
        ys = object.points.map((point) => point.y);
      return {
        x: Math.min(...xs),
        y: Math.min(...ys),
        w: Math.max(...xs) - Math.min(...xs),
        h: Math.max(...ys) - Math.min(...ys),
      };
    }
    if (object.type === 'line' || object.type === 'arrow') {
      return {
        x: Math.min(object.x1, object.x2),
        y: Math.min(object.y1, object.y2),
        w: Math.abs(object.x2 - object.x1),
        h: Math.abs(object.y2 - object.y1),
      };
    }
    if (object.type === 'text') {
      return {
        x: object.x,
        y: object.y - (object.size || 32),
        w: Math.max(30, object.text.length * (object.size || 32) * 0.62),
        h: (object.size || 32) * 1.25,
      };
    }
    return {
      x: Math.min(object.x, object.x + (object.w || 0)),
      y: Math.min(object.y, object.y + (object.h || 0)),
      w: Math.abs(object.w || 0),
      h: Math.abs(object.h || 0),
    };
  }
  function drawSelection() {
    ctx.save();
    ctx.globalAlpha = 1;
    ctx.lineWidth = 2;
    const padding = 10;
    const objects = selectedObjects();
    objects.forEach((object) => {
      const bounds = objectBounds(object);
      ctx.strokeStyle = '#2878e8';
      ctx.setLineDash([8, 6]);
      ctx.strokeRect(
        bounds.x - padding,
        bounds.y - padding,
        Math.max(20, bounds.w + padding * 2),
        Math.max(20, bounds.h + padding * 2),
      );
    });
    // Ручки масштабирования — только при одиночном выделении.
    const single = objects.length === 1 ? currentPage().objects[selectedIndex] : null;
    if (single && ['image', 'rect', 'ellipse', 'text'].includes(single.type)) {
      ctx.setLineDash([]);
      ctx.strokeStyle = '#2878e8';
      ctx.fillStyle = '#fff';
      const size = 12;
      selectionHandles(objectBounds(single)).forEach(({ x, y }) => {
        ctx.fillRect(x - size / 2, y - size / 2, size, size);
        ctx.strokeRect(x - size / 2, y - size / 2, size, size);
      });
    }
    // Рамка выделения области.
    if (marquee) {
      const x = Math.min(marquee.x, marquee.x + marquee.w);
      const y = Math.min(marquee.y, marquee.y + marquee.h);
      const w = Math.abs(marquee.w);
      const h = Math.abs(marquee.h);
      ctx.setLineDash([5, 4]);
      ctx.strokeStyle = '#2878e8';
      ctx.fillStyle = 'rgba(40, 120, 232, 0.08)';
      ctx.fillRect(x, y, w, h);
      ctx.strokeRect(x, y, w, h);
    }
    ctx.restore();
  }
  function selectionHandles(bounds) {
    const padding = 10;
    return [
      { name: 'nw', x: bounds.x - padding, y: bounds.y - padding },
      { name: 'ne', x: bounds.x + bounds.w + padding, y: bounds.y - padding },
      { name: 'sw', x: bounds.x - padding, y: bounds.y + bounds.h + padding },
      { name: 'se', x: bounds.x + bounds.w + padding, y: bounds.y + bounds.h + padding },
    ];
  }
  function hitResizeHandle(point) {
    const object = currentPage()?.objects?.[selectedIndex];
    if (!object || !['image', 'rect', 'ellipse', 'text'].includes(object.type)) return null;
    return (
      selectionHandles(objectBounds(object)).find(
        (handle) => Math.abs(point.x - handle.x) <= 18 && Math.abs(point.y - handle.y) <= 18,
      )?.name || null
    );
  }
  function redraw() {
    if (!currentPage()) return;
    background(currentPage().background);
    currentPage().objects.forEach(drawObject);
    if (preview) drawObject(preview);
    drawSelection();
  }
  function point(e) {
    const r = canvas.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(canvasLogicalWidth, ((e.clientX - r.left) * canvasLogicalWidth) / r.width)),
      y: Math.max(0, Math.min(canvasLogicalHeight, ((e.clientY - r.top) * canvasLogicalHeight) / r.height)),
    };
  }
  function setTool(next) {
    tool = next;
    page
      .querySelectorAll('[data-board-tool]')
      .forEach((button) => button.classList.toggle('active', button.dataset.boardTool === next));
  }
  function style(type) {
    const settings = brushSettings[type];
    return {
      type,
      color: settings?.color || $('#boardColor').value,
      width: settings?.width || +$('#boardWidth').value,
      alpha: type === 'highlighter' ? 0.25 : 1,
    };
  }
  function fitCanvasToWrap() {
    const wrap = $('#boardCanvasWrap');
    const boardPage = currentPage();
    if (!boardPage || !wrap.clientWidth || !wrap.clientHeight) return false;
    const targetWidth = Math.max(320, Math.round(wrap.clientWidth));
    const targetHeight = Math.max(240, Math.round(wrap.clientHeight));
    const nextScale = Math.min(2, window.devicePixelRatio || 1);
    if (
      canvasLogicalWidth === targetWidth &&
      canvasLogicalHeight === targetHeight &&
      canvasScale === nextScale
    )
      return false;
    boardPage.canvasWidth = targetWidth;
    boardPage.canvasHeight = targetHeight;
    boardPage.pixelRatio = nextScale;
    canvasLogicalWidth = targetWidth;
    canvasLogicalHeight = targetHeight;
    canvasScale = nextScale;
    canvas.width = Math.round(targetWidth * canvasScale);
    canvas.height = Math.round(targetHeight * canvasScale);
    fitCanvasDisplay();
    redraw();
    return true;
  }
  function fitCanvasDisplay() {
    const wrap = $('#boardCanvasWrap');
    if (!wrap.clientWidth || !wrap.clientHeight) return;
    canvas.style.width = `${Math.round(wrap.clientWidth * zoom)}px`;
    canvas.style.height = `${Math.round(wrap.clientHeight * zoom)}px`;
  }
  function hitTest(point) {
    const objects = currentPage().objects;
    for (let index = objects.length - 1; index >= 0; index--) {
      const bounds = objectBounds(objects[index]),
        padding = Math.max(14, objects[index].width || 0);
      if (
        point.x >= bounds.x - padding &&
        point.x <= bounds.x + Math.max(bounds.w, 8) + padding &&
        point.y >= bounds.y - padding &&
        point.y <= bounds.y + Math.max(bounds.h, 8) + padding
      )
        return index;
    }
    return -1;
  }
  function translateObject(object, dx, dy) {
    if (object.type === 'stroke') {
      object.points.forEach((point) => {
        point.x += dx;
        point.y += dy;
      });
    } else if (object.type === 'line' || object.type === 'arrow') {
      object.x1 += dx;
      object.y1 += dy;
      object.x2 += dx;
      object.y2 += dy;
    } else {
      object.x += dx;
      object.y += dy;
    }
  }
  function moveObjectInsideCanvas(object, dx, dy) {
    const bounds = objectBounds(object);
    const safeDx = Math.max(-bounds.x, Math.min(canvasLogicalWidth - bounds.x - bounds.w, dx));
    const safeDy = Math.max(-bounds.y, Math.min(canvasLogicalHeight - bounds.y - bounds.h, dy));
    translateObject(object, safeDx, safeDy);
  }
  function clearSelection() {
    selectedIndex = -1;
    selection = [];
  }
  function setSelection(indices) {
    selection = [...new Set(indices)].filter((i) => i >= 0).sort((a, b) => a - b);
    // Ручки масштабирования показываем только при одиночном выделении.
    selectedIndex = selection.length === 1 ? selection[0] : -1;
  }
  function selectedObjects() {
    const objects = currentPage()?.objects || [];
    return selection.map((i) => objects[i]).filter(Boolean);
  }
  function groupBounds(objects) {
    const bounds = objects.map(objectBounds);
    const x = Math.min(...bounds.map((b) => b.x));
    const y = Math.min(...bounds.map((b) => b.y));
    return {
      x,
      y,
      w: Math.max(...bounds.map((b) => b.x + b.w)) - x,
      h: Math.max(...bounds.map((b) => b.y + b.h)) - y,
    };
  }
  function objectsInRect(rect) {
    const objects = currentPage()?.objects || [];
    const x1 = Math.min(rect.x, rect.x + rect.w);
    const y1 = Math.min(rect.y, rect.y + rect.h);
    const x2 = Math.max(rect.x, rect.x + rect.w);
    const y2 = Math.max(rect.y, rect.y + rect.h);
    const found = [];
    objects.forEach((o, i) => {
      const b = objectBounds(o);
      if (b.x <= x2 && b.x + b.w >= x1 && b.y <= y2 && b.y + b.h >= y1) found.push(i);
    });
    return found;
  }
  function moveSelection(dx, dy) {
    const objects = selectedObjects();
    if (!objects.length) return;
    const gb = groupBounds(objects);
    const safeDx = Math.max(-gb.x, Math.min(canvasLogicalWidth - gb.x - gb.w, dx));
    const safeDy = Math.max(-gb.y, Math.min(canvasLogicalHeight - gb.y - gb.h, dy));
    objects.forEach((o) => translateObject(o, safeDx, safeDy));
  }
  function copySelection() {
    const objects = selectedObjects();
    if (!objects.length) return false;
    clipboard = objects.map((o) => JSON.parse(JSON.stringify(o)));
    setStatus(`Скопировано объектов: ${clipboard.length}`);
    return true;
  }
  function pasteClipboard() {
    if (!clipboard.length) return;
    remember();
    const objects = currentPage().objects;
    const startLen = objects.length;
    clipboard.forEach((o) => {
      const clone = JSON.parse(JSON.stringify(o));
      translateObject(clone, 24, 24);
      objects.push(clone);
    });
    setSelection(Array.from({ length: clipboard.length }, (_, k) => startLen + k));
    setTool('select');
    syncSelection();
    redraw();
    scheduleSave();
  }
  function syncSelection() {
    $('#boardDeleteObject').disabled = selection.length === 0;
    canvas.classList.toggle('is-selecting', tool === 'select' && !moving);
    canvas.classList.toggle('is-moving', moving);
    canvas.classList.toggle('is-resizing', resizing);
  }
  function deleteSelected() {
    if (!selection.length) return;
    remember();
    const objects = currentPage().objects;
    [...selection].sort((a, b) => b - a).forEach((i) => objects.splice(i, 1));
    clearSelection();
    syncSelection();
    redraw();
    scheduleSave();
  }
  function setZoom(next) {
    zoom = Math.max(0.5, Math.min(2.5, Math.round(next * 10) / 10));
    fitCanvasDisplay();
    $('#boardZoomReset').textContent = `${Math.round(zoom * 100)}%`;
  }
  function eraseAt(p) {
    const objects = currentPage().objects;
    for (let i = objects.length - 1; i >= 0; i--) {
      const o = objects[i];
      let hit;
      if (o.type === 'stroke') {
        hit = o.points.some((q) => Math.hypot(q.x - p.x, q.y - p.y) < 22);
      } else {
        // Единый хит-тест по рамке объекта — иначе картинки и текст
        // (у которых нет x1/x2) давали NaN и не стирались ластиком.
        const b = objectBounds(o);
        const pad = 20;
        hit =
          p.x > b.x - pad &&
          p.x < b.x + b.w + pad &&
          p.y > b.y - pad &&
          p.y < b.y + b.h + pad;
      }
      if (hit) {
        objects.splice(i, 1);
        return true;
      }
    }
    return false;
  }
  canvas.addEventListener('pointerdown', async (e) => {
    if (!board) return;
    canvas.setPointerCapture(e.pointerId);
    const p = point(e);
    if (tool === 'select') {
      const handle = hitResizeHandle(p);
      if (handle) {
        remember();
        drawing = true;
        resizing = true;
        resizeHandle = handle;
        resizeOrigin = {
          ...objectBounds(currentPage().objects[selectedIndex]),
          point: p,
          size: currentPage().objects[selectedIndex].size,
        };
        syncSelection();
        return;
      }
      const hit = hitTest(p);
      drawing = true;
      lastPoint = p;
      if (hit >= 0) {
        if (e.shiftKey) {
          // Shift — добавить/убрать объект из группы.
          setSelection(
            selection.includes(hit) ? selection.filter((i) => i !== hit) : [...selection, hit],
          );
        } else if (!selection.includes(hit)) {
          setSelection([hit]);
        }
        moving = !e.shiftKey && selection.includes(hit);
        if (moving) remember();
      } else {
        // Клик по пустому месту — тянем рамку выделения области.
        moving = false;
        marqueeStart = p;
        marquee = { x: p.x, y: p.y, w: 0, h: 0 };
        if (!e.shiftKey) clearSelection();
      }
      syncSelection();
      redraw();
      return;
    }
    if (tool === 'text') {
      const text = await boardPrompt('Напишите текст, который нужно добавить на доску.');
      if (text) {
        remember();
        currentPage().objects.push({
          ...style('text'),
          type: 'text',
          text,
          x: p.x,
          y: p.y,
          size: Math.max(22, brushSettings.text.width * 7),
        });
        // Сразу выделяем новый текст и переключаемся на «Выбор»,
        // чтобы его можно было тут же двигать и масштабировать (как картинки).
        setSelection([currentPage().objects.length - 1]);
        setTool('select');
        syncSelection();
        redraw();
        scheduleSave();
      }
      return;
    }
    remember();
    drawing = true;
    start = p;
    points = [p];
    if (tool === 'eraser') {
      eraseAt(p);
      redraw();
    }
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drawing) return;
    const p = point(e);
    if (tool === 'select' && resizing) {
      const object = currentPage().objects[selectedIndex];
      if (object.type === 'text') {
        // Масштабируем текст пропорционально: противоположный угол остаётся на месте.
        const b = resizeOrigin;
        const anchorX = resizeHandle.includes('w') ? b.x + b.w : b.x;
        const anchorY = resizeHandle.includes('n') ? b.y + b.h : b.y;
        const newW = Math.max(1, Math.abs(p.x - anchorX));
        const newH = Math.max(1, Math.abs(p.y - anchorY));
        let factor = Math.max(newW / b.w, newH / b.h);
        factor = Math.max(0.2, Math.min(8, factor));
        const newSize = Math.max(10, Math.round((b.size || 32) * factor));
        object.size = newSize;
        const scaled = newSize / (b.size || 32);
        const w = b.w * scaled;
        const h = b.h * scaled;
        const newLeft = resizeHandle.includes('w') ? b.x + b.w - w : b.x;
        const newTop = resizeHandle.includes('n') ? b.y + b.h - h : b.y;
        object.x = newLeft;
        object.y = newTop + newSize; // y текста — это базовая линия
        redraw();
        return;
      }
      const dx = p.x - resizeOrigin.point.x;
      const dy = p.y - resizeOrigin.point.y;
      let left = resizeOrigin.x;
      let right = resizeOrigin.x + resizeOrigin.w;
      let top = resizeOrigin.y;
      let bottom = resizeOrigin.y + resizeOrigin.h;
      if (resizeHandle.includes('w')) left = Math.max(0, Math.min(right - 24, left + dx));
      if (resizeHandle.includes('e'))
        right = Math.min(canvasLogicalWidth, Math.max(left + 24, right + dx));
      if (resizeHandle.includes('n')) top = Math.max(0, Math.min(bottom - 24, top + dy));
      if (resizeHandle.includes('s'))
        bottom = Math.min(canvasLogicalHeight, Math.max(top + 24, bottom + dy));
      object.x = left;
      object.y = top;
      object.w = right - left;
      object.h = bottom - top;
      redraw();
      return;
    }
    if (tool === 'select' && moving) {
      moveSelection(p.x - lastPoint.x, p.y - lastPoint.y);
      lastPoint = p;
      redraw();
      return;
    }
    if (tool === 'select' && marquee) {
      marquee.w = p.x - marqueeStart.x;
      marquee.h = p.y - marqueeStart.y;
      redraw();
      return;
    }
    if (tool === 'pen' || tool === 'highlighter') {
      const coalesced = e.getCoalescedEvents?.() || [];
      const events = coalesced.length ? coalesced : [e];
      events.forEach((item) => points.push(point(item)));
      preview = { ...style(tool), type: 'stroke', points };
    } else if (tool === 'eraser') {
      eraseAt(p);
    } else {
      const map = { line: 'line', arrow: 'arrow', rect: 'rect', ellipse: 'ellipse' };
      preview = {
        ...style(tool),
        type: map[tool],
        x1: start.x,
        y1: start.y,
        x2: p.x,
        y2: p.y,
        x: start.x,
        y: start.y,
        w: p.x - start.x,
        h: p.y - start.y,
      };
    }
    redraw();
  });
  const finish = () => {
    if (!drawing) return;
    drawing = false;
    if (tool === 'select') {
      if (marquee) {
        // Если рамку реально протянули — выделяем попавшие объекты.
        const dragged = Math.abs(marquee.w) > 3 || Math.abs(marquee.h) > 3;
        if (dragged) setSelection([...selection, ...objectsInRect(marquee)]);
        marquee = null;
        marqueeStart = null;
      }
      const wasMoving = moving;
      moving = false;
      resizing = false;
      resizeHandle = null;
      resizeOrigin = null;
      syncSelection();
      redraw();
      if (wasMoving && selection.length) scheduleSave();
      return;
    }
    if (preview) currentPage().objects.push(preview);
    preview = null;
    redraw();
    scheduleSave();
  };
  canvas.addEventListener('pointerup', finish);
  canvas.addEventListener('pointercancel', finish);
  async function editTextAt(index) {
    const object = index >= 0 ? currentPage().objects[index] : null;
    if (!object || object.type !== 'text') return;
    const text = await boardPrompt('Измените текст на доске.', object.text);
    if (typeof text === 'string' && text && text !== object.text) {
      remember();
      object.text = text;
      setSelection([index]);
      syncSelection();
      redraw();
      scheduleSave();
    }
  }
  canvas.addEventListener('dblclick', (e) => {
    if (!board) return;
    editTextAt(hitTest(point(e)));
  });
  // Двойной тап на тач-устройствах (где dblclick срабатывает нестабильно).
  let lastTap = { time: 0, index: -1 };
  canvas.addEventListener('pointerup', (e) => {
    if (!board || e.pointerType === 'mouse') return;
    const index = hitTest(point(e));
    const now = Date.now();
    if (index >= 0 && index === lastTap.index && now - lastTap.time < 350) {
      lastTap = { time: 0, index: -1 };
      editTextAt(index);
    } else {
      lastTap = { time: now, index };
    }
  });

  function renderBoardList() {
    if (!boards.length) {
      $('#boardList').innerHTML =
        '<div class="board-empty-state"><b>Досок пока нет</b><span>Создайте первую доску кнопкой сверху.</span></div>';
      return;
    }
    $('#boardList').innerHTML = boards
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .map(
        (item) =>
          `<article class="board-list-item ${item.id === board?.id ? 'active' : ''}"><button type="button" class="board-open-button" data-board-id="${item.id}"><b>${escapeHtml(item.title)}</b><small>${new Date(item.updatedAt).toLocaleDateString('ru-RU')} · ${item.pages.length} стр.</small></button><div class="board-card-actions"><button type="button" class="board-card-rename" data-rename-board="${item.id}" title="Переименовать доску" aria-label="Переименовать доску">Переименовать</button><button type="button" class="board-card-delete" data-delete-board="${item.id}" title="Удалить доску" aria-label="Удалить доску">🗑</button></div></article>`,
      )
      .join('');
  }
  function escapeHtml(v = '') {
    const d = document.createElement('div');
    d.textContent = v;
    return d.innerHTML;
  }
  function renderPages() {
    $('#boardPageTabs').textContent = `${pageIndex + 1} из ${board.pages.length}`;
    $('#boardPrevPage').disabled = pageIndex === 0;
    $('#boardNextPage').disabled = pageIndex === board.pages.length - 1;
    $('#boardDeletePage').disabled = board.pages.length === 1;
    page.querySelectorAll('[data-board-background]').forEach((button) =>
      button.classList.toggle('active', button.dataset.boardBackground === currentPage().background),
    );
    requestAnimationFrame(() => {
      fitCanvasToWrap();
      fitCanvasDisplay();
      redraw();
    });
  }
  function selectBoard(item) {
    board = safeCopy(item);
    board.pages.forEach((p) => {
      p.undo = [];
      p.redo = [];
    });
    pageIndex = 0;
    clearSelection();
    syncSelection();
    $('#boardTitle').value = board.title;
    renderBoardList();
    renderPages();
    setStatus('Сохранено на устройстве');
  }
  function openEditor() {
    page.classList.add('board-fullscreen');
    document.body.classList.add('board-editor-open');
    syncFullscreenButton();
    requestAnimationFrame(() => {
      fitCanvasDisplay();
      redraw();
    });
  }
  function closeEditor() {
    page.classList.remove('board-fullscreen');
    page.classList.remove('board-more-open');
    document.body.classList.remove('board-editor-open');
    syncFullscreenButton();
  }
  async function createBoard(openAfterCreate = true) {
    const item = blankBoard();
    boards.unshift(item);
    selectBoard(item);
    await transaction('readwrite', (store) => store.put(safeCopy(item)));
    if (openAfterCreate) openEditor();
  }
  async function deleteBoard(id) {
    const item = boards.find((candidate) => candidate.id === id);
    if (!item || !(await boardConfirm(`Удалить доску «${item.title}»?`))) return;
    await transaction('readwrite', (store) => store.delete(id));
    boards = boards.filter((candidate) => candidate.id !== id);
    if (board?.id === id) {
      if (boards.length) selectBoard(boards[0]);
      else {
        board = null;
        pageIndex = 0;
        clearSelection();
        renderBoardList();
        setStatus('Досок пока нет');
      }
    } else renderBoardList();
  }
  async function renameBoard(id) {
    const item = boards.find((candidate) => candidate.id === id);
    if (!item) return;
    const title = await boardPrompt('Новое название доски', item.title);
    if (typeof title !== 'string' || !title || title === item.title) return;
    item.title = title;
    item.updatedAt = Date.now();
    if (board?.id === id) {
      board.title = title;
      $('#boardTitle').value = title;
    }
    await transaction('readwrite', (store) => store.put(safeCopy(item)));
    renderBoardList();
    setStatus('Название обновлено');
  }
  async function exportBoards() {
    const all = (await transaction('readonly', (store) => store.getAll())) || [];
    if (!all.length) {
      boardAlert('Пока нечего сохранять — создайте хотя бы одну доску.');
      return;
    }
    const payload = { type: 'tutor-boards-backup', version: 1, exportedAt: Date.now(), boards: all };
    const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `doski-rezervnaya-kopiya-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    setStatus(`Резервная копия сохранена: досок ${all.length}`);
  }
  async function importBoards(file) {
    let data;
    try {
      data = JSON.parse(await file.text());
    } catch {
      boardAlert('Не удалось прочитать файл. Похоже, он повреждён или это не резервная копия досок.');
      return;
    }
    const list = Array.isArray(data) ? data : data?.boards;
    if (!Array.isArray(list)) {
      boardAlert('Это не файл резервной копии досок.');
      return;
    }
    let restored = 0;
    for (const item of list) {
      if (!item || !item.id || !Array.isArray(item.pages)) continue;
      const existing = boards.find((b) => b.id === item.id);
      // Не затираем более свежую версию доски, уже имеющуюся на устройстве.
      if (existing && (existing.updatedAt || 0) >= (item.updatedAt || 0)) continue;
      await transaction('readwrite', (store) => store.put(safeCopy(item)));
      restored++;
    }
    boards = (await transaction('readonly', (store) => store.getAll())) || [];
    renderBoardList();
    setStatus(
      restored ? `Восстановлено досок: ${restored}` : 'Новых или более свежих досок в копии не найдено',
    );
    if (restored) boardAlert(`Готово! Восстановлено досок: ${restored}.`);
  }
  async function init() {
    try {
      // Просим у браузера постоянное хранилище, чтобы доски реже вычищались
      // при нехватке места. Молча игнорируем, если API недоступно.
      navigator.storage?.persist?.().catch(() => {});
      db = await openDb();
      boards = (await transaction('readonly', (store) => store.getAll())) || [];
      if (boards.length) selectBoard(boards.sort((a, b) => b.updatedAt - a.updatedAt)[0]);
      else {
        board = null;
        renderBoardList();
        setStatus('Досок пока нет');
      }
    } catch (error) {
      setStatus('Не удалось открыть локальное хранилище');
      console.error('Board storage:', error);
    }
  }

  page.addEventListener('click', (e) => {
    const renameBoardId = e.target.closest('[data-rename-board]')?.dataset.renameBoard;
    if (renameBoardId) {
      renameBoard(renameBoardId);
      return;
    }
    const deleteBoardId = e.target.closest('[data-delete-board]')?.dataset.deleteBoard;
    if (deleteBoardId) {
      deleteBoard(deleteBoardId);
      return;
    }
    const t = e.target.closest('[data-board-tool]');
    if (t) {
      if (brushSettings[tool] && brushOptionsType === tool) {
        brushSettings[tool].color = $('#boardColor').value;
        brushSettings[tool].width = +$('#boardWidth').value;
      }
      tool = t.dataset.boardTool;
      const brush = brushSettings[tool];
      if (brush) showBrushOptions(tool, t);
      else $('#boardBrushOptions').hidden = true;
      if (brush) {
        $('#boardColor').value = brush.color;
        $('#boardWidth').value = brush.width;
      }
      $('#boardWidthLabel').textContent =
        tool === 'highlighter'
          ? 'Толщина маркера'
          : tool === 'pen'
            ? 'Толщина ручки'
            : 'Толщина линии';
      if (tool !== 'select') clearSelection();
      page
        .querySelectorAll('[data-board-tool]')
        .forEach((b) => b.classList.toggle('active', b === t));
      syncSelection();
      redraw();
    }
    const chosenBackground = e.target.closest('[data-board-background]')?.dataset.boardBackground;
    if (chosenBackground) {
      currentPage().background = chosenBackground;
      page.querySelectorAll('[data-board-background]').forEach((button) =>
        button.classList.toggle('active', button.dataset.boardBackground === chosenBackground),
      );
      redraw();
      scheduleSave();
    }
    const id = e.target.closest('[data-board-id]')?.dataset.boardId;
    if (id) {
      const item = boards.find((x) => x.id === id);
      if (item) {
        selectBoard(item);
        openEditor();
      }
    }
  });
  function showBrushOptions(type, button) {
    clearTimeout(brushOptionsTimer);
    const brush = brushSettings[type];
    if (!brush) return;
    brushOptionsType = type;
    const labels = {
      pen: 'Толщина ручки',
      highlighter: 'Толщина маркера',
      text: 'Размер текста',
      line: 'Толщина линии',
      arrow: 'Толщина стрелки',
      rect: 'Толщина рамки',
      ellipse: 'Толщина круга',
    };
    $('#boardWidthLabel').textContent = labels[type];
    $('#boardColor').value = brush.color;
    $('#boardWidth').value = brush.width;
    const workspaceRect = $('.board-workspace').getBoundingClientRect();
    const buttonRect = button.getBoundingClientRect();
    $('#boardBrushOptions').style.top = `${buttonRect.top - workspaceRect.top - 5}px`;
    $('#boardBrushOptions').style.left = `${buttonRect.right - workspaceRect.left + 12}px`;
    $('#boardBrushOptions').hidden = false;
  }
  function hideBrushOptionsSoon() {
    clearTimeout(brushOptionsTimer);
    if (brushOptionsPinned) return;
    brushOptionsTimer = setTimeout(() => {
      $('#boardBrushOptions').hidden = true;
    }, 650);
  }
  page
    .querySelectorAll(
      '[data-board-tool="pen"], [data-board-tool="highlighter"], [data-board-tool="text"], [data-board-tool="line"], [data-board-tool="arrow"], [data-board-tool="rect"], [data-board-tool="ellipse"]',
    )
    .forEach((button) => {
    button.addEventListener('mouseenter', () => showBrushOptions(button.dataset.boardTool, button));
    button.addEventListener('mouseleave', hideBrushOptionsSoon);
    });
  $('#boardBrushOptions').addEventListener('mouseenter', () => clearTimeout(brushOptionsTimer));
  $('#boardBrushOptions').addEventListener('mouseleave', hideBrushOptionsSoon);
  $('#boardBrushOptions').addEventListener('pointerdown', () => {
    brushOptionsPinned = true;
    clearTimeout(brushOptionsTimer);
  });
  $('#boardColor').addEventListener('change', () => {
    brushSettings[brushOptionsType].color = $('#boardColor').value;
    brushOptionsPinned = false;
    hideBrushOptionsSoon();
  });
  $('#boardWidth').addEventListener('change', () => {
    brushSettings[brushOptionsType].width = +$('#boardWidth').value;
    brushOptionsPinned = false;
    hideBrushOptionsSoon();
  });
  document.addEventListener('pointerdown', (event) => {
    if (!event.target.closest('#boardBrushOptions, [data-board-tool]')) {
      brushOptionsPinned = false;
      $('#boardBrushOptions').hidden = true;
    }
  });
  $('#boardTitle').addEventListener('input', (e) => {
    board.title = e.target.value.trim() || 'Без названия';
    scheduleSave();
  });
  $('#boardNew').onclick = () => createBoard(true);
  $('#boardExport').onclick = exportBoards;
  $('#boardImportBtn').onclick = () => $('#boardImport').click();
  $('#boardImport').onchange = (e) => {
    const file = e.target.files[0];
    if (file) importBoards(file);
    e.target.value = '';
  };
  $('#boardMore').onclick = (event) => {
    event.stopPropagation();
    const open = page.classList.toggle('board-more-open');
    $('#boardMore').setAttribute('aria-expanded', String(open));
  };
  document.addEventListener('click', (event) => {
    if (!event.target.closest('#boardMore, #boardMorePanel')) {
      page.classList.remove('board-more-open');
      $('#boardMore').setAttribute('aria-expanded', 'false');
    }
  });
  $('#boardFullscreen').onclick = closeEditor;
  $('#boardFullscreenExit').onclick = closeEditor;
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !$('#boardDialog').hidden) {
      closeBoardDialog(false);
      return;
    }
    if (event.key === 'Escape' && page.classList.contains('board-fullscreen')) {
      closeEditor();
    }
  });
  $('#boardAddPage').onclick = () => {
    if (board.pages.length >= MAX_PAGES) {
      $('#boardPageError').textContent = 'Можно добавить не больше 20 страниц.';
      return;
    }
    $('#boardPageError').textContent = '';
    board.pages.push(blankPage(currentPage().background));
    pageIndex = board.pages.length - 1;
    clearSelection();
    syncSelection();
    renderPages();
    scheduleSave();
  };
  $('#boardPrevPage').onclick = () => {
    $('#boardPageError').textContent = '';
    if (pageIndex > 0) {
      pageIndex--;
      clearSelection();
      syncSelection();
      renderPages();
    }
  };
  $('#boardNextPage').onclick = () => {
    $('#boardPageError').textContent = '';
    if (pageIndex < board.pages.length - 1) {
      pageIndex++;
      clearSelection();
      syncSelection();
      renderPages();
    }
  };
  $('#boardDeletePage').onclick = async () => {
    if (board.pages.length === 1)
      return boardAlert('В доске должна остаться хотя бы одна страница.');
    if (await boardConfirm('Удалить текущую страницу?')) {
      board.pages.splice(pageIndex, 1);
      $('#boardPageError').textContent = '';
      pageIndex = Math.min(pageIndex, board.pages.length - 1);
      renderPages();
      scheduleSave();
    }
  };
  $('#boardClear').onclick = async () => {
    if (
      await boardConfirm(
        'Очистить всю доску? Содержимое всех страниц будет удалено.',
        'Очистить',
      )
    ) {
      board.pages.forEach((item) => {
        item.objects = [];
        item.undo = [];
        item.redo = [];
      });
      clearSelection();
      syncSelection();
      redraw();
      scheduleSave();
    }
  };
  $('#boardUndo').onclick = () => {
    const p = currentPage();
    if (!p.undo.length) return;
    p.redo.push(snapshot());
    p.objects = JSON.parse(p.undo.pop());
    clearSelection();
    syncSelection();
    redraw();
    scheduleSave();
  };
  $('#boardRedo').onclick = () => {
    const p = currentPage();
    if (!p.redo.length) return;
    p.undo.push(snapshot());
    p.objects = JSON.parse(p.redo.pop());
    clearSelection();
    syncSelection();
    redraw();
    scheduleSave();
  };
  $('#boardDelete').onclick = async () => {
    await deleteBoard(board.id);
    closeEditor();
  };
  $('#boardDeleteObject').onclick = deleteSelected;
  document.addEventListener('keydown', (event) => {
    if (!page.classList.contains('active') || !board) return;
    if (event.target.closest('input, textarea, select, [contenteditable]')) return;
    if (!(event.ctrlKey || event.metaKey)) return;
    const key = event.key.toLowerCase();
    if (key === 'z' && !event.shiftKey) {
      event.preventDefault();
      $('#boardUndo').click();
    } else if ((key === 'z' && event.shiftKey) || key === 'y') {
      event.preventDefault();
      $('#boardRedo').click();
    } else if (key === 'c') {
      event.preventDefault();
      copySelection();
    } else if (key === 'v') {
      event.preventDefault();
      pasteClipboard();
    } else if (key === 'x') {
      event.preventDefault();
      if (copySelection()) deleteSelected();
    } else if (key === 'd') {
      event.preventDefault();
      if (copySelection()) pasteClipboard();
    } else if (key === 'a') {
      event.preventDefault();
      setTool('select');
      setSelection((currentPage()?.objects || []).map((_, i) => i));
      syncSelection();
      redraw();
    }
  });
  $('#boardImageButton').onclick = () => $('#boardImage').click();
  $('#boardZoomIn').onclick = () => setZoom(zoom + 0.2);
  $('#boardZoomOut').onclick = () => setZoom(zoom - 0.2);
  $('#boardZoomReset').onclick = () => setZoom(1);
  document.addEventListener('keydown', (event) => {
    if (
      selection.length === 0 ||
      !page.classList.contains('active') ||
      event.target.closest('input, textarea, select, [contenteditable]')
    )
      return;
    if (['Delete', 'Backspace'].includes(event.key)) {
      event.preventDefault();
      deleteSelected();
      return;
    }
    const nudges = {
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
    };
    if (nudges[event.key]) {
      event.preventDefault();
      const step = event.shiftKey ? 20 : 2;
      const [dx, dy] = nudges[event.key];
      // Одна запись в истории на всю серию сдвигов, а не на каждое нажатие.
      if (!nudgeActive) {
        remember();
        nudgeActive = true;
      }
      clearTimeout(nudgeTimer);
      nudgeTimer = setTimeout(() => (nudgeActive = false), 600);
      moveSelection(dx * step, dy * step);
      redraw();
      scheduleSave();
    }
  });

  const MAX_IMAGE_DIM = 1600;
  // Уменьшаем большие изображения перед хранением: иначе доска и её
  // резервная копия раздуваются и можно упереться в лимит IndexedDB.
  function compressImageSrc(img, originalSrc, mime) {
    const longest = Math.max(img.width, img.height);
    if (longest <= MAX_IMAGE_DIM) return originalSrc;
    const scale = MAX_IMAGE_DIM / longest;
    const off = document.createElement('canvas');
    off.width = Math.round(img.width * scale);
    off.height = Math.round(img.height * scale);
    const octx = off.getContext('2d');
    octx.imageSmoothingEnabled = true;
    octx.imageSmoothingQuality = 'high';
    octx.drawImage(img, 0, 0, off.width, off.height);
    // PNG/GIF/WebP могут быть с прозрачностью — сохраняем без потери альфы.
    const usePng = /png|gif|webp/i.test(mime || '');
    try {
      return off.toDataURL(usePng ? 'image/png' : 'image/jpeg', usePng ? undefined : 0.85);
    } catch {
      return originalSrc;
    }
  }
  function addImageFile(file) {
    if (!file.type.startsWith('image/')) {
      boardAlert('Выберите файл изображения: PNG, JPG, WebP или GIF.');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      boardAlert('Изображение должно быть меньше 8 МБ.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        remember();
        const src = compressImageSrc(img, reader.result, file.type);
        if (src === reader.result) {
          imageCache.set(src, img);
        } else {
          const stored = new Image();
          stored.onload = redraw;
          stored.src = src;
          imageCache.set(src, stored);
        }
        const maxW = canvasLogicalWidth * 0.75,
          maxH = canvasLogicalHeight * 0.75,
          scale = Math.min(maxW / img.width, maxH / img.height, 1);
        currentPage().objects.push({
          type: 'image',
          src,
          x: 60,
          y: 60,
          w: img.width * scale,
          h: img.height * scale,
        });
        setSelection([currentPage().objects.length - 1]);
        setTool('select');
        syncSelection();
        redraw();
        scheduleSave();
      };
      img.onerror = () => boardAlert('Не удалось прочитать изображение. Попробуйте другой файл.');
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  }

  $('#boardImage').onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    addImageFile(file);
    e.target.value = '';
  };

  window.addEventListener(
    'paste',
    (event) => {
      if (!page.classList.contains('active') || !board) return;
      const clipboard = event.clipboardData;
      const fileFromList = [...(clipboard?.files || [])].find((item) =>
        item.type.startsWith('image/'),
      );
      const imageItem = [...(clipboard?.items || [])].find((item) =>
        item.type.startsWith('image/'),
      );
      const file = fileFromList || imageItem?.getAsFile();
      if (!file) return;
      event.preventDefault();
      event.stopPropagation();
      addImageFile(file);
    },
    true,
  );

  function makePdf(images) {
    const enc = new TextEncoder();
    const chunks = [];
    const offsets = [0];
    let size = 0;
    const add = (v) => {
      const b = typeof v === 'string' ? enc.encode(v) : v;
      chunks.push(b);
      size += b.length;
    };
    add('%PDF-1.4\n%âãÏÓ\n');
    const objects = [];
    const pageIds = [];
    images.forEach((img, i) => {
      pageIds.push(3 + i * 3);
    });
    objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
    objects[2] = `<< /Type /Pages /Count ${images.length} /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] >>`;
    images.forEach((img, i) => {
      const pageId = 3 + i * 3,
        imageId = pageId + 1,
        contentId = pageId + 2,
        w = img.pageWidth,
        h = img.pageHeight,
        content = `q\n${w} 0 0 ${h} 0 0 cm\n/Im${i} Do\nQ\n`;
      objects[pageId] =
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] /Resources << /XObject << /Im${i} ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>`;
      objects[imageId] = {
        head: `<< /Type /XObject /Subtype /Image /Width ${img.width} /Height ${img.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${img.bytes.length} >>\nstream\n`,
        bytes: img.bytes,
      };
      objects[contentId] =
        `<< /Length ${enc.encode(content).length} >>\nstream\n${content}endstream`;
    });
    for (let i = 1; i < objects.length; i++) {
      offsets[i] = size;
      add(`${i} 0 obj\n`);
      const o = objects[i];
      if (typeof o === 'string') {
        add(o);
        add('\n');
      } else {
        add(o.head);
        add(o.bytes);
        add('\nendstream\n');
      }
      add('endobj\n');
    }
    const xref = size;
    add(`xref\n0 ${objects.length}\n0000000000 65535 f \n`);
    for (let i = 1; i < objects.length; i++)
      add(`${String(offsets[i]).padStart(10, '0')} 00000 n \n`);
    add(`trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
    return new Blob(chunks, { type: 'application/pdf' });
  }
  function preloadPageImages(boardPage) {
    return Promise.all(
      boardPage.objects
        .filter((object) => object.type === 'image')
        .map(
          (object) =>
            new Promise((resolve) => {
              const image = new Image();
              image.onload = () => {
                imageCache.set(object.src, image);
                resolve();
              };
              image.onerror = resolve;
              image.src = object.src;
            }),
        ),
    );
  }
  function renderPageForExport(boardPage) {
    const sourceWidth = boardPage.canvasWidth || CANVAS_WIDTH;
    const sourceHeight = boardPage.canvasHeight || CANVAS_HEIGHT;
    // Экспортируем ВЕСЬ лист целиком (даже если он заполнен частично),
    // расширяя область только если объекты выходят за границы холста.
    const allBounds = boardPage.objects.map(objectBounds);
    const minX = Math.min(0, ...allBounds.map((b) => b.x));
    const minY = Math.min(0, ...allBounds.map((b) => b.y));
    const maxX = Math.max(sourceWidth, ...allBounds.map((b) => b.x + b.w));
    const maxY = Math.max(sourceHeight, ...allBounds.map((b) => b.y + b.h));
    const contentWidth = Math.max(1, maxX - minX);
    const contentHeight = Math.max(1, maxY - minY);
    const padding = 0;

    // Размер листа пропорционален содержимому (в пунктах PDF),
    // длинная сторона фиксирована — так пропорции всегда верные.
    const LONG_EDGE = 842; // длинная сторона A4 (альбомная), в пунктах
    const aspect = contentWidth / contentHeight;
    let pageWidth, pageHeight;
    if (aspect >= 1) {
      pageWidth = LONG_EDGE;
      pageHeight = Math.round(LONG_EDGE / aspect);
    } else {
      pageHeight = LONG_EDGE;
      pageWidth = Math.round(LONG_EDGE * aspect);
    }

    // Адаптивное высокое разрешение: рендерим примерно под 300 DPI
    // (72 пункта = 1 дюйм), но не раздуваем растр сверх разумного.
    const renderScale = Math.min(
      4,
      Math.max(2, 300 / 72),
    );
    const renderWidth = Math.round(pageWidth * renderScale);
    const renderHeight = Math.round(pageHeight * renderScale);

    canvasLogicalWidth = pageWidth;
    canvasLogicalHeight = pageHeight;
    canvasScale = renderScale;
    canvas.width = renderWidth;
    canvas.height = renderHeight;
    if (ctx.imageSmoothingEnabled !== undefined) {
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
    }
    background('plain');

    // Вписываем содержимое в лист с полями, сохраняя пропорции.
    const contentScale = Math.min(
      (pageWidth - padding * 2) / contentWidth,
      (pageHeight - padding * 2) / contentHeight,
    );
    const offsetX = (pageWidth - contentWidth * contentScale) / 2 - minX * contentScale;
    const offsetY = (pageHeight - contentHeight * contentScale) / 2 - minY * contentScale;
    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.scale(contentScale, contentScale);
    drawBackgroundPattern(boardPage.background, maxX, maxY);
    boardPage.objects.forEach(drawObject);
    ctx.restore();
    return { width: canvas.width, height: canvas.height, pageWidth, pageHeight };
  }
  $('#boardPdf').onclick = async () => {
    if (!board) return;
    setStatus('Готовим PDF…');
    const original = pageIndex,
      originalSelection = [...selection],
      images = [];
    clearSelection();
    // Единый формат листа для всех страниц: непосещённые пустые страницы
    // иначе остаются 1600×900 и выпадают другим форматом в PDF.
    const refWidth = currentPage()?.canvasWidth || CANVAS_WIDTH;
    const refHeight = currentPage()?.canvasHeight || CANVAS_HEIGHT;
    const originalSizes = board.pages.map((p) => ({ w: p.canvasWidth, h: p.canvasHeight }));
    board.pages.forEach((p) => {
      p.canvasWidth = refWidth;
      p.canvasHeight = refHeight;
    });
    for (let i = 0; i < board.pages.length; i++) {
      pageIndex = i;
      await preloadPageImages(board.pages[i]);
      const resolution = renderPageForExport(board.pages[i]);
      const url = canvas.toDataURL('image/jpeg', 0.98);
      const raw = atob(url.split(',')[1]);
      const bytes = new Uint8Array(raw.length);
      for (let j = 0; j < raw.length; j++) bytes[j] = raw.charCodeAt(j);
      images.push({ bytes, ...resolution });
    }
    board.pages.forEach((p, i) => {
      p.canvasWidth = originalSizes[i].w;
      p.canvasHeight = originalSizes[i].h;
    });
    pageIndex = original;
    setSelection(originalSelection);
    renderPages();
    const url = URL.createObjectURL(makePdf(images));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(board.title || 'doska').replace(/[^а-яёa-z0-9_-]+/gi, '_')}.pdf`;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    setStatus('PDF скачан');
  };
  new ResizeObserver(() => {
    if (page.classList.contains('active')) {
      fitCanvasToWrap();
      fitCanvasDisplay();
      redraw();
    }
  }).observe($('#boardCanvasWrap'));
  init();
}
