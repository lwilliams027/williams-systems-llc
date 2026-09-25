/* Record the Face & Mane clips used by the Websites page tour.
   Films the live site one moment at a time (with its own animations, a
   visible cursor, and the referral popup removed) and writes MP4 clips and
   poster frames to public/tour/fnm/clips/.
   Needs: playwright-core, Microsoft Edge, and ffmpeg on PATH.
   Usage: node scripts/record-tour.cjs            (all clips)
          node scripts/record-tour.cjs hero hudak (only some) */
const { chromium } = require('playwright-core');
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const URL = 'https://the-doctors-accountant.com/';
const OUT = path.join(__dirname, '..', 'public', 'tour', 'fnm', 'clips');
fs.mkdirSync(OUT, { recursive: true });

// Runs in every page: removes the referral popup and draws a cursor that follows the mouse.
const INIT = () => {
  const kill = () => {
    const btn = [...document.querySelectorAll('button, a')].find((e) => /send invitation/i.test(e.textContent));
    let n = btn;
    while (n && n !== document.body) { const cs = getComputedStyle(n); if (cs.position === 'fixed' || cs.position === 'absolute') break; n = n.parentElement; }
    if (n && n !== document.body) n.remove();
  };
  setInterval(kill, 150);
  addEventListener('DOMContentLoaded', () => {
    const c = document.createElement('div');
    c.innerHTML = '<svg width="26" height="26" viewBox="0 0 24 24"><path d="M4 2l16 11-7 1.4L9 22z" fill="#111" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>';
    Object.assign(c.style, { position: 'fixed', left: '-40px', top: '-40px', zIndex: 2147483647, pointerEvents: 'none', transition: 'transform .12s', filter: 'drop-shadow(0 2px 3px rgba(0,0,0,.35))' });
    document.body.append(c);
    addEventListener('mousemove', (e) => { c.style.left = e.clientX - 3 + 'px'; c.style.top = e.clientY - 2 + 'px'; }, true);
    addEventListener('mousedown', () => { c.style.transform = 'scale(.85)'; }, true);
    addEventListener('mouseup', () => { c.style.transform = ''; }, true);
  });
};

const smooth = (page, to, dur) => page.evaluate(({ to, dur }) => new Promise((res) => {
  const from = scrollY, t0 = performance.now();
  const step = (now) => {
    const k = Math.min(1, (now - t0) / dur);
    const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
    scrollTo(0, from + (to - from) * e);
    k < 1 ? requestAnimationFrame(step) : res();
  };
  requestAnimationFrame(step);
}), { to, dur });
const top = (page, sel, i = 0) => page.evaluate(({ sel, i }) => { const e = document.querySelectorAll(sel)[i]; return e ? Math.round(e.getBoundingClientRect().top + scrollY) : 0; }, { sel, i });

/** Record `act(page)` as a clip. */
async function record(browser, name, { width, height, dpr = 1 }, prepare, act) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: dpr });
  await ctx.addInitScript(INIT);
  const page = await ctx.newPage();
  await page.goto(URL, { waitUntil: 'load', timeout: 90000 });
  await page.mouse.move(width * 0.6, height * 0.55);
  if (prepare) await prepare(page);
  const cdp = await ctx.newCDPSession(page);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tour-'));
  const frames = [];
  cdp.on('Page.screencastFrame', async ({ data, metadata, sessionId }) => {
    const f = path.join(dir, `f${String(frames.length).padStart(5, '0')}.jpg`);
    fs.writeFileSync(f, Buffer.from(data, 'base64'));
    frames.push({ f, t: Date.now() / 1000 });   // one clock for frames and the end
    cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
  });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: width * dpr, maxHeight: height * dpr, everyNthFrame: 1 });
  await act(page);
  const tEnd = Date.now() / 1000;          // hold the last frame until the moment really ends
  await cdp.send('Page.stopScreencast');
  await ctx.close();
  // Frames arrive with timestamps; turn them into a constant-rate video.
  const list = frames.map((fr, k) => `file '${fr.f.replace(/\\/g, '/')}'\nduration ${Math.max(0.03, (frames[k + 1]?.t ?? tEnd) - fr.t).toFixed(4)}`).join('\n') + `\nfile '${frames[frames.length - 1].f.replace(/\\/g, '/')}'`;
  const listFile = path.join(dir, 'list.txt');
  fs.writeFileSync(listFile, list);
  const mp4 = path.join(OUT, `${name}.mp4`);
  const vf = dpr > 1 ? `scale=${width * 2}:-2,fps=30,format=yuv420p` : `scale=${width}:-2,fps=30,format=yuv420p`;
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', listFile, '-vf', vf, '-c:v', 'libx264', '-preset', 'slow', '-crf', '26', '-movflags', '+faststart', '-an', mp4]);
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', mp4, '-frames:v', '1', '-q:v', '4', path.join(OUT, `${name}.jpg`)]);
  fs.rmSync(dir, { recursive: true, force: true });
  console.log(name, frames.length, 'frames ->', (fs.statSync(mp4).size / 1024).toFixed(0), 'KB');
}

