/* =====================================================================
   Tickets — a client's requests (changes, bugs, questions, features),
   with files, a thread for back-and-forth, and (owners) one click to add
   a ticket to the contract's scope of work.
   Files live in the private "ticket-files" bucket, one folder per ticket,
   and are opened through short-lived signed links.
   ===================================================================== */
import { gsap } from 'gsap';
import { supabase } from '../supabase.js';
import {
  el, REDUCED, toast, modal, field, timeAgo, fmtTime, fmtDate, initials, icon, fill, add,
  armedButton, richText, formatBytes, money,
} from './util.js';

export const BUCKET = 'ticket-files';
export const T_STATUS = { open: 'Open', in_progress: 'In progress', waiting: 'Waiting on client', resolved: 'Resolved', closed: 'Closed' };
const T_STATUS_CLIENT = { ...T_STATUS, waiting: 'Waiting on you' };
export const T_KIND = { change: 'Change request', bug: 'Something’s broken', question: 'Question', feature: 'New feature', other: 'Other' };
export const T_PRIORITY = { low: 'Low', normal: 'Normal', high: 'High', urgent: 'Urgent' };
export const OPEN_STATES = ['open', 'in_progress', 'waiting'];
const MAX = 25 * 1024 * 1024;

export const ticketPill = (s, owner = true) => el('span', { class: `tk-pill tk-${s}`, text: (owner ? T_STATUS : T_STATUS_CLIENT)[s] || s });
const clip = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>';

