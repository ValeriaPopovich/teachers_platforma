import { readFile, writeFile } from 'node:fs/promises';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import * as sass from 'sass';

const root = new URL('../', import.meta.url);
const entries = [['styles/entries/main.scss', 'assets/styles.css']];

const checkOnly = process.argv.includes('--check');
const stale = [];

for (const [source, target] of entries) {
  const result = sass.compile(fileURLToPath(new URL(source, root)), {
    style: 'expanded',
    sourceMap: false,
  });
  const css = `${result.css.trimEnd()}\n`;
  const targetUrl = new URL(target, root);

  if (checkOnly) {
    const current = await readFile(targetUrl, 'utf8').catch(() => '');
    if (current !== css) stale.push(target);
  } else {
    await writeFile(targetUrl, css);
  }
}

if (stale.length > 0) {
  console.error(`Compiled CSS is stale:\n${stale.map((file) => `- ${file}`).join('\n')}`);
  console.error('Run npm run styles:build and commit the generated CSS.');
  process.exitCode = 1;
} else {
  console.log(checkOnly ? 'Compiled CSS is up to date.' : 'SCSS compiled successfully.');
}
