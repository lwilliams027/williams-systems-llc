/* =====================================================================
   The bell: notifications written by the database (new requests,
   messages, status changes, finished deliverables, scheduled events),
   live over Realtime, plus reminders worked out on the spot
   (quiet pending deals, overdue contracts, today's events).
   ===================================================================== */
import { gsap } from 'gsap';
import { supabase } from '../supabase.js';
import { el, REDUCED, timeAgo, toast, icon, fill } from './util.js';

const P = {
  message: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  inquiry: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>',
  request: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6M22 11h-6"/>',
  status: '<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>',
  deliverable: '<path d="M20 6 9 17l-5-5"/>',
  event: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  contract: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/>',
  reminder: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2M5 3 2 6M22 6l-3-3"/>',
};
const kindIcon = (k) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${P[k] || P.status}</svg>`;

export function notificationBell(mount, { me, onOpen, reminders = () => [] }) {
  const st = { list: [], open: false };
  const badge = el('span', { class: 'bell-badge', hidden: true });
  const btn = el('button', { type: 'button', class: 'bell', 'aria-label': 'Notifications', 'aria-expanded': 'false', html: icon.bell });
  btn.append(badge);
  const panel = el('div', { class: 'bell-panel', role: 'dialog', 'aria-label': 'Notifications', hidden: true });
  const wrap = el('div', { class: 'bell-wrap' }, btn, panel);
  mount.replaceChildren(wrap);

  btn.addEventListener('click', (e) => { e.stopPropagation(); toggle(!st.open); });
  document.addEventListener('click', (e) => { if (st.open && !wrap.contains(e.target)) toggle(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && st.open) { toggle(false); btn.focus(); } });

  function toggle(on) {
    st.open = on;
    panel.hidden = !on;
    btn.setAttribute('aria-expanded', String(on));
    if (on) { render(); if (!REDUCED) gsap.from(panel, { y: -8, autoAlpha: 0, duration: 0.25, ease: 'power2.out' }); }
  }

  const unread = () => st.list.filter((n) => !n.read_at).length;
  function badgeUpdate() {
    const n = unread() + reminders().length;
    badge.hidden = !n;
    badge.textContent = n > 99 ? '99+' : n;
    btn.setAttribute('aria-label', n ? `Notifications, ${n} new` : 'Notifications');
  }

  function render() {
    const rem = reminders();
    const item = (n, isReminder) => el('li', { class: `bell-item${n.read_at || isReminder ? '' : ' unread'}${isReminder ? ' reminder' : ''}` },
      el('button', { type: 'button', onclick: () => click(n, isReminder) },
        el('span', { class: `bell-ico bk-${n.kind}`, 'aria-hidden': 'true', html: kindIcon(n.kind) }),
        el('span', { class: 'bell-text' },
          el('strong', { text: n.title }),
          n.body ? el('small', { text: n.body }) : null,
          isReminder ? null : el('time', { class: 'mono', datetime: n.created_at, text: timeAgo(n.created_at) }))));
    fill(panel, 
      el('div', { class: 'bell-head' },
        el('h3', { text: 'Notifications' }),
        unread() ? el('button', { type: 'button', class: 'link-btn', text: 'Mark all read', onclick: markAll }) : null),
      rem.length ? el('div', { class: 'bell-sec' }, el('h4', { class: 'mono', text: 'Needs attention' }), el('ul', {}, rem.map((r) => item(r, true)))) : null,
      el('div', { class: 'bell-sec' },
        rem.length ? el('h4', { class: 'mono', text: 'Recent' }) : null,
        st.list.length ? el('ul', {}, st.list.map((n) => item(n, false))) : el('p', { class: 'bell-empty', text: 'You’re all caught up.' })));
  }

  async function click(n, isReminder) {
    toggle(false);
    if (!isReminder && !n.read_at) {
      n.read_at = new Date().toISOString();
      badgeUpdate();
      supabase.from('notifications').update({ read_at: n.read_at }).eq('id', n.id).then(() => {});
    }
    onOpen(n);
  }

  async function markAll() {
    const now = new Date().toISOString();
    st.list.forEach((n) => { n.read_at = n.read_at || now; });
    badgeUpdate(); render();
    await supabase.from('notifications').update({ read_at: now }).is('read_at', null).eq('user_id', me.id);
  }

  async function load() {
    const { data, error } = await supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(40);
    if (error) return;
    st.list = data;
    badgeUpdate();
    if (st.open) render();
  }

  supabase.channel(`bell-${me.id}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${me.id}` }, ({ new: n }) => {
      if (st.list.some((x) => x.id === n.id)) return;
      st.list.unshift(n);
      badgeUpdate();
      if (st.open) render();
      toast(n.title);
      if (!REDUCED) gsap.fromTo(btn, { rotate: -14 }, { rotate: 0, duration: 0.8, ease: 'elastic.out(1, 0.3)' });
    })
    .subscribe();

  load();
  return { refresh: load, update: () => { badgeUpdate(); if (st.open) render(); } };
}
