import { readFile, writeFile } from 'node:fs/promises';
import postcss from 'postcss';
import scss from 'postcss-scss';

const features = new Map([
  ['styles/features/_payments.scss', '#page-payments'],
  ['styles/features/_reports.scss', '#page-reports'],
  ['styles/features/_students.scss', '#profileModal'],
]);

function belongsToRoot(selector, rootSelector) {
  return (
    selector === rootSelector ||
    selector.startsWith(`${rootSelector} `) ||
    selector.startsWith(`${rootSelector}:`) ||
    selector.startsWith(`${rootSelector}[`)
  );
}

function nestedSelector(selector, rootSelector) {
  if (selector === rootSelector) return '&';
  const suffix = selector.slice(rootSelector.length);
  return suffix.startsWith(':') || suffix.startsWith('[') ? `&${suffix}` : suffix.trimStart();
}

function atRoot(node) {
  const rule = postcss.atRule({ name: 'at-root' });
  rule.append(node.clone());
  return rule;
}

function nestNode(node, rootSelector) {
  if (node.type === 'rule') {
    const selectors = postcss.list.comma(node.selector);
    if (!selectors.every((selector) => belongsToRoot(selector, rootSelector))) {
      return [atRoot(node)];
    }

    if (selectors.every((selector) => selector === rootSelector)) {
      return node.nodes.map((child) => child.clone());
    }

    const clone = node.clone();
    clone.selector = selectors.map((selector) => nestedSelector(selector, rootSelector)).join(', ');
    return [clone];
  }

  if (node.type === 'atrule' && node.nodes) {
    if (/^(?:keyframes|-webkit-keyframes|font-face)$/i.test(node.name)) return [atRoot(node)];
    const clone = node.clone({ nodes: [] });
    for (const child of node.nodes) clone.append(nestNode(child, rootSelector));
    return [clone];
  }

  return [node.clone()];
}

for (const [file, rootSelector] of features) {
  const source = await readFile(file, 'utf8');
  const document = postcss.parse(source, { from: file, syntax: scss });
  const alreadyNested = document.nodes.length === 1 && document.first?.selector === rootSelector;
  const wrapper = alreadyNested ? document.first : postcss.rule({ selector: rootSelector });

  if (!alreadyNested) {
    for (const node of document.nodes) wrapper.append(nestNode(node, rootSelector));
    document.removeAll();
    document.append(wrapper);
  }

  if (rootSelector === '#profileModal') {
    wrapper.walkAtRules('at-root', (rule) => {
      rule.replaceWith(...rule.nodes.map((node) => node.clone()));
    });
  }

  await writeFile(file, document.toResult({ syntax: scss }).css);
  console.log(`Nested ${file} under ${rootSelector}`);
}
