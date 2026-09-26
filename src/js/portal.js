/* =====================================================================
   Client portal — a client's page is their contract: scope of work,
   status, deliverables, dates, schedule, timeline, and a live chat
   with Landon. Clients with more than one project get tabs.
   Row-level security means a client only ever receives their own data.
   ===================================================================== */
import { supabase, isConfigured } from './supabase.js';
import { el, $, $$, STATUS, LIVE, PENDING } from './crm/util.js';
import { contractPage } from './crm/contract-view.js';
import { notificationBell } from './crm/notifications.js';

$$('[data-year]').forEach((e) => { e.textContent = new Date().getFullYear(); });

const st = { me: null, contracts: [], current: null, cleanup: null, bell: null };
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

  st.bell = notificationBell($('#bellMount'), { me: st.me, onOpen: (n) => { if (n.contract_id) show(n.contract_id); } });

  await load();
  window.addEventListener('hashchange', () => { const id = location.hash.slice(1); if (id && id !== st.current) show(id); });

  // a new contract (or one that just got linked to this account) shows up live
  supabase.channel(`portal-${st.me.id}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'contracts' }, () => load(false))
    .subscribe();
}

async function load(open = true) {
  const { data, error } = await supabase.from('contracts').select('*');
  if (error) { $('#portalMain').replaceChildren(el('p', { class: 'crm-empty', text: `Couldn’t load your projects: ${error.message}` })); return; }
  st.contracts = data.sort((a, b) => order(a) - order(b) || new Date(b.updated_at) - new Date(a.updated_at));
  renderTabs();
  if (!st.contracts.length) return empty();
  if (open || !st.current || !st.contracts.some((c) => c.id === st.current)) {
    const want = location.hash.slice(1);
    show(st.contracts.some((c) => c.id === want) ? want : st.contracts[0].id);
  }
}

function renderTabs() {
  const nav = $('#portalTabs');
  nav.hidden = st.contracts.length < 2;
  nav.replaceChildren(...st.contracts.map((c) => el('a', {
    href: `#${c.id}`, class: 'portal-tab', 'aria-current': c.id === st.current ? 'page' : 'false',
  }, el('span', { text: c.title }), el('small', { text: STATUS[c.status]?.label || c.status }))));
}

async function show(id) {
  st.cleanup?.();
  st.current = id;
  if (location.hash.slice(1) !== id) history.replaceState(null, '', `#${id}`);
  renderTabs();
  st.cleanup = await contractPage($('#portalMain'), { id, owner: false, me: st.me, onRead: () => st.bell?.refresh() });
}

function empty() {
  $('#portalMain').replaceChildren(el('section', { class: 'portal-empty' },
    el('p', { class: 'cv-kicker mono', text: 'Welcome' }),
    el('h1', { text: 'Your project page is on its way.' }),
    el('p', { text: 'Once we agree on your project, this page becomes its home: the scope of work, progress, dates, and a chat with Landon. You’ll get a notification the moment it’s ready.' }),
    el('div', { class: 'portal-empty-actions' },
      el('a', { class: 'btn btn-primary', href: 'contact.html', text: 'Contact us' }),
      el('a', { class: 'btn btn-ghost', href: './', text: 'Back to the website' }))));
}