/* ---------- files ---------- */
export async function uploadFiles(ticketId, files) {
  const out = [];
  for (const f of files) {
    if (f.size > MAX) { toast(`${f.name} is over 25 MB`, 'error'); continue; }
    const safe = f.name.replace(/[^\w.\-]+/g, '_').slice(-100) || 'file';
    const path = `${ticketId}/${crypto.randomUUID().slice(0, 8)}-${safe}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, f, { contentType: f.type || 'application/octet-stream', upsert: false });
    if (error) { toast(`Couldn’t upload ${f.name}: ${error.message}`, 'error'); continue; }
    out.push({ path, name: f.name, size: f.size, type: f.type || '' });
  }
  return out;
}

/** A list of attached files; links are signed once it's on the page. */
export function fileList(files = []) {
  if (!files.length) return null;
  const ul = el('ul', { class: 'tk-files' }, files.map((f) => el('li', { 'data-path': f.path },
    el('a', { class: 'tk-file', target: '_blank', rel: 'noopener', 'aria-disabled': 'true' },
      el('span', { class: 'tk-thumb' }, el('span', { class: 'tk-ext', text: (f.name.split('.').pop() || 'file').slice(0, 4) })),
      el('span', { class: 'tk-file-info' }, el('span', { class: 'tk-file-name', text: f.name, title: f.name }), el('small', { text: formatBytes(f.size) }))))));
  supabase.storage.from(BUCKET).createSignedUrls(files.map((f) => f.path), 60 * 60).then(({ data }) => {
    (data || []).forEach((d, i) => {
      const a = ul.children[i]?.querySelector('a');
      if (!a || !d.signedUrl) return;
      a.href = d.signedUrl; a.removeAttribute('aria-disabled');
      if ((files[i].type || '').startsWith('image/')) a.querySelector('.tk-thumb').replaceChildren(el('img', { src: d.signedUrl, alt: '', loading: 'lazy' }));
    });
  });
  return ul;
}

/** "Attach files" button + drop zone + chips you can remove. */
function filePicker() {
  let picked = [];
  const input = el('input', { type: 'file', multiple: true, hidden: true });
  const chips = el('ul', { class: 'tk-chips' });
  const render = () => fill(chips, picked.map((f, i) => el('li', {},
    el('span', { text: `${f.name} · ${formatBytes(f.size)}` }),
    el('button', { type: 'button', 'aria-label': `Remove ${f.name}`, html: '&times;', onclick: () => { picked.splice(i, 1); render(); } }))));
  const addFiles = (list) => { for (const f of list) { if (f.size > MAX) toast(`${f.name} is over 25 MB`, 'error'); else picked.push(f); } render(); };
  input.addEventListener('change', () => { addFiles(input.files); input.value = ''; });
  const zone = el('div', { class: 'tk-drop' },
    el('button', { type: 'button', class: 'btn btn-ghost btn-sm tk-attach', html: `${clip}<span>Attach files</span>`, onclick: () => input.click() }),
    el('small', { text: 'or drop them here · up to 25 MB each' }), input, chips);
  zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('over'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('over'));
  zone.addEventListener('drop', (e) => { e.preventDefault(); zone.classList.remove('over'); addFiles(e.dataTransfer.files); });
  return { node: zone, get files() { return picked; }, clear() { picked = []; render(); } };
}

/* =====================================================================
   New ticket
   ===================================================================== */
export function ticketForm({ contracts = [], contractId = null, owner = false, onCreated } = {}) {
  const f = el('form', { class: 'crm-form', novalidate: true });
  const usable = contracts.filter((c) => c.status !== 'lost');
  const contractSel = el('select', { name: 'contract_id' },
    owner || !usable.length ? el('option', { value: '', text: owner ? '— Choose a contract —' : 'General (no project yet)' }) : null,
    usable.map((c) => el('option', { value: c.id, text: c.title, selected: c.id === contractId ? true : null })));
  const title = el('input', { name: 'title', maxlength: 160, required: true, placeholder: owner ? 'e.g. Add a gallery page' : 'Short summary, e.g. “Add a gallery page”' });
  const kind = el('select', { name: 'kind' }, Object.entries(T_KIND).map(([k, v]) => el('option', { value: k, text: v })));
  const prio = el('select', { name: 'priority' }, Object.entries(T_PRIORITY).map(([k, v]) => el('option', { value: k, text: v, selected: k === 'normal' ? true : null })));
  const body = el('textarea', { name: 'body', rows: 6, maxlength: 8000, placeholder: 'What do you need? Links, examples, and screenshots all help.' });
  const picker = filePicker();
  const msg = el('p', { class: 'crm-form-msg', role: 'alert', hidden: true });
  add(f,
    usable.length > 1 || owner ? field('Project', contractSel) : null,
    field('Title', title),
    el('div', { class: 'crm-form-row' }, field('Type', kind), field('Priority', prio)),
    field('Details', body),
    picker.node, msg,
    el('div', { class: 'crm-form-actions' }, el('button', { type: 'submit', class: 'btn btn-primary', text: owner ? 'Create ticket' : 'Send request' })));
  const m = modal(owner ? 'New ticket' : 'New request', f, { wide: true });

  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    const say = (t) => { msg.textContent = t; msg.hidden = !t; };
    if (!title.value.trim()) return say('Give it a short title.');
    const cid = (usable.length > 1 || owner) ? contractSel.value || null : usable[0]?.id || null;
    if (owner && !cid) return say('Choose which contract this is for.');
    const btn = f.querySelector('button[type=submit]');
    btn.disabled = true; btn.textContent = picker.files.length ? 'Uploading…' : 'Sending…';
    const row = { contract_id: cid, title: title.value.trim(), body: body.value.trim() || null, kind: kind.value, priority: prio.value };
    if (owner) row.client_id = null;   // filled in from the contract by the database
    const { data: t, error } = await supabase.from('tickets').insert(row).select().single();
    if (error) { btn.disabled = false; btn.textContent = 'Try again'; return say(error.message); }
    let ticket = t;
    if (picker.files.length) {
      const files = await uploadFiles(t.id, picker.files);
      if (files.length) {
        const res = await supabase.from('tickets').update({ files }).eq('id', t.id).select().single();
        if (!res.error) ticket = res.data;
      }
    }
    m.close();
    toast(owner ? `Ticket #${ticket.number} created` : 'Request sent. Landon will reply here.');
    onCreated?.(ticket);
  });
  return m;
}

/* =====================================================================
   One ticket: details, files, thread
   opts: { id, owner, me, contracts, onBack?, onChanged?, onDeleted?, onRead? }
   ===================================================================== */
