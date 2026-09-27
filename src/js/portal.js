/* =====================================================================
   Client portal — each of the client's projects is its own workspace:
   Overview (scope, status, deliverables, dates), Tickets (requests with
   files), Chat with Landon, Schedule (with Join links), and Files.
   Addresses look like portal.html#/booking-website/tickets/12.
   Row-level security means a client only ever receives their own data.
   ===================================================================== */
import { supabase, isConfigured } from './supabase.js';
import { el, $, $$, STATUS, LIVE, PENDING, fill } from './crm/util.js';
import { contractPage, projectHref } from './crm/contract-view.js';
import { notificationBell } from './crm/notifications.js';

$$('[data-year]').forEach((e) => { e.textContent = new Date().getFullYear(); });

const st = { me: null, contracts: [], current: null, cleanup: null, bell: null, token: null };
const order = (c) => (LIVE.includes(c.status) ? 0 : PENDING.includes(c.status) ? 1 : 2);

boot();

async function boot() {
  if (!isConfigured) return location.replace('login.html');
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return location.replace('login.html?next=portal.html');
  const { data: role } = await supabase.rpc('my_role');
  if (role === 'owner') return location.replace('admin.html');
  st.me = session.user;

  const { data: me } = await supabase.from('profiles').select('full_name, email').eq('id', st.me.id).maybeSingle();
  $('#whoami').textContent = me?.full_name || me?.email || st.me.email;
  $('#signOut').addEventListener('click', async () => { await supabase.auth.signOut(); location.assign('login.html'); });
  supabase.auth.onAuthStateChange((event) => { if (event === 'SIGNED_OUT') location.replace('login.html'); });

  st.bell = notificationBell($('#bellMount'), { me: st.me, onOpen: openNotification });

  await load();
  window.addEventListener('hashchange', route);
  route();

  // a new project (or one just linked to this account) shows up live
  supabase.channel(`portal-${st.me.id}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'contracts' }, async () => { await load(); renderTabs(); })
    .subscribe();
}

async function load() {
  const { data, error } = await supabase.from('contracts').select('*');
  if (error) { fill($('#portalMain'), el('p', { class: 'crm-empty', text: `Couldn’t load your projects: ${error.message}` })); return; }
  st.contracts = data.sort((a, b) => order(a) - order(b) || new Date(b.updated_at) - new Date(a.updated_at));
}

function route() {
  if (!st.contracts.length) { renderTabs(); return empty(); }
  const hash = location.hash.slice(1);
  let [slug, section, sub] = hash.startsWith('/') ? hash.slice(1).split('/').map(decodeURIComponent) : [];
  // older links used the contract id
  const byId = !slug && hash && st.contracts.find((c) => c.id === hash);
  const c = st.contracts.find((x) => x.slug === slug) || byId || st.contracts[0];
  if (!slug || c.slug !== slug) { history.replaceState(null, '', projectHref(c, section, sub)); [slug, section, sub] = [c.slug, section, sub]; }
  show(c, section || 'overview', sub);
}

function renderTabs() {
  const nav = $('#portalTabs');
  nav.hidden = st.contracts.length < 2;
  fill(nav, st.contracts.map((c) => el('a', {
    href: projectHref(c), class: 'portal-tab', 'aria-current': c.id === st.current ? 'page' : 'false',
  }, el('span', { text: c.title }), el('small', { text: STATUS[c.status]?.label || c.status }))));
}

async function show(c, section, sub) {
  st.cleanup?.(); st.cleanup = null;
  st.current = c.id;
  document.title = `${c.title} — Williams Systems LLC`;
  renderTabs();
  const token = (st.token = Symbol('show'));
  const stop = await contractPage($('#portalMain'), { slug: c.slug, section, sub, owner: false, me: st.me, onRead: () => st.bell?.refresh() });
  if (st.token === token) st.cleanup = stop; else stop();
}

async function openNotification(n) {
  if (n.ticket_id) {
    const { data: t } = await supabase.from('tickets').select('number, contract_id').eq('id', n.ticket_id).maybeSingle();
    const c = t && st.contracts.find((x) => x.id === t.contract_id);
    if (c) { location.hash = projectHref(c, 'tickets', t.number); return; }
  }
  const c = n.contract_id && st.contracts.find((x) => x.id === n.contract_id);
  if (c) location.hash = projectHref(c, n.kind === 'message' ? 'chat' : n.kind === 'event' ? 'schedule' : 'overview');
}

function empty() {
  fill($('#portalMain'), el('section', { class: 'portal-empty' },
    el('p', { class: 'cv-kicker mono', text: 'Welcome' }),
    el('h1', { text: 'Your project page is on its way.' }),
    el('p', { text: 'Once we agree on your project, this page becomes its home: the scope of work, progress, dates, requests, and a chat with Landon. You’ll get a notification the moment it’s ready.' }),
    el('div', { class: 'portal-empty-actions' },
      el('a', { class: 'btn btn-primary', href: 'contact.html', text: 'Contact us' }),
      el('a', { class: 'btn btn-ghost', href: './', text: 'Back to the website' }))));
}
