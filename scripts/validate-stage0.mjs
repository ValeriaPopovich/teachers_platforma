// Проверяет инварианты Этапа 0 против index.html + внешних scripts, на которые он ссылается.
// После Этапа 2 логика вынесена в assets/auth.js и assets/app.js — читаем и их тоже.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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
  assert.doesNotThrow(() => new Function(source), `Script ${index + 1} must parse`);
}

// Auth перед app, порядок сохранён.
const authIndex = externalSources.findIndex((s) => /auth\.js$/.test(s));
const appIndex = externalSources.findIndex((s) => /app\.js$/.test(s));
if (authIndex !== -1 && appIndex !== -1) {
  assert.ok(authIndex < appIndex, 'auth.js must load before app.js');
}

// Инварианты Этапа 0 (§5 спеки).
assert.ok(
  combined.includes("const OWNER_KEY='tutorCabinet_owner_user_id'"),
  'Owner marker key is missing',
);
assert.ok(
  combined.includes('window.tutorCloud.queueSave=queueCloudSave'),
  'Explicit cloud save API is missing',
);
assert.ok(
  combined.includes('window.tutorCloud.flushSave=flushCloudSave'),
  'Cloud flush API is missing',
);
assert.ok(
  combined.includes('window.tutorCloud?.queueSave?.(raw)'),
  'Local persistence does not notify cloud sync',
);
assert.ok(
  !combined.includes('Storage.prototype.setItem'),
  'Storage.prototype.setItem override must not exist',
);

// renderAll не должен вызывать destructive/mutating операции.
const renderBody = combined.split('function renderAll(){')[1]?.split('}')[0] || '';
for (const mutation of [
  'pruneOldHistory',
  'sweepOrphans',
  'normalizePastLessons',
  'syncFutureGroupBilling',
]) {
  assert.ok(!renderBody.includes(mutation), `renderAll must not call ${mutation}`);
}

// Guard-функция и её таблица истинности.
const ownershipSource = combined.match(/function canUploadLocalState\([^)]*\)\{[^}]*\}/)?.[0];
assert.ok(ownershipSource, 'Ownership guard function is missing');
const canUploadLocalState = new Function(`${ownershipSource}; return canUploadLocalState`)();

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
const pushCloudMatch = combined.match(/async function pushCloud\([\s\S]*?\n {2}\}/);
assert.ok(pushCloudMatch, 'pushCloud function is missing');
assert.ok(
  /catch\{showSync\('Не удалось сохранить','error'\);return false\}/.test(pushCloudMatch[0]),
  'pushCloud must return false and surface error on JSON parse failure',
);

console.log('Stage 0 validation: PASS');