export async function ticketView(root, opts) {
  const { id, owner } = opts;
  fill(root, el('div', { class: 'cv-loading', text: 'Loading…' }));
  const [t, msgs] = await Promise.all([
    supabase.from('tickets').select('*').eq('id', id).maybeSingle(),
    supabase.from('ticket_messages').select('*').eq('ticket_id', id).order('created_at'),
  ]);
  if (t.error || !t.data) {
    fill(root, el('div', { class: 'cv-missing' }, el('h2', { text: 'This ticket isn’t available.' }),
      opts.onBack ? el('button', { type: 'button', class: 'btn btn-ghost btn-sm', text: '← Back', onclick: opts.onBack }) : null));
    return () => {};
  }
  const s = { t: t.data, msgs: msgs.data || [] };
  const head = el('div');
  const about = el('section', { class: 'tk-about' });
  const list = el('ol', { class: 'chat-list tk-thread', 'aria-live': 'polite' });
  const picker = filePicker();
  const box = el('textarea', { rows: 1, maxlength: 4000, placeholder: owner ? 'Reply to the client…' : 'Reply to Landon…', 'aria-label': 'Reply' });
  const send = el('button', { type: 'submit', class: 'chat-send', 'aria-label': 'Send', html: icon.send });
  const form = el('form', { class: 'tk-compose', onsubmit: (e) => { e.preventDefault(); reply(); } }, el('div', { class: 'chat-form' }, box, send), picker.node);
  box.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); reply(); } });
  box.addEventListener('input', () => { box.style.height = 'auto'; box.style.height = `${Math.min(box.scrollHeight, 160)}px`; });

  fill(root, el('article', { class: 'tk' }, head, about, el('section', { class: 'tk-convo cv-card' },
    el('div', { class: 'cv-card-head' }, el('h2', { text: 'Conversation' }), el('span', { class: 'live on mono' }, el('i'), 'Live')), list, form)));

  const contractOf = () => (opts.contracts || []).find((c) => c.id === s.t.contract_id);

  async function save(patch, say) {
    const { data, error } = await supabase.from('tickets').update(patch).eq('id', id).select().single();
    if (error) { toast(`Couldn’t save: ${error.message}`, 'error'); return null; }
    s.t = data; renderHead(); opts.onChanged?.(data);
    if (say) toast(say);
    return data;
  }

  function renderHead() {
    const tk = s.t, c = contractOf();
    fill(head, el('header', { class: 'cv-head' },
      opts.onBack ? el('button', { type: 'button', class: 'cv-back', onclick: opts.onBack, text: '← All tickets' }) : null,
      el('div', { class: 'cv-head-row' },
        el('div', { class: 'cv-title' },
          el('p', { class: 'cv-kicker mono', text: `Ticket #${tk.number}${c ? ` · ${c.title}` : ''}` }),
          el('h1', { text: tk.title }),
          el('div', { class: 'cv-meta' }, ticketPill(tk.status, owner),
            el('span', { class: 'tk-tag', text: T_KIND[tk.kind] }),
            el('span', { class: `tk-tag pr-${tk.priority}`, text: `${T_PRIORITY[tk.priority]} priority` }),
            tk.sow_added_at ? el('span', { class: 'tk-tag in-sow', text: '✓ In scope of work' }) : null,
            el('span', { class: 'muted-sm', text: `Opened ${timeAgo(tk.created_at)}` }))),
        owner ? el('div', { class: 'cv-actions' },
          el('select', { class: 'status-select', 'aria-label': 'Status', onchange: (e) => save({ status: e.target.value }, `Status set to ${T_STATUS[e.target.value]}`) },
            Object.entries(T_STATUS).map(([k, v]) => el('option', { value: k, text: v, selected: k === tk.status ? true : null }))),
          tk.sow_added_at
            ? el('span', { class: 'tk-sow-done', text: '✓ Added to SOW' })
            : el('button', { type: 'button', class: 'btn btn-primary btn-sm', text: 'Add to SOW', onclick: () => addToSow(s.t, { contracts: opts.contracts || [], onDone: (tk2) => { s.t = tk2; renderHead(); opts.onChanged?.(tk2); } }) }),
          c ? el('a', { class: 'btn btn-ghost btn-sm', href: `#contract/${c.id}`, text: 'Contract →' }) : null,
          armedButton('Delete', 'Click again to delete', async () => {
            if (tk.files?.length || s.msgs.some((m) => m.files?.length)) {
              const paths = [...(tk.files || []), ...s.msgs.flatMap((m) => m.files || [])].map((f) => f.path);
              await supabase.storage.from(BUCKET).remove(paths);
            }
            const { error } = await supabase.from('tickets').delete().eq('id', id);
            if (error) return toast(`Couldn’t delete: ${error.message}`, 'error');
            toast('Ticket deleted'); opts.onDeleted?.();
          }, 'btn btn-ghost btn-sm danger')) : null)));
  }

  function renderAbout() {
    const tk = s.t;
    fill(about, el('div', { class: 'cv-card' },
      el('div', { class: 'cv-card-head' }, el('h2', { text: 'Request' }), el('span', { class: 'muted-sm', text: fmtDate(tk.created_at, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) })),
      tk.body ? richText(tk.body, 'div', { class: 'cv-scope' }) : el('p', { class: 'cv-empty', text: 'No details given.' }),
      fileList(tk.files)));
  }

  function renderThread(scroll = true) {
    if (!s.msgs.length) {
      fill(list, el('li', { class: 'chat-empty', text: owner ? 'No replies yet. Answer the client here.' : 'Landon will reply here. You can add more details or files any time.' }));
      return;
    }
    let lastDay = '';
    const nodes = [];
    for (const m of s.msgs) {
      const d = new Date(m.created_at).toDateString();
      if (d !== lastDay) { nodes.push(el('li', { class: 'chat-day', text: fmtDate(m.created_at, { weekday: 'short', month: 'short', day: 'numeric' }) })); lastDay = d; }
      if (m.kind === 'system') {
        nodes.push(el('li', { class: 'tk-sys' }, el('span', { text: `${m.body} · ${fmtTime(m.created_at)}` }), fileList(m.files)));
        continue;
      }
      const mine = m.sender_id === opts.me.id;
      nodes.push(el('li', { class: `chat-msg${mine ? ' mine' : ''}`, 'data-id': m.id },
        mine ? null : el('span', { class: 'chat-av', text: initials(m.sender_name) }),
        el('div', {},
          m.body ? richText(m.body, 'p', { class: 'chat-bubble' }) : null,
          fileList(m.files),
          el('span', { class: 'chat-meta', text: `${mine ? 'You' : m.sender_name} · ${fmtTime(m.created_at)}` }))));
    }
    fill(list, nodes);
    if (scroll) list.scrollTop = list.scrollHeight;
  }

  async function reply() {
    const body = box.value.trim();
    if (!body && !picker.files.length) return;
    send.disabled = true;
    const files = picker.files.length ? await uploadFiles(id, picker.files) : [];
    if (!body && !files.length) { send.disabled = false; return; }
    const { data, error } = await supabase.from('ticket_messages').insert({ ticket_id: id, body, files }).select().single();
    send.disabled = false;
    if (error) return toast(`Couldn’t send: ${error.message}`, 'error');
    box.value = ''; box.style.height = ''; picker.clear();
    if (!s.msgs.some((m) => m.id === data.id)) { s.msgs.push(data); renderThread(); }
    box.focus();
  }

  renderHead(); renderAbout(); renderThread();
  supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('ticket_id', id).is('read_at', null).then(() => opts.onRead?.());

  const channel = supabase.channel(`ticket-${id}-${Math.random().toString(36).slice(2, 8)}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ticket_messages', filter: `ticket_id=eq.${id}` }, ({ new: m }) => {
      if (s.msgs.some((x) => x.id === m.id)) return;
      s.msgs.push(m); renderThread();
      const node = list.querySelector(`[data-id="${m.id}"]`);
      if (node && !REDUCED) gsap.from(node, { y: 10, autoAlpha: 0, duration: 0.35, ease: 'power3.out' });
      if (m.sender_id !== opts.me.id) supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('ticket_id', id).is('read_at', null).then(() => opts.onRead?.());
    })
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tickets', filter: `id=eq.${id}` }, ({ new: tk }) => { s.t = tk; renderHead(); renderAbout(); })
    .subscribe();
  return () => supabase.removeChannel(channel);
}

/* =====================================================================
   Add a ticket to a contract's scope of work (owners)
   ===================================================================== */
export function addToSow(ticket, { contracts = [], onDone } = {}) {
  const usable = contracts.filter((c) => c.status !== 'lost');
  const f = el('form', { class: 'crm-form', novalidate: true });
  const contractSel = el('select', { name: 'contract' },
    el('option', { value: '', text: '— Choose a contract —' }),
    usable.map((c) => el('option', { value: c.id, text: `${c.title}${c.company ? ` · ${c.company}` : ''}`, selected: c.id === ticket.contract_id ? true : null })));
  const item = el('input', { name: 'item', maxlength: 200, value: ticket.title });
  const addScope = el('input', { type: 'checkbox', checked: true });
  const details = el('textarea', { rows: 4, maxlength: 4000 });
  details.value = ticket.body || '';
  const delta = el('input', { type: 'number', step: 50, placeholder: '0', inputmode: 'decimal' });
  const msg = el('p', { class: 'crm-form-msg', role: 'alert', hidden: true });
  add(f,
    el('p', { text: 'Adds this request to the contract as a deliverable, and (if you like) writes it into the scope of work. The client sees it on their page and is told.' }),
    field('Contract', contractSel),
    field('Deliverable', item),
    el('label', { class: 'crm-check' }, addScope, el('span', { text: 'Also add the details to the scope of work' })),
    field('Details for the scope', details),
    field('Price change (USD)', delta, 'Optional. Added to the contract price, e.g. 250. Use a minus to lower it.'),
    msg,
    el('div', { class: 'crm-form-actions' }, el('button', { type: 'submit', class: 'btn btn-primary', text: 'Add to scope of work' })));
  addScope.addEventListener('change', () => { details.closest('.crm-field').hidden = !addScope.checked; });
  const m = modal(`Add ticket #${ticket.number} to the SOW`, f, { wide: true });

  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    const say = (t) => { msg.textContent = t; msg.hidden = !t; };
    if (!contractSel.value) return say('Choose the contract it belongs to.');
    if (!item.value.trim()) return say('Name the deliverable.');
    const btn = f.querySelector('button[type=submit]'); btn.disabled = true;
    const { data: c, error: e1 } = await supabase.from('contracts').select('*').eq('id', contractSel.value).single();
    if (e1) { btn.disabled = false; return say(e1.message); }
    const deliverables = [...(c.deliverables || []), { text: item.value.trim(), done: false, ticket: ticket.number }];
    const patch = {
      deliverables,
      progress: c.status === 'complete' ? 100 : Math.round((deliverables.filter((d) => d.done).length / deliverables.length) * 100),
    };
    if (addScope.checked) {
      const when = new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
      const extra = `Added from ticket #${ticket.number} (${when}): ${item.value.trim()}${details.value.trim() ? `\n${details.value.trim()}` : ''}`;
      patch.scope = c.scope ? `${c.scope}\n\n${extra}` : extra;
    }
    const d = Number(delta.value);
    if (d) patch.value = Math.max(0, Number(c.value) + d);
    const { error: e2 } = await supabase.from('contracts').update(patch).eq('id', c.id);
    if (e2) { btn.disabled = false; return say(e2.message); }
    const { data: tk, error: e3 } = await supabase.from('tickets').update({
      sow_added_at: new Date().toISOString(), contract_id: c.id, ...(ticket.status === 'open' ? { status: 'in_progress' } : {}),
    }).eq('id', ticket.id).select().single();
    if (e3) { btn.disabled = false; return say(e3.message); }
    m.close();
    toast(`Added to ${c.title}${d ? ` · price ${d > 0 ? '+' : ''}${money(d)}` : ''}`);
    onDone?.(tk);
  });
  return m;
}

/* =====================================================================
   A small list of tickets (for the contract page)
   ===================================================================== */
export function ticketRows(tickets, { owner, onOpen }) {
  return el('ul', { class: 'tk-rows' }, tickets.map((t) => el('li', {},
    el('button', { type: 'button', onclick: () => onOpen(t) },
      el('span', { class: 'tk-num mono', text: `#${t.number}` }),
      el('span', { class: 'tk-row-body' }, el('strong', { text: t.title }), el('small', { text: `${T_KIND[t.kind]} · updated ${timeAgo(t.updated_at)}` })),
      t.files?.length ? el('span', { class: 'tk-clip', title: `${t.files.length} file(s)`, html: clip }) : null,
      ticketPill(t.status, owner)))));
}