const DESK = { width: 1280, height: 800 };
const wait = (page, ms) => page.waitForTimeout(ms);

const CLIPS = {
  // The video hero, as a visitor lands.
  hero: [DESK, (p) => wait(p, 1200), (p) => wait(p, 6500)],
  // Hover "Book Now", click it, the booking page opens.
  book: [DESK, (p) => wait(p, 2500), async (p) => {
    const b = await p.evaluate(() => { const e = [...document.querySelectorAll('a,button')].find((x) => /book now/i.test(x.textContent)); const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
    await wait(p, 600);
    await p.mouse.move(b.x, b.y, { steps: 30 });
    await wait(p, 900);
    await p.mouse.down(); await wait(p, 120); await p.mouse.up();
    await p.evaluate(() => [...document.querySelectorAll('a,button')].find((x) => /book now/i.test(x.textContent)).click());
    await wait(p, 5500);
  }],
  // Scroll into the first content section; its entrance animations play.
  scroll: [DESK, (p) => wait(p, 2500), async (p) => {
    await wait(p, 400);
    await smooth(p, await top(p, 'section', 1), 1700);
    await wait(p, 3200);
  }],
  // Dr. Hudak: scroll in, then down through her credentials.
  hudak: [DESK, async (p) => { await wait(p, 1500); await p.evaluate(async () => { const s = document.querySelectorAll('section')[3]; scrollTo(0, s.getBoundingClientRect().top + scrollY - 900); }); await wait(p, 800); }, async (p) => {
    const y = await top(p, 'section', 3);
    await smooth(p, y - 20, 1500);
    await wait(p, 2200);
    await smooth(p, y + 520, 1800);
    await wait(p, 1500);
  }],
  // Treatment chooser: scroll in, then hover down the options.
  chooser: [DESK, async (p) => { await wait(p, 1500); await p.evaluate(() => { const s = document.querySelectorAll('section')[4]; scrollTo(0, s.getBoundingClientRect().top + scrollY - 900); }); await wait(p, 800); }, async (p) => {
    const y = await top(p, 'section', 4);
    await smooth(p, y + 40, 1400);
    await wait(p, 700);
    const rows = await p.evaluate(() => ['Not sure where', 'Botox', 'Fillers', 'Hair Restoration', 'Medical-Grade'].map((t) => {
      const e = [...document.querySelectorAll('section')[4].querySelectorAll('*')].find((x) => x.children.length < 4 && x.textContent.trim().startsWith(t.replace('Botox', '"Botox"')) || (x.children.length === 0 && x.textContent.includes(t)));
      if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.left + Math.min(r.width, 300) / 2, y: r.top + r.height / 2 };
    }).filter(Boolean));
    for (const r of rows) { await p.mouse.move(r.x, r.y, { steps: 18 }); await wait(p, 650); }
    await wait(p, 500);
  }],
  // Before-and-after: scroll in and drag two sliders.
  results: [DESK, async (p) => { await wait(p, 1500); await p.evaluate(() => { const s = document.querySelectorAll('section')[5]; scrollTo(0, s.getBoundingClientRect().top + scrollY - 900); }); await wait(p, 800); }, async (p) => {
    const y = await top(p, 'section', 5);
    await smooth(p, y + 130, 1400);
    await wait(p, 600);
    const handles = await p.evaluate(() => [...document.querySelectorAll('section')[5].querySelectorAll('button')].filter((b) => /top-1\/2/.test(b.className)).map((b) => { const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }));
    for (const h of handles.slice(0, 2)) {
      await p.mouse.move(h.x, h.y, { steps: 20 });
      await p.mouse.down();
      await p.mouse.move(h.x - 110, h.y, { steps: 26 });
      await p.mouse.move(h.x + 120, h.y, { steps: 40 });
      await p.mouse.move(h.x, h.y, { steps: 20 });
      await p.mouse.up();
      await wait(p, 300);
    }
    await wait(p, 500);
  }],
  // The same site on a phone.
  mobile: [{ width: 390, height: 844, dpr: 2 }, (p) => wait(p, 3500), async (p) => {
    await wait(p, 3000);
    await smooth(p, 900, 2200);
    await wait(p, 1800);
  }],
};

(async () => {
  const only = process.argv.slice(2);
  const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
  for (const [name, [size, prep, act]] of Object.entries(CLIPS)) {
    if (only.length && !only.includes(name)) continue;
    await record(browser, name, size, prep, act);
  }
  await browser.close();
})();
