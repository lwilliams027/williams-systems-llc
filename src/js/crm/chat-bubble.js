/* =====================================================================
   Messages — a phone-style messenger in the bottom-right corner.
     · Inbox: every conversation (one per project), most recent first,
       with the last message, time and an unread count.
     · Tap one to open the thread; ‹ goes back to the inbox.
     · Opening a thread marks its messages read; your last message shows
       "Delivered" or "Read".
     · A typing bubble (•••) shows while the other person is writing.
   Owners get the inbox on every page. A client with a single project
   goes straight into that conversation.
   ===================================================================== */
import { gsap } from 'gsap';
import { supabase } from '../supabase.js';
import { el, fill, REDUCED, toast, fmtDate, fmtTime, initials, richText, icon } from './util.js';

const BACK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>';
const TYPING_TTL = 4000;

export function messenger({ me, owner, getContracts, onRead }) {
  const st = { open: false, view: 'list', cur: null, msgs: [], loaded: false, typing: new Map(), q: '' };
  const myName = { value: '' };
  supabase.from('profiles').select('full_name').eq('id', me.id).maybeSingle().then(({ data }) => { myName.value = data?.full_name || ''; });

  const convos = () => (getContracts() || []).filter((c) => c.status !== 'lost');
  const single = () => !owner && convos().length === 1;
  const who = (c) => (owner ? c.client_name || c.client_email || 'Client' : 'Landon Williams');
  const threadOf = (cid) => st.msgs.filter((m) => m.contract_id === cid);
  const unreadIn = (cid) => st.msgs.filter((m) => m.contract_id === cid && m.sender_id !== me.id && !m.read_at).length;
  const totalUnread = () => st.msgs.filter((m) => m.sender_id !== me.id && !m.read_at && convos().some((c) => c.id === m.contract_id)).length;
  const isTyping = (cid) => (st.typing.get(cid) || 0) > Date.now() - TYPING_TTL;

  /* ---------- shell ---------- */
  const badge = el('span', { class: 'cb-badge', hidden: true });
  const btn = el('button', { type: 'button', class: 'cb-btn', 'aria-label': 'Messages', 'aria-expanded': 'false', html: icon.chat });
  btn.append(badge);
  const panel = el('section', { class: 'cb-panel mx', role: 'dialog', 'aria-label': 'Messages', hidden: true });
  const root = el('div', { class: 'cb' }, panel, btn);
  document.body.append(root);
  btn.addEventListener('click', () => toggle(!st.open));
  const onKey = (e) => {
    if (e.key !== 'Escape' || !st.open) return;
    if (st.view === 'thread' && !single()) back(); else { toggle(false); btn.focus(); }
  };
  document.addEventListener('keydown', onKey);

  function badgeUpdate() {
    const n = totalUnread();
    badge.hidden = !n;
    badge.textContent = n > 9 ? '9+' : n;
    btn.setAttribute('aria-label', n ? `Messages, ${n} unread` : 'Messages');
  }

  async function toggle(on) {
    st.open = on;
    panel.hidden = !on;
    btn.setAttribute('aria-expanded', String(on));
    root.classList.toggle('open', on);
    if (!on) return;
    if (!st.loaded) await load();
    if (single()) { st.view = 'thread'; st.cur = convos()[0].id; }
    render();
    if (st.view === 'thread') markRead(st.cur);
    if (!REDUCED) gsap.fromTo(panel, { y: 12, autoAlpha: 0, scale: 0.98 }, { y: 0, autoAlpha: 1, scale: 1, duration: 0.22, ease: 'power2.out', transformOrigin: '100% 100%' });
  }

  async function load() {
    const { data, error } = await supabase.from('contract_messages').select('*').order('created_at').limit(3000);
    if (error) { toast(`Couldn’t load messages: ${error.message}`, 'error'); return; }
    st.msgs = data || [];
    st.loaded = true;
    badgeUpdate();
  }

  /* ---------- views ---------- */
  function render() {
    if (st.view === 'thread' && st.cur && convos().some((c) => c.id === st.cur)) renderThread(); else renderList();
  }

  function renderList() {
    st.view = 'list';
    const list = convos().map((c) => {
      const t = threadOf(c.id);
      const last = t[t.length - 1];
      return { c, last, at: last ? new Date(last.created_at).getTime() : 0 };
    }).filter((x) => !st.q || [who(x.c), x.c.title, x.c.company].some((s) => s && s.toLowerCase().includes(st.q)))
      .sort((a, b) => b.at - a.at || a.c.title.localeCompare(b.c.title));
    const search = el('input', { type: 'search', class: 'mx-search', placeholder: owner ? 'Search clients…' : 'Search…', value: st.q, 'aria-label': 'Search conversations' });
    search.addEventListener('input', () => { st.q = search.value.trim().toLowerCase(); const pos = search.selectionStart; renderList(); const s = panel.querySelector('.mx-search'); s.focus(); s.setSelectionRange(pos, pos); });
    fill(panel,
      el('header', { class: 'mx-head' },
        el('h2', { text: 'Messages' }),
        el('button', { type: 'button', class: 'cb-close', 'aria-label': 'Close messages', html: '&times;', onclick: () => toggle(false) })),
      convos().length > 5 ? el('div', { class: 'mx-search-wrap' }, search) : null,
      list.length ? el('ul', { class: 'mx-list' }, list.map(({ c, last }) => {
        const n = unreadIn(c.id);
        const preview = isTyping(c.id) ? el('span', { class: 'mx-typing-text', text: 'typing…' })
          : last ? `${last.sender_id === me.id ? 'You: ' : ''}${last.body}` : owner ? 'No messages yet' : 'Say hello';
        return el('li', {}, el('button', { type: 'button', class: `mx-row${n ? ' unread' : ''}`, onclick: () => openThread(c.id) },
          el('span', { class: 'mx-av', text: initials(who(c)) }),
          el('span', { class: 'mx-row-main' },
            el('span', { class: 'mx-row-top' }, el('strong', { text: who(c) }), el('time', { text: last ? shortTime(last.created_at) : '' })),
            el('span', { class: 'mx-row-sub' }, el('span', { class: 'mx-proj', text: c.title })),
            el('span', { class: 'mx-row-bottom' }, el('span', { class: 'mx-preview' }, preview), n ? el('b', { class: 'mx-unread', text: n > 9 ? '9+' : n }) : null))));
      })) : el('p', { class: 'mx-empty', text: owner ? 'Conversations appear here, one per project.' : 'Your conversation with Landon shows up here once your project starts.' }));
  }

  let listEl = null, typingEl = null;
  function renderThread() {
    const c = convos().find((x) => x.id === st.cur);
    st.view = 'thread';
    listEl = el('ol', { class: 'chat-list cb-list mx-thread', 'aria-live': 'polite' });
    typingEl = el('li', { class: 'mx-typing', hidden: true, 'aria-label': `${who(c)} is typing` }, el('span', { class: 'mx-dots' }, el('i'), el('i'), el('i')));
    const box = el('textarea', { rows: 1, maxlength: 4000, placeholder: 'Message', 'aria-label': 'Message' });
    const send = el('button', { type: 'submit', class: 'chat-send mx-send', 'aria-label': 'Send', html: icon.send, disabled: true });
    box.addEventListener('input', () => {
      box.style.height = 'auto'; box.style.height = `${Math.min(box.scrollHeight, 120)}px`;
      send.disabled = !box.value.trim();
      sendTyping(c.id);
    });
    box.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); post(c.id, box, send); } });
    fill(panel,
      el('header', { class: 'mx-head thread' },
        single() ? null : el('button', { type: 'button', class: 'mx-back', 'aria-label': 'Back to messages', html: BACK, onclick: back }),
        el('span', { class: 'mx-av sm', text: initials(who(c)) }),
        el('div', { class: 'mx-title' }, el('strong', { text: who(c) }), el('small', { text: c.title })),
        el('button', { type: 'button', class: 'cb-close', 'aria-label': 'Close messages', html: '&times;', onclick: () => toggle(false) })),
      listEl,
      el('form', { class: 'chat-form cb-form mx-form', onsubmit: (e) => { e.preventDefault(); post(c.id, box, send); } }, box, send),
      owner && !c.client_id ? el('p', { class: 'chat-note cb-note', text: 'They’ll see this once they create their account.' }) : null);
    drawMessages();
    setTimeout(() => box.focus({ preventScroll: true }), 30);
  }

  function drawMessages() {
    if (!listEl) return;
    const t = threadOf(st.cur);
    const mineLast = [...t].reverse().find((m) => m.sender_id === me.id);
    const nodes = [];
    let lastDay = '';
    t.forEach((m, i) => {
      const d = new Date(m.created_at).toDateString();
      if (d !== lastDay) { nodes.push(el('li', { class: 'chat-day', text: dayLabel(m.created_at) })); lastDay = d; }
      const mine = m.sender_id === me.id;
      const next = t[i + 1];
      const tail = !next || next.sender_id !== m.sender_id || new Date(next.created_at).toDateString() !== d;   // last in a run
      nodes.push(el('li', { class: `mx-msg${mine ? ' mine' : ''}${tail ? ' tail' : ''}`, 'data-id': m.id },
        richText(m.body, 'p', { class: 'mx-bubble', title: fmtTime(m.created_at) }),
        tail ? el('span', { class: 'mx-meta', text: fmtTime(m.created_at) }) : null,
        mine && m === mineLast ? el('span', { class: `mx-receipt${m.read_at ? ' read' : ''}`, text: m.read_at ? `Read ${fmtTime(m.read_at)}` : 'Delivered' }) : null));
    });
    if (!t.length) nodes.push(el('li', { class: 'chat-empty', text: owner ? 'No messages yet. Say hello.' : 'Questions, feedback, links: send them here and Landon will reply.' }));
    nodes.push(typingEl);
    fill(listEl, nodes);
    typingEl.hidden = !isTyping(st.cur);
    listEl.scrollTop = listEl.scrollHeight;
  }

  function openThread(cid) {
    st.view = 'thread'; st.cur = cid;
    renderThread();
    markRead(cid);
  }
  function back() { st.view = 'list'; st.cur = null; listEl = null; renderList(); }

  async function markRead(cid) {
    const ids = st.msgs.filter((m) => m.contract_id === cid && m.sender_id !== me.id && !m.read_at);
    if (!ids.length) return;
    const now = new Date().toISOString();
    ids.forEach((m) => { m.read_at = now; });
    badgeUpdate();
    await supabase.from('contract_messages').update({ read_at: now }).eq('contract_id', cid).neq('sender_id', me.id).is('read_at', null);
    await supabase.from('notifications').update({ read_at: now }).eq('contract_id', cid).eq('kind', 'message').is('read_at', null);
    onRead?.();
  }

  async function post(cid, box, send) {
    const text = box.value.trim();
    if (!text) return;
    send.disabled = true;
    const { data, error } = await supabase.from('contract_messages').insert({ contract_id: cid, body: text }).select().single();
    if (error) { send.disabled = false; return toast(`Couldn’t send: ${error.message}`, 'error'); }
    box.value = ''; box.style.height = '';
    if (!st.msgs.some((m) => m.id === data.id)) st.msgs.push(data);
    drawMessages();
    box.focus();
  }

  /* ---------- typing: a broadcast per conversation ---------- */
  const typingChannels = new Map();
  let lastTypingSent = 0;
  function syncTypingChannels() {
    const want = new Set(convos().map((c) => c.id));
    for (const [cid, ch] of typingChannels) if (!want.has(cid)) { supabase.removeChannel(ch); typingChannels.delete(cid); }
    for (const cid of want) {
      if (typingChannels.has(cid)) continue;
      const ch = supabase.channel(`typing:${cid}`, { config: { broadcast: { self: false } } })
        .on('broadcast', { event: 'typing' }, ({ payload }) => {
          if (!payload || payload.from === me.id) return;
          st.typing.set(cid, Date.now());
          showTyping(cid);
          setTimeout(() => showTyping(cid), TYPING_TTL + 50);
        })
        .subscribe();
      typingChannels.set(cid, ch);
    }
  }
  function sendTyping(cid) {
    if (Date.now() - lastTypingSent < 2000) return;
    lastTypingSent = Date.now();
    typingChannels.get(cid)?.send({ type: 'broadcast', event: 'typing', payload: { from: me.id, name: myName.value } });
  }
  function showTyping(cid) {
    if (!st.open) return;
    if (st.view === 'thread' && st.cur === cid && typingEl) {
      const was = !typingEl.hidden;
      typingEl.hidden = !isTyping(cid);
      if (!typingEl.hidden && !was && listEl) listEl.scrollTop = listEl.scrollHeight;
    } else if (st.view === 'list') renderList();
  }

  /* ---------- live messages + read receipts ---------- */
  const channel = supabase.channel(`msgr-${me.id}-${Math.random().toString(36).slice(2, 7)}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'contract_messages' }, ({ new: m }) => {
      if (st.msgs.some((x) => x.id === m.id)) return;
      st.msgs.push(m);
      st.typing.delete(m.contract_id);
      const viewing = st.open && st.view === 'thread' && st.cur === m.contract_id;
      if (viewing) { drawMessages(); if (m.sender_id !== me.id) markRead(m.contract_id); }
      else if (st.open && st.view === 'list') renderList();
      if (m.sender_id !== me.id && !viewing) {
        badgeUpdate();
        if (!REDUCED) gsap.fromTo(btn, { scale: 0.85 }, { scale: 1, duration: 0.6, ease: 'elastic.out(1, 0.4)' });
      }
    })
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'contract_messages' }, ({ new: m }) => {
      const x = st.msgs.find((y) => y.id === m.id);
      if (!x) return;
      x.read_at = m.read_at;
      if (st.open && st.view === 'thread' && st.cur === m.contract_id) drawMessages();
      badgeUpdate();
    })
    .subscribe();

  load();
  syncTypingChannels();

  return {
    /** open the messenger (optionally straight into one project's conversation) */
    open: async (cid) => {
      if (!st.open) await toggle(true);
      if (cid && convos().some((c) => c.id === cid)) openThread(cid);
    },
    refresh: () => { syncTypingChannels(); badgeUpdate(); if (st.open) render(); },
    destroy: () => {
      supabase.removeChannel(channel);
      for (const ch of typingChannels.values()) supabase.removeChannel(ch);
      document.removeEventListener('keydown', onKey);
      root.remove();
    },
  };
}

function shortTime(iso) {
  const d = new Date(iso), now = new Date();
  if (d.toDateString() === now.toDateString()) return fmtTime(iso);
  const y = new Date(now); y.setDate(now.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return 'Yesterday';
  if (now - d < 6 * 86400000) return d.toLocaleDateString(undefined, { weekday: 'short' });
  return d.toLocaleDateString(undefined, { month: 'numeric', day: 'numeric', year: '2-digit' });
}
function dayLabel(iso) {
  const d = new Date(iso), now = new Date();
  if (d.toDateString() === now.toDateString()) return 'Today';
  const y = new Date(now); y.setDate(now.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return 'Yesterday';
  return fmtDate(iso, { weekday: 'short', month: 'short', day: 'numeric' });
}
