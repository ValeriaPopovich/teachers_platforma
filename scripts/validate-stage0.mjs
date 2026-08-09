import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.resolve(here, '../index.html'), 'utf8');

const inlineScripts = html
  .split('<script>')
  .slice(1)
  .map((part) => part.split('</script>')[0]);

assert.equal(inlineScripts.length, 2, 'Expected the two current inline application scripts');
for (const [index, source] of inlineScripts.entries()) {
  assert.doesNotThrow(() => new Function(source), `Inline script ${index + 1} must parse`);
}

assert.ok(
  html.includes("const OWNER_KEY='tutorCabinet_owner_user_id'"),
  'Owner marker key is missing',
);
assert.ok(
  html.includes('window.tutorCloud.queueSave=queueCloudSave'),
  'Explicit cloud save API is missing',
);
assert.ok(
  html.includes('window.tutorCloud.flushSave=flushCloudSave'),
  'Cloud flush API is missing',
);
assert.ok(
  html.includes('window.tutorCloud?.queueSave?.(raw)'),
  'Local persistence does not notify cloud sync',
);
assert.ok(
  !html.includes('Storage.prototype.setItem'),
  'Storage.prototype.setItem override must not exist',
);

const renderBody = html.split('function renderAll(){')[1]?.split('}')[0] || '';
for (const mutation of [
  'pruneOldHistory',
  'sweepOrphans',
  'normalizePastLessons',
  'syncFutureGroupBilling',
]) {
  assert.ok(!renderBody.includes(mutation), `renderAll must not call ${mutation}`);
}

const ownershipSource = html.match(/function canUploadLocalState\([^)]*\)\{[^}]*\}/)?.[0];
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

console.log('Stage 0 validation: PASS');
