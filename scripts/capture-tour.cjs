/* Refresh the Face & Mane images used by the Websites page tour.
   Captures the live site at 2x, closes the referral popup, and cuts the page
   into tiles: public/tour/fnm/d0-7.jpg (sharp, desktop) and m0-7.jpg (phones).
   Needs: playwright-core, Microsoft Edge, and ffmpeg on PATH.
   Usage: node scripts/capture-tour.cjs
   If the site's sections move, update the .tw-stop boxes in websites.html
   (the section positions are printed below, in page pixels; add 44 to y). */
const { chromium } = require('playwright-core');
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const URL = 'https://the-doctors-accountant.com/';
const OUT = path.join(__dirname, '..', 'public', 'tour', 'fnm');
(async () => {
  const b = await chromium.launch({ channel: 'msedge', headless: true });
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, reducedMotion: 'reduce' });
  const p = await ctx.newPage();
  await p.goto(URL, { waitUntil: 'load', timeout: 90000 });
  await p.waitForTimeout(4000);
  const H = await p.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < H; y += 450) { await p.evaluate((y) => scrollTo(0, y), y); await p.waitForTimeout(300); }
  await p.evaluate(() => scrollTo(0, 0));
  await p.waitForTimeout(2000);
  await p.evaluate(() => {
    const btn = [...document.querySelectorAll('button, a')].find((e) => /send invitation/i.test(e.textContent));
    let n = btn;
    while (n && n !== document.body) { const cs = getComputedStyle(n); if (cs.position === 'fixed' || cs.position === 'absolute') break; n = n.parentElement; }
    if (n && n !== document.body) n.remove();
  });
  console.log(JSON.stringify(await p.evaluate(() => [...document.querySelectorAll('header, section, footer')].map((e) => { const r = e.getBoundingClientRect(); return [e.tagName, (e.className || '').toString().slice(0, 30), Math.round(r.top + scrollY), Math.round(r.height)]; }))));
  const full = path.join(OUT, 'full-2x.png');
  await p.screenshot({ path: full, fullPage: true });
  await b.close();
  const h2 = H * 2;
  for (let i = 0, y = 0; y < h2; i++, y += 2000) {
    const h = Math.min(2000, h2 - y);
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', full, '-vf', `crop=2880:${h}:0:${y}`, '-q:v', '4', path.join(OUT, `d${i}.jpg`)]);
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', full, '-vf', `crop=2880:${h}:0:${y},scale=1440:-1`, '-q:v', '5', path.join(OUT, `m${i}.jpg`)]);
  }
  fs.unlinkSync(full);
  console.log('tiles written to', OUT);
})();
