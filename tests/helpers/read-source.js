import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export const readSource = (file) => fs.readFileSync(path.join(repo, file), 'utf8');
