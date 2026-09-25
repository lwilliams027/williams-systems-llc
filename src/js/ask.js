/* =====================================================================
   "Ask us anything" (faq.html, about.html)

   Visitors type a question like a chat prompt. It's matched against every
   written answer on the site (the #askData JSON, built by
   scripts/build-about-faq.cjs) and the best answer is shown as a reply,
   with related questions to tap. No AI and no server: if nothing matches
   well, it says so and offers a free call instead of guessing.
   On faq.html it also runs the topic filter for the full list.
   ===================================================================== */
const dataEl = document.getElementById('askData');
const KB = dataEl ? JSON.parse(dataEl.textContent) : [];
const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const STOP = new Set('a an and are as at be but by can could do does for from have how i if in is it its me my of on or our so that the their them there this to us was we what when where which who will with would you your yours about any just need want get got should build make made use used work do done'.split(' '));
// Words people use for the same thing, mapped to one form.
const SYN = {
  price: 'cost', prices: 'cost', pricing: 'cost', charge: 'cost', expensive: 'cost', budget: 'cost', pay: 'cost', paid: 'cost', payment: 'cost', payments: 'cost', quote: 'cost', fee: 'cost', fees: 'cost', money: 'cost', afford: 'cost',
  long: 'time', timeline: 'time', fast: 'time', quick: 'time', quickly: 'time', soon: 'time', weeks: 'time', week: 'time', months: 'time', take: 'time', takes: 'time', duration: 'time',
  own: 'own', owns: 'own', ownership: 'own', owner: 'own', mine: 'own',
  help: 'support', maintain: 'support', maintenance: 'support', fix: 'support', fixes: 'support', updates: 'support', update: 'support', after: 'support', launch: 'support',
  technology: 'tech', technologies: 'tech', stack: 'tech', language: 'tech', languages: 'tech', framework: 'tech', react: 'tech', python: 'tech', node: 'tech',
  host: 'hosting', hosted: 'hosting', server: 'hosting', servers: 'hosting', domain: 'hosting',
  seo: 'google', search: 'google', rank: 'google', ranking: 'google', found: 'google',
  iphone: 'mobile', android: 'mobile', ios: 'mobile', app: 'app', apps: 'app', store: 'mobile',
  ai: 'ai', assistant: 'ai', chatbot: 'ai', bot: 'ai', gpt: 'ai', claude: 'ai',
  secure: 'security', safe: 'security', hack: 'security', hacked: 'security', private: 'security', privacy: 'security',
  excel: 'spreadsheet', sheet: 'spreadsheet', sheets: 'spreadsheet', spreadsheets: 'spreadsheet',
  contract: 'contract', cancel: 'contract', commitment: 'contract', minimum: 'contract', term: 'contract',
  deposit: 'deposit', upfront: 'deposit', revision: 'revision', revisions: 'revision', changes: 'revision', edits: 'revision',
  where: 'located', located: 'located', based: 'located', location: 'located', country: 'located', worldwide: 'located', remote: 'located',
  talk: 'contact', speak: 'contact', call: 'contact', contact: 'contact', email: 'contact', reach: 'contact',
  existing: 'existing', old: 'existing', current: 'existing', already: 'existing', someone: 'existing',
  start: 'start', started: 'start', begin: 'start',
  site: 'website', sites: 'website', websites: 'website', webpage: 'website', live: 'time', till: 'time', until: 'time',
  programming: 'tech', coding: 'tech', tools: 'tech', train: 'security', training: 'security', trained: 'security',
};
const stem = (w) => w.replace(/(ing|ed|es|s)$/, '');
const words = (text) => text.toLowerCase().replace(/[’']/g, '').match(/[a-z0-9]+/g) || [];
const tokens = (text) => words(text).filter((w) => !STOP.has(w) || SYN[w]).map((w) => SYN[w] || stem(w));

const INDEX = KB.map((k) => ({ ...k, qt: new Set(tokens(k.q)), at: new Set(tokens(k.a)), tt: new Set(tokens(k.topic)) }));

function search(query) {
  const qt = tokens(query);
  if (!qt.length) return [];
  return INDEX.map((k) => {
    let score = 0;
    for (const t of qt) {
      if (k.qt.has(t)) score += 3;
      else if (k.at.has(t)) score += 1;
      if (k.tt.has(t)) score += 1.5;
    }
    return { k, score: score / Math.sqrt(qt.length + 1) };
  }).filter((r) => r.score > 0).sort((a, b) => b.score - a.score);
}

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function initBox(box) {
  const chat = box.querySelector('.ask-chat');
  const form = box.querySelector('.ask-form');
  const input = form.querySelector('input');
  const chips = box.querySelector('.ask-chips');
  let busy = false;

  const scroll = () => { chat.scrollTop = chat.scrollHeight; };
  const add = (cls, html) => {
    const m = document.createElement('div');
    m.className = `ask-msg ${cls}`;
    m.innerHTML = cls === 'bot' ? `<i class="ask-av" aria-hidden="true"></i><div class="ask-body">${html}</div>` : `<p>${html}</p>`;
    chat.append(m);
    scroll();
    return m;
  };
  const typeInto = (el, text) => new Promise((done) => {
    if (reduce) { el.textContent = text; done(); return; }
    let i = 0;
    const step = () => {
      i = Math.min(text.length, i + 3);
      el.textContent = text.slice(0, i);
      scroll();
      if (i < text.length) setTimeout(step, 12); else done();
    };
    step();
  });

  async function ask(q) {
    q = q.trim();
    if (!q || busy) return;
    busy = true;
    add('me', esc(q));
    input.value = '';
    const thinking = add('bot', '<span class="ask-dots"><i></i><i></i><i></i></span>');
    await new Promise((r) => setTimeout(r, reduce ? 0 : 550));
    const results = search(q);
    const best = results[0];
    const body = thinking.querySelector('.ask-body');
    if (best && best.score >= 1.5) {
      body.innerHTML = '<p class="ask-a"></p>';
      await typeInto(body.querySelector('.ask-a'), best.k.a);
      const more = best.k.url && best.k.url !== 'faq.html' ? `<a href="${best.k.url}">${esc(best.k.topic)} →</a>` : '';
      body.insertAdjacentHTML('beforeend', `<p class="ask-src">From: ${esc(best.k.q)} ${more}</p>`);
      const related = results.slice(1).filter((r) => r.score >= Math.max(2, best.score * 0.6) && r.k.q !== best.k.q).slice(0, 3);
      if (related.length) {
        body.insertAdjacentHTML('beforeend', `<div class="ask-related">${related.map((r) => `<button type="button" class="ask-chip">${esc(r.k.q)}</button>`).join('')}</div>`);
      }
    } else {
      body.innerHTML = `<p class="ask-a">I don’t have a written answer for that one yet. It’s a great question for a free discovery call, or email <a href="mailto:lwilliams24270@gmail.com">lwilliams24270@gmail.com</a> and Landon will answer it directly.</p><p><a class="btn btn-primary btn-sm" href="schedule.html">Book a free call</a></p>`;
    }
    scroll();
    busy = false;
  }

  form.addEventListener('submit', (e) => { e.preventDefault(); ask(input.value); });
  box.addEventListener('click', (e) => {
    const chip = e.target.closest('.ask-chip');
    if (chip) ask(chip.textContent);
  });
}

document.querySelectorAll('[data-ask]').forEach(initBox);

/* faq.html: filter the full list by topic */
const tabs = [...document.querySelectorAll('.faq-tab')];
if (tabs.length) {
  const items = [...document.querySelectorAll('.faq-grid .qa-item')];
  tabs.forEach((tab) => tab.addEventListener('click', () => {
    tabs.forEach((t) => t.classList.toggle('on', t === tab));
    const topic = tab.dataset.topic;
    items.forEach((it) => { it.hidden = topic !== 'all' && it.dataset.topic !== topic; });
  }));
}
