/* =====================================================================
   Messages — a phone-style messenger in the bottom-right corner.
     · Inbox: every conversation (one per project), most recent first,
       with the last message, time and an unread count.
     · Tap one to open the thread; ‹ goes back to the inbox.
     · Group accounts are a group chat: Landon and everyone on the
       account, names over each person's messages, "Seen by …" receipts.
     · Opening a thread marks it read (chat_reads: one "read up to" time
       per person); your last message shows Delivered / Read / Seen by.
     · A typing bubble (•••) shows while someone is writing.
   Owners get the inbox on every page. A client with a single project
   goes straight into that conversation.
   ===================================================================== */
import { gsap } from 'gsap';
import { supabase } from '../supabase.js';
import { el, fill, REDUCED, toast, fmtDate, fmtTime, initials, richText, icon } from './util.js';

const BACK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>';
const TYPING_TTL = 4000;
const first = (n = '') => n.trim().split(/\s+/)[0] || n;

export function messenger({ me, owner, getContracts, onRead }) {
  const st = { open: false, view: 'list', cur: null, msgs: [], reads: [], accts: new Map(), members: [], names: new Map(), loaded: false, typing: new Map(), q: '' };
  const myName = { value: '' };
  supabase.from('profiles').select('full_name').eq('id', me.id).maybeSingle().then(({ data }) => { myName.value = data?.full_name || ''; });

  const convos = () => (getContracts() || []).filter((c) => c.status !== 'lost');
  const single = () => !owner && convos().length === 1;
  const acctOf = (c) => (c.account_id ? st.accts.get(c.account_id) : null);
  const peopleOf = (c) => st.members.filter((m) => m.account_id === c.account_id);
  const isGroup = (c) => acctOf(c)?.kind === 'group';
  const who = (c) => (isGroup(c) ? acctOf(c).name : owner ? c.client_name || acctOf(c)?.name || c.client_email || 'Client' : 'Landon Williams');
  const subOf = (c) => (isGroup(c) ? `${c.title} · ${peopleOf(c).length + 1} people` : c.title);
  const threadOf = (cid) => st.msgs.filter((m) => m.contract_id === cid);
  const readAt = (cid, uid) => st.reads.find((r) => r.contract_id === cid && r.user_id === uid)?.read_at || null;
  const unreadIn = (cid) => { const r = readAt(cid, me.id); return st.msgs.filter((m) => m.contract_id === cid && m.sender_id !== me.id && (!r || m.created_at > r)).length; };
  const totalUnread = () => convos().reduce((n, c) => n + unreadIn(c.id), 0);
  const typers = (cid) => [...(st.typing.get(cid) || new Map()).values()].filter((t) => t.at > Date.now() - TYPING_TTL);
  const isTyping = (cid) => typers(cid).length > 0;
  const nameOf = (uid) => st.names.get(uid) || '';

  const avatar = (c, cls = '') => {
    if (!isGroup(c)) return el('span', { class: `mx-av ${cls}`, text: initials(who(c)) });
    const ppl = peopleOf(c).slice(0, 2);
    return el('span', { class: `mx-av-group ${cls}` }, ppl.map((p) => el('span', { class: 'mx-av', text: initials(p.name || p.email) })));
  };

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
    const [msgs, reads, accts, members, names] = await Promise.all([
      supabase.from('contract_messages').select('*').order('created_at').limit(3000),
      supabase.from('chat_reads').select('*'),
      supabase.from('client_accounts').select('id, name, kind'),
      supabase.from('account_members').select('id, account_id, name, email, user_id'),
      supabase.from('profiles').select('id, full_name, email, role'),
    ]);
    if (msgs.error) { toast(`Couldn’t load messages: ${msgs.error.message}`, 'error'); return; }
    st.msgs = msgs.data || [];
    st.reads = reads.data || [];
    st.accts = new Map((accts.data || []).map((a) => [a.id, a]));
    st.members = members.data || [];
    st.names = new Map((names.data || []).map((p) => [p.id, p.full_name || p.email]));
    st.owners = (names.data || []).filter((p) => p.role === 'owner').map((p) => p.id);
    for (const m of st.members) if (m.user_id && m.name && !st.names.get(m.user_id)) st.names.set(m.user_id, m.name);
    st.loaded = true;
    badgeUpdate();
  }

  /* ---------- views ---------- */
  function render() {
    if (st.view === 'thread' && st.cur && convos().some((c) => c.id === st.cur)) renderThread(); else renderList();
  }

  const typingLabel = (c) => {
    const t = typers(c.id);
    if (!isGroup(c) || !t.length) return 'typing…';
    return t.length > 1 ? 'several people are typing…' : `${first(t[0].name || 'Someone')} is typing…`;
  };

  function renderList() {
    st.view = 'list';
    const list = convos().map((c) => {
      const t = threadOf(c.id);
      const last = t[t.length - 1];
      return { c, last, at: last ? new Date(last.created_at).getTime() : 0 };
    }).filter((x) => !st.q || [who(x.c), x.c.title, x.c.company, ...peopleOf(x.c).map((p) => p.name)].some((s) => s && s.toLowerCase().includes(st.q)))
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
        const from = last && (last.sender_id === me.id ? 'You: ' : isGroup(c) ? `${first(last.sender_name || nameOf(last.sender_id))}: ` : '');
        const preview = isTyping(c.id) ? el('span', { class: 'mx-typing-text', text: typingLabel(c) })
          : last ? `${from}${last.body}` : owner ? 'No messages yet' : 'Say hello';
        return el('li', {}, el('button', { type: 'button', class: `mx-row${n ? ' unread' : ''}`, onclick: () => openThread(c.id) },
          avatar(c),
          el('span', { class: 'mx-row-main' },
            el('span', { class: 'mx-row-top' }, el('strong', { text: who(c) }), el('time', { text: last ? shortTime(last.created_at) : '' })),
            el('span', { class: 'mx-row-sub' }, el('span', { class: 'mx-proj', text: subOf(c) })),
            el('span', { class: 'mx-row-bottom' }, el('span', { class: 'mx-preview' }, preview), n ? el('b', { class: 'mx-unread', text: n > 9 ? '9+' : n }) : null))));
      })) : el('p', { class: 'mx-empty', text: owner ? 'Conversations appear here, one per project.' : 'Your conversation with Landon shows up here once your project starts.' }));
  }

  let listEl = null, typingEl = null;
  function renderThread() {
    const c = convos().find((x) => x.id === st.cur);
    st.view = 'thread';
    listEl = el('ol', { class: `chat-list cb-list mx-thread${isGroup(c) ? ' group' : ''}`, 'aria-live': 'polite' });
    typingEl = el('li', { class: 'mx-typing', hidden: true },
      el('small', { class: 'mx-typing-who' }), el('span', { class: 'mx-dots' }, el('i'), el('i'), el('i')));
    const box = el('textarea', { rows: 1, maxlength: 4000, placeholder: isGroup(c) ? `Message ${who(c)}` : 'Message', 'aria-label': 'Message' });
    const send = el('button', { type: 'submit', class: 'chat-send mx-send', 'aria-label': 'Send', html: icon.send, disabled: true });
    box.addEventListener('input', () => {
      box.style.height = 'auto'; box.style.height = `${Math.min(box.scrollHeight, 120)}px`;
      send.disabled = !box.value.trim();
      sendTyping(c.id);
    });
    box.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); post(c.id, box, send); } });
    const ppl = peopleOf(c);
    const waiting = owner ? (isGroup(c) ? ppl.filter((p) => !p.user_id).length : c.client_id ? 0 : 1) : 0;
    fill(panel,
      el('header', { class: 'mx-head thread' },
        single() ? null : el('button', { type: 'button', class: 'mx-back', 'aria-label': 'Back to messages', html: BACK, onclick: back }),
        avatar(c, 'sm'),
        el('div', { class: 'mx-title' }, el('strong', { text: who(c) }),
          el('small', { text: isGroup(c) ? ['Landon', ...ppl.map((p) => first(p.name || p.email.split('@')[0]))].filter((n, i, a) => a.indexOf(n) === i).join(', ') : c.title, title: subOf(c) })),
        el('button', { type: 'button', class: 'cb-close', 'aria-label': 'Close messages', html: '&times;', onclick: () => toggle(false) })),
      listEl,
      el('form', { class: 'chat-form cb-form mx-form', onsubmit: (e) => { e.preventDefault(); post(c.id, box, send); } }, box, send),
      waiting ? el('p', { class: 'chat-note cb-note', text: isGroup(c) ? `${waiting} ${waiting === 1 ? 'person hasn’t' : 'people haven’t'} signed up yet; they’ll see this when they do.` : 'They’ll see this once they create their account.' }) : null);
    drawMessages();
    setTimeout(() => box.focus({ preventScroll: true }), 30);
  }

  /** Who has read up to this message (everyone but the sender). */
  function receipt(c, m) {
    const others = st.reads.filter((r) => r.contract_id === c.id && r.user_id !== me.id && r.read_at >= m.created_at);
    if (!isGroup(c)) {
      const r = others.sort((a, b) => a.read_at.localeCompare(b.read_at))[0];
      return r ? ['read', `Read ${fmtTime(r.read_at)}`] : ['', 'Delivered'];
    }
    // everyone in the group chat: the account's people who've joined, plus Landon
    const audience = new Set([...peopleOf(c).filter((p) => p.user_id).map((p) => p.user_id), ...(st.owners || [])]);
    audience.delete(me.id);
    const seen = others.map((r) => r.user_id).filter((u) => audience.has(u));
    if (!seen.length) return ['', 'Delivered'];
    if (seen.length >= audience.size) return ['read', 'Seen by everyone'];
    const names = seen.map((u) => first(nameOf(u) || 'Someone'));
    return ['read', `Seen by ${names.length > 2 ? `${names.slice(0, 2).join(', ')} +${names.length - 2}` : names.join(' & ')}`];
  }

  function drawMessages() {
    if (!listEl) return;
    const c = convos().find((x) => x.id === st.cur);
    if (!c) return;
    const group = isGroup(c);
    const t = threadOf(st.cur);
    const mineLast = [...t].reverse().find((m) => m.sender_id === me.id);
    const nodes = [];
    let lastDay = '';
    t.forEach((m, i) => {
      const d = new Date(m.created_at).toDateString();
      const newDay = d !== lastDay;
      if (newDay) { nodes.push(el('li', { class: 'chat-day', text: dayLabel(m.created_at) })); lastDay = d; }
      const mine = m.sender_id === me.id;
      const prev = t[i - 1], next = t[i + 1];
      const head = newDay || !prev || prev.sender_id !== m.sender_id;                                                   // first in a run
      const tail = !next || next.sender_id !== m.sender_id || new Date(next.created_at).toDateString() !== d;   // last in a run
      const [rcls, rtext] = mine && m === mineLast ? receipt(c, m) : [];
      nodes.push(el('li', { class: `mx-msg${mine ? ' mine' : ''}${tail ? ' tail' : ''}${group && !mine ? ' has-av' : ''}`, 'data-id': m.id },
        group && !mine && head ? el('span', { class: 'mx-sender', text: m.sender_role === 'owner' ? 'Landon' : first(m.sender_name || nameOf(m.sender_id) || 'Client') }) : null,
        el('div', { class: 'mx-line' },
          group && !mine ? (tail ? el('span', { class: 'mx-av xs', text: initials(m.sender_name || nameOf(m.sender_id) || '?') }) : el('span', { class: 'mx-av-space' })) : null,
          richText(m.body, 'p', { class: 'mx-bubble', title: fmtTime(m.created_at) })),
        tail ? el('span', { class: 'mx-meta', text: fmtTime(m.created_at) }) : null,
        rtext ? el('span', { class: `mx-receipt ${rcls}`, text: rtext }) : null));
    });
    if (!t.length) nodes.push(el('li', { class: 'chat-empty', text: group ? `This is the group chat for ${who(c)}. Every message goes to everyone here.` : owner ? 'No messages yet. Say hello.' : 'Questions, feedback, links: send them here and Landon will reply.' }));
    nodes.push(typingEl);
    fill(listEl, nodes);
    showTypingIn(c);
    listEl.scrollTop = listEl.scrollHeight;
  }
  function showTypingIn(c) {
    if (!typingEl) return;
    const on = isTyping(c.id);
    typingEl.hidden = !on;
    typingEl.querySelector('.mx-typing-who').textContent = on && isGroup(c) ? typingLabel(c).replace('…', '') : '';
  }

  function openThread(cid) {
    st.view = 'thread'; st.cur = cid;
    renderThread();
    markRead(cid);
  }
  function back() { st.view = 'list'; st.cur = null; listEl = null; renderList(); }

  async function markRead(cid) {
    const t = threadOf(cid);
    const last = t[t.length - 1];
    const mine = readAt(cid, me.id);
    if (!last || (mine && mine >= last.created_at)) return;
    const now = new Date().toISOString();
    const row = st.reads.find((r) => r.contract_id === cid && r.user_id === me.id);
    if (row) row.read_at = now; else st.reads.push({ contract_id: cid, user_id: me.id, read_at: now });
    badgeUpdate();
    await supabase.from('chat_reads').upsert({ contract_id: cid, user_id: me.id, read_at: now });
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
          if (!st.typing.has(cid)) st.typing.set(cid, new Map());
          st.typing.get(cid).set(payload.from, { at: Date.now(), name: payload.name || nameOf(payload.from) });
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
    const c = convos().find((x) => x.id === cid);
    if (!c) return;
    if (st.view === 'thread' && st.cur === cid && typingEl) {
      const was = !typingEl.hidden;
      showTypingIn(c);
      if (!typingEl.hidden && !was && listEl) listEl.scrollTop = listEl.scrollHeight;
    } else if (st.view === 'list') renderList();
  }

  /* ---------- live messages + read receipts ---------- */
  const onReadRow = ({ new: r }) => {
    if (!r?.contract_id) return;
    const x = st.reads.find((y) => y.contract_id === r.contract_id && y.user_id === r.user_id);
    if (x) x.read_at = r.read_at; else st.reads.push(r);
    if (st.open && st.view === 'thread' && st.cur === r.contract_id) drawMessages();
    badgeUpdate();
  };
  const channel = supabase.channel(`msgr-${me.id}-${Math.random().toString(36).slice(2, 7)}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'contract_messages' }, ({ new: m }) => {
      if (st.msgs.some((x) => x.id === m.id)) return;
      st.msgs.push(m);
      st.typing.get(m.contract_id)?.delete(m.sender_id);
      const viewing = st.open && st.view === 'thread' && st.cur === m.contract_id;
      if (viewing) { drawMessages(); if (m.sender_id !== me.id) markRead(m.contract_id); }
      else if (st.open && st.view === 'list') renderList();
      if (m.sender_id !== me.id && !viewing) {
        badgeUpdate();
        if (!REDUCED) gsap.fromTo(btn, { scale: 0.85 }, { scale: 1, duration: 0.6, ease: 'elastic.out(1, 0.4)' });
      }
    })
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_reads' }, onReadRow)
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'chat_reads' }, onReadRow)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'account_members' }, async () => { await load(); if (st.open) render(); })
    .subscribe();

  load();
  syncTypingChannels();

  return {
    /** open the messenger (optionally straight into one project's conversation) */
    open: async (cid) => {
      if (!st.open) await toggle(true);
      if (cid && convos().some((c) => c.id === cid)) openThread(cid);
    },
    refresh: async () => { syncTypingChannels(); if (st.loaded) await load(); badgeUpdate(); if (st.open) render(); },
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
