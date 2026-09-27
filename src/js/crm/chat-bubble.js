/* =====================================================================
   Project chat as a corner bubble. Click it and the conversation pops
   up; new messages arrive live, and the bubble shows how many are
   unread (from the notifications the database writes for each message).
   One per open project; destroy() when leaving the page.
   ===================================================================== */
import { gsap } from 'gsap';
import { supabase } from '../supabase.js';
import { el, fill, REDUCED, toast, fmtDate, fmtTime, initials, richText, icon } from './util.js';

export function chatBubble({ contract, owner, me, onRead }) {
  const id = contract.id;
  const st = { open: false, msgs: [], unread: 0, loaded: false };
  const who = owner ? (contract.client_name?.split(' ')[0] || 'the client') : 'Landon';

  const badge = el('span', { class: 'cb-badge', hidden: true });
  const btn = el('button', { type: 'button', class: 'cb-btn', 'aria-label': `Chat with ${who}`, 'aria-expanded': 'false', html: icon.chat });
  btn.append(badge);
  const list = el('ol', { class: 'chat-list cb-list', 'aria-live': 'polite' });
  const box = el('textarea', { rows: 1, maxlength: 4000, placeholder: `Message ${who}…`, 'aria-label': 'Message' });
  const send = el('button', { type: 'submit', class: 'chat-send', 'aria-label': 'Send', html: icon.send });
  const panel = el('section', { class: 'cb-panel', role: 'dialog', 'aria-label': `Chat with ${who}`, hidden: true },
    el('header', { class: 'cb-head' },
      el('span', { class: 'hm-av', text: initials(owner ? (contract.client_name || contract.client_email || '?') : 'Landon Williams') }),
      el('div', {}, el('strong', { text: owner ? (contract.client_name || contract.client_email || 'Client') : 'Landon Williams' }), el('small', { text: contract.title })),
      el('button', { type: 'button', class: 'cb-close', 'aria-label': 'Close chat', html: '&times;', onclick: () => toggle(false) })),
    list,
    el('form', { class: 'chat-form cb-form', onsubmit: (e) => { e.preventDefault(); post(); } }, box, send),
    owner && !contract.client_id ? el('p', { class: 'chat-note cb-note', text: 'The client will see this once they have an account.' }) : null);
  const root = el('div', { class: 'cb' }, panel, btn);
  document.body.append(root);

  btn.addEventListener('click', () => toggle(!st.open));
  box.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); post(); } });
  box.addEventListener('input', () => { box.style.height = 'auto'; box.style.height = `${Math.min(box.scrollHeight, 140)}px`; });
  const onKey = (e) => { if (e.key === 'Escape' && st.open) { toggle(false); btn.focus(); } };
  document.addEventListener('keydown', onKey);

  function badgeUpdate() {
    badge.hidden = !st.unread;
    badge.textContent = st.unread > 9 ? '9+' : st.unread;
    btn.classList.toggle('has-new', st.unread > 0);
  }

  async function markRead() {
    if (!st.unread) return;
    st.unread = 0; badgeUpdate();
    await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('contract_id', id).eq('kind', 'message').is('read_at', null);
    onRead?.();
  }

  async function toggle(on) {
    st.open = on;
    panel.hidden = !on;
    btn.setAttribute('aria-expanded', String(on));
    root.classList.toggle('open', on);
    if (!on) return;
    if (!st.loaded) await load();
    render();
    markRead();
    if (!REDUCED) gsap.fromTo(panel, { y: 12, autoAlpha: 0, scale: 0.98 }, { y: 0, autoAlpha: 1, scale: 1, duration: 0.25, ease: 'power2.out', transformOrigin: '100% 100%' });
    box.focus({ preventScroll: true });
  }

  async function load() {
    const { data, error } = await supabase.from('contract_messages').select('*').eq('contract_id', id).order('created_at');
    if (error) return toast(`Couldn’t load the chat: ${error.message}`, 'error');
    st.msgs = data || [];
    st.loaded = true;
  }

  function bubble(m) {
    const mine = m.sender_id === me.id;
    return el('li', { class: `chat-msg${mine ? ' mine' : ''}`, 'data-id': m.id },
      mine ? null : el('span', { class: 'chat-av', text: initials(m.sender_name) }),
      el('div', {},
        richText(m.body, 'p', { class: 'chat-bubble' }),
        el('span', { class: 'chat-meta', text: `${mine ? 'You' : m.sender_name} · ${fmtTime(m.created_at)}` })));
  }

  function render() {
    if (!st.msgs.length) {
      fill(list, el('li', { class: 'chat-empty', text: owner ? 'No messages yet. Say hello.' : 'Questions, feedback, links: send them here and Landon will reply.' }));
      return;
    }
    let lastDay = '';
    const nodes = [];
    for (const m of st.msgs) {
      const d = new Date(m.created_at).toDateString();
      if (d !== lastDay) { nodes.push(el('li', { class: 'chat-day', text: fmtDate(m.created_at, { weekday: 'short', month: 'short', day: 'numeric' }) })); lastDay = d; }
      nodes.push(bubble(m));
    }
    fill(list, nodes);
    list.scrollTop = list.scrollHeight;
  }

  async function post() {
    const text = box.value.trim();
    if (!text) return;
    send.disabled = true;
    const { data, error } = await supabase.from('contract_messages').insert({ contract_id: id, body: text }).select().single();
    send.disabled = false;
    if (error) return toast(`Couldn’t send: ${error.message}`, 'error');
    box.value = ''; box.style.height = '';
    if (!st.msgs.some((m) => m.id === data.id)) { st.msgs.push(data); render(); }
    box.focus();
  }

  // unread messages waiting for me on this project
  supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('contract_id', id).eq('kind', 'message').is('read_at', null)
    .then(({ count }) => { st.unread = count || 0; badgeUpdate(); });

  const channel = supabase.channel(`bubble-${id}-${Math.random().toString(36).slice(2, 8)}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'contract_messages', filter: `contract_id=eq.${id}` }, ({ new: m }) => {
      if (st.msgs.some((x) => x.id === m.id)) return;
      if (st.loaded) st.msgs.push(m);
      if (m.sender_id === me.id) { if (st.open) render(); return; }
      if (st.open) {
        render();
        markRead();
      } else {
        st.unread += 1; badgeUpdate();
        if (!REDUCED) gsap.fromTo(btn, { scale: 0.85 }, { scale: 1, duration: 0.6, ease: 'elastic.out(1, 0.4)' });
      }
    })
    .subscribe();

  return {
    open: () => toggle(true),
    destroy: () => { supabase.removeChannel(channel); document.removeEventListener('keydown', onKey); root.remove(); },
  };
}
