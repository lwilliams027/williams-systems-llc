/**
 * Add a Solutions column to the footer of every page, so the new pages are
 * reachable without opening the menu. Safe to re-run: it skips pages that
 * already have the column and keeps aria-current on the page you are on.
 *
 *   node scripts/add-footer-solutions.mjs
 */

import { readFile, writeFile, readdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const SOLUTIONS = [
  ['launch-a-new-product', 'Launch a new product'],
  ['modernize-an-app', 'Modernize an app'],
  ['replace-spreadsheets', 'Replace spreadsheets'],
  ['secure-your-software', 'Secure your software'],
  ['move-to-the-cloud', 'Move to the cloud'],
  ['ongoing-support', 'Ongoing support'],
];

const MARK = '<nav class="sf-col" aria-label="Solutions">';
const PRODUCTS_NAV = '<nav class="sf-col" aria-label="Products">';

function column(currentSlug) {
  const links = SOLUTIONS.map(([slug, label]) => {
    const here = slug === currentSlug ? ' aria-current="page"' : '';
    return `          <a href="${slug}.html"${here}>${label}</a>`;
  }).join('\n');
  return `${MARK}\n          <h3 class="mono">Solutions</h3>\n${links}\n        </nav>\n        `;
}

let added = 0;
for (const name of (await readdir(ROOT)).filter((n) => n.endsWith('.html'))) {
  const path = join(ROOT, name);
  const html = await readFile(path, 'utf8');
  if (html.includes(MARK)) continue;
  const at = html.indexOf(PRODUCTS_NAV);
  if (at < 0) continue; // a page without the standard footer
  const end = html.indexOf('</nav>', at) + '</nav>'.length;
  const next = `${html.slice(0, end)}\n        ${column(name.replace(/\.html$/, ''))}${html.slice(end).replace(/^\s*/, '')}`;
  await writeFile(path, next, 'utf8');
  added += 1;
  console.log(`  ${name}`);
}
console.log(`Added the footer Solutions column to ${added} page(s).`);
