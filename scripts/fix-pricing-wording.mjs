/**
 * The site said "fixed price" everywhere. That is only half true: a job is
 * priced either as a one-time cost or as a monthly plan, depending on the job,
 * and which one applies is settled in the written scope. This rewrites the
 * wording wherever it appears.
 *
 *   node scripts/fix-pricing-wording.mjs
 */

import { readFile, writeFile, readdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const SWAPS = [
  [
    'Your goals, your users, and a written scope, timeline, and fixed price before any work begins.',
    'Your goals, your users, and a written scope, timeline, and price before any work begins — a one-time cost or a monthly plan, whichever fits the job.',
  ],
  [
    'A written scope, an honest timeline, and a fixed price before work starts, plus a direct line to the people doing the work.',
    'A written scope, an honest timeline, and a price before work starts — one-time or monthly, whichever suits the job — plus a direct line to the people doing the work.',
  ],
  [
    'Five steps, one team, and no surprises. You get a written scope, a timeline, and a fixed price before any work begins, and you see working software every week.',
    'Five steps, one team, and no surprises. You get a written scope, a timeline, and a price before any work begins — a one-time cost for the job or a monthly plan — and you see working software every week.',
  ],
  [
    'It depends on the scope. Every project starts with a free discovery call, and afterwards you get a written scope, timeline, and fixed price before any work begins, so there are no surprises.',
    'It depends on the job. Every project starts with a free discovery call, and afterwards you get a written scope with the timeline and the price before any work begins. Some jobs are a one-time price, others suit a monthly plan; we agree which before we start, so there are no surprises.',
  ],
  [
    "Every project starts with a free discovery call, and you'll get a written scope, timeline, and price before any work begins.",
    "Every project starts with a free discovery call, and you'll get a written scope, timeline, and price — one-time or monthly — before any work begins.",
  ],
];

let changed = 0;
for (const name of (await readdir(ROOT)).filter((n) => n.endsWith('.html'))) {
  const path = join(ROOT, name);
  const before = await readFile(path, 'utf8');
  let after = before;
  for (const [from, to] of SWAPS) after = after.split(from).join(to);
  if (after !== before) {
    await writeFile(path, after, 'utf8');
    changed += 1;
    console.log(`  ${name}`);
  }
}
console.log(`Updated the pricing wording in ${changed} page(s).`);

const left = [];
for (const name of (await readdir(ROOT)).filter((n) => n.endsWith('.html'))) {
  if ((await readFile(join(ROOT, name), 'utf8')).includes('fixed price')) left.push(name);
}
console.log(left.length ? `Still says "fixed price": ${left.join(', ')}` : 'No page says "fixed price" any more.');
