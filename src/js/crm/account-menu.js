/* =====================================================================
   Account button (top right, before the bell): your initials; click for
   a menu with Account settings, View website and Sign out.
   Settings: display name (what the other side sees in chats) + password.
   ===================================================================== */
import { gsap } from 'gsap';
import { supabase } from '../supabase.js';
import { el, fill, REDUCED, initials } from './util.js';
import { openSettings, applyPrefs } from './settings.js';

const I = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const ICO = {
  settings: I('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>'),
  site: I('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>'),
  out: I('<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>'),
  card: I('<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M6 15h4"/>'),
};

export function accountMenu(mount, { me, owner = false, onNameChange } = {}) {
  const st = { open: false, name: '', email: me.email, profile: {} };
  const btn = el('button', { type: 'button', class: 'acct-btn', 'aria-label': 'Account', 'aria-haspopup': 'menu', 'aria-expanded': 'false' });
  const menu = el('div', { class: 'acct-menu', role: 'menu', hidden: true });
  const wrap = el('div', { class: 'acct' }, btn, menu);
  fill(mount, wrap);

  const item = (svg, label, onclick, cls = '') => el('button', { type: 'button', role: 'menuitem', class: `acct-item ${cls}`, onclick: () => { toggle(false); onclick(); } },
    el('span', { class: 'acct-ico', html: svg }), label);
  function render() {
    btn.textContent = initials(st.name || st.email);
    btn.title = st.name || st.email;
    fill(menu,
      el('div', { class: 'acct-head' },
        el('span', { class: 'acct-av', text: initials(st.name || st.email) }),
        el('div', {}, el('strong', { text: st.name || 'Your account' }), el('small', { text: st.email }),
          el('span', { class: 'acct-role', text: owner ? 'Owner' : 'Client' }))),
      el('div', { class: 'acct-group' },
        item(ICO.settings, 'Account settings', () => settings('profile')),
        item(ICO.card, 'Billing & payments', () => settings('billing')),
        item(ICO.site, 'View website', () => location.assign('./'))),
      el('div', { class: 'acct-group' },
        item(ICO.out, 'Sign out', async () => { await supabase.auth.signOut(); location.assign('login.html'); }, 'danger')));
  }

  function toggle(on) {
    st.open = on;
    menu.hidden = !on;
    btn.setAttribute('aria-expanded', String(on));
    if (on && !REDUCED) gsap.from(menu, { y: -6, autoAlpha: 0, duration: 0.2, ease: 'power2.out' });
    if (on) menu.querySelector('.acct-item')?.focus();
  }
  btn.addEventListener('click', (e) => { e.stopPropagation(); toggle(!st.open); });
  document.addEventListener('click', (e) => { if (st.open && !wrap.contains(e.target)) toggle(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && st.open) { toggle(false); btn.focus(); } });

  const settings = (section = 'profile') => openSettings({
    me, owner, section,
    profile: { ...st.profile, full_name: st.name, email: st.email },
    onProfile: (p) => { st.profile = p; if (p.full_name !== st.name) { st.name = p.full_name; render(); onNameChange?.(p.full_name); } },
  });

  supabase.from('profiles').select('full_name, email, phone, company, prefs').eq('id', me.id).maybeSingle().then(({ data }) => {
    st.profile = data || {};
    st.name = data?.full_name || '';
    st.email = data?.email || me.email;
    applyPrefs(data?.prefs || {});
    render();
  });
  render();
  return { rename: (n) => { st.name = n; render(); }, openSettings: (section) => settings(section) };
}
