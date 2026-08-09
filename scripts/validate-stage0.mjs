// Проверяет инварианты Этапа 0 против index.html + внешних scripts, на которые он ссылается.
// После Этапа 2 логика вынесена в assets/auth.js и assets/app.js — читаем и их тоже.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'acorn';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..');
const html = fs.readFileSync(path.join(repo, 'index.html'), 'utf8');

// Собираем весь application-JS: inline <script>…</script> без src + локальные <script src="…">
const inlineScripts = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(
  (m) => m[1],
);
const externalSources = [...html.matchAll(/<script[^>]*\bsrc=["']([^"']+)["'][^>]*>/g)]
  .map((m) => m[1])
  .filter((src) => !/^https?:/i.test(src));

const externalScripts = externalSources.map((src) => fs.readFileSync(path.join(repo, src), 'utf8'));
const allScripts = [...inlineScripts, ...externalScripts];
const combined = allScripts.join('\n\n/* --- next script --- */\n\n');

// Каждый script должен парситься.
for (const [index, source] of allScripts.entries()) {
  assert.doesNotThrow(
    () => parse(source, { ecmaVersion: 'latest', sourceType: 'module' }),
    `Script ${index + 1} must parse`,
  );
}

// Auth перед app, порядок сохранён.
const authIndex = externalSources.findIndex((s) => /auth\.js$/.test(s));
const appIndex = externalSources.findIndex((s) => /app\.js$/.test(s));
if (authIndex !== -1 && appIndex !== -1) {
  assert.ok(authIndex < appIndex, 'auth.js must load before app.js');
}

// Инварианты Этапа 0 (§5 спеки). Устойчиво к форматированию (Prettier может добавить пробелы).
function has(pattern, msg) {
  assert.ok(pattern.test(combined), msg);
}
has(/const\s+OWNER_KEY\s*=\s*['"]tutorCabinet_owner_user_id['"]/, 'Owner marker key is missing');
has(/window\.tutorCloud\.queueSave\s*=\s*queueCloudSave/, 'Explicit cloud save API is missing');
has(/window\.tutorCloud\.flushSave\s*=\s*flushCloudSave/, 'Cloud flush API is missing');
has(
  /window\.tutorCloud\?\.queueSave\?\.\(\s*raw\s*\)/,
  'Local persistence does not notify cloud sync',
);
assert.ok(
  !combined.includes('Storage.prototype.setItem'),
  'Storage.prototype.setItem override must not exist',
);

// renderAll не должен вызывать destructive/mutating операции. Балансируем скобки,
// чтобы forma-agnostic-но извлечь тело функции.
function extractFn(src, name) {
  const start = src.indexOf(`function ${name}(`);
  if (start === -1) return '';
  const open = src.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') {
      depth--;
      if (depth === 0) return src.slice(open + 1, i);
    }
  }
  return '';
}
const renderBody = extractFn(combined, 'renderAll');
assert.ok(renderBody, 'renderAll function is missing');
for (const mutation of [
  'pruneOldHistory',
  'sweepOrphans',
  'normalizePastLessons',
  'syncFutureGroupBilling',
]) {
  assert.ok(!renderBody.includes(mutation), `renderAll must not call ${mutation}`);
}

// Guard-функция и её таблица истинности. Извлекаем через brace-balance —
// prettier может разложить однострочник на несколько строк.
const guardBody = extractFn(combined, 'canUploadLocalState');
assert.ok(guardBody, 'Ownership guard function is missing');
const canUploadLocalState = new Function(
  `function canUploadLocalState(owner, userId, allowUnowned){${guardBody}}; return canUploadLocalState`,
)();

assert.equal(canUploadLocalState('user-a', 'user-a', false), true, 'Matching owner must upload');
assert.equal(
  canUploadLocalState('', 'user-a', true),
  true,
  'Unowned legacy state may bootstrap an empty cloud',
);
assert.equal(
  canUploadLocalState('', 'user-a', false),
  false,
  'Unowned state must not upload outside bootstrap',
);
assert.equal(
  canUploadLocalState('user-b', 'user-a', true),
  false,
  'Owner mismatch must block upload',
);

// pushCloud при непарсимом raw возвращает false и показывает ошибку (хвост Этапа 0).
const pushCloudBody = extractFn(combined, 'pushCloud');
assert.ok(pushCloudBody, 'pushCloud function is missing');
assert.ok(
  /catch[\s\S]*?showSync\(\s*['"]Не удалось сохранить['"]\s*,\s*['"]error['"]\s*\)[\s\S]*?return\s+false/.test(
    pushCloudBody,
  ),
  'pushCloud must return false and surface error on JSON parse failure',
);

console.log('Stage 0 validation: PASS');
