/* =====================================================================
   Team dashboard — sign in, review inquiries, open attachments,
   set status, and keep editable internal notes. Everything is saved
   to Supabase; new inquiries stream in live via Realtime.
   All visitor-supplied text is rendered with textContent (never innerHTML).
   ===================================================================== */
import { gsap } from 'gsap';
import { supabase, isConfigured, BUCKET } from './supabase.js';

const STATUSES = [
  ['new', 'New'],
  ['in_progress', 'In progress'],
  ['won', 'Won'],
  ['closed', 'Closed'],
];
const STATUS_LABEL = Object.fromEntries(STATUSES);
const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const $ = (sel, root = document) => root.querySelector(sel);

const state = {
  inquiries: [],
  selectedId: null,
  filter: 'all',
  query: '',
  notes: [],
  channel: null,
};

/** Tiny DOM builder. Strings become text nodes, so user data is always inert. */
function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k === 'html') node.innerHTML = v; // only ever used with static icon markup
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    node.append(c instanceof Node ? c : String(c));
  }
  return node;
}

/* ------------------------------------------------------------------ */
/*  Auth                                                               */
/* ------------------------------------------------------------------ */
boot();

async function boot() {
  if (!isConfigured) return show('configNotice');

  const { data: { session } } = await supabase.auth.getSession();
  if (session && (await isAdmin())) enterApp(session.user);
  else {
    if (session) await supabase.auth.signOut();
    show('loginView');
  }

  supabase.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT') leaveApp();
  });
}

function show(id) {
  for (const v of ['configNotice', 'loginView', 'appView']) $('#' + v).hidden = v !== id;
  if (id === 'loginView') {
    $('#loginForm [name="email"]').focus();
    if (!REDUCED) gsap.from('.login-card', { y: 20, autoAlpha: 0, duration: 0.6, ease: 'power3.out' });
  }
}

async function isAdmin() {
  const { data, error } = await supabase.rpc('is_admin');
  return !error && data === true;
}

$('#loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.currentTarget;
  const email = form.email.value.trim();
  const password = form.password.value;
  const errBox = $('#loginError');
  const btn = $('#loginBtn');
  errBox.hidden = true;
  if (!email || !password) { errBox.textContent = 'Enter your email and password.'; errBox.hidden = false; return; }

  btn.disabled = true; btn.textContent = 'Signing in…';
  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    if (!(await isAdmin())) {
      await supabase.auth.signOut();
      throw new Error('This account doesn’t have team access.');
    }
    form.reset();
    enterApp(data.user);
  } catch (err) {
    errBox.textContent = err.message === 'Invalid login credentials' ? 'Wrong email or password.' : err.message;
    errBox.hidden = false;
  } finally {
    btn.disabled = false; btn.textContent = 'Sign in';
  }
});

$('#signOutBtn').addEventListener('click', () => supabase.auth.signOut());
$('#refreshBtn').addEventListener('click', async () => { await loadInquiries(); toast('Refreshed'); });

async function enterApp(user) {
  $('#userEmail').textContent = user.email;
  show('appView');
  renderTabs();
  await loadInquiries();
  subscribe();
  if (!REDUCED) {
    gsap.from(['.admin-top', '.inbox', '.detail'], { y: 14, autoAlpha: 0, duration: 0.5, stagger: 0.07, ease: 'power3.out' });
  }
}

function leaveApp() {
  if (state.channel) supabase.removeChannel(state.channel);
  Object.assign(state, { inquiries: [], selectedId: null, notes: [], channel: null });
  $('#inquiryList').replaceChildren();
  renderDetail();
  show('loginView');
}

/* ------------------------------------------------------------------ */
/*  Data                                                               */
/* ------------------------------------------------------------------ */
async function loadInquiries() {
  const { data, error } = await supabase
    .from('inquiries')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) { toast(`Couldn’t load inquiries: ${error.message}`, 'error'); return; }
  state.inquiries = data;
  if (state.selectedId && !data.some((q) => q.id === state.selectedId)) state.selectedId = null;
  renderList();
  if (state.selectedId) renderDetail(false);
}

function subscribe() {
  if (state.channel) supabase.removeChannel(state.channel);
  state.channel = supabase
    .channel('inquiries-feed')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'inquiries' }, (payload) => {
      if (payload.eventType === 'INSERT') {
        if (state.inquiries.some((q) => q.id === payload.new.id)) return;
        state.inquiries.unshift(payload.new);
        renderList(payload.new.id);
        toast(`New inquiry from ${payload.new.name}`);
      } else if (payload.eventType === 'UPDATE') {
        const i = state.inquiries.findIndex((q) => q.id === payload.new.id);
        if (i >= 0) state.inquiries[i] = payload.new;
        renderList();
        if (payload.new.id === state.selectedId) syncStatusSelect(payload.new.status);
      } else if (payload.eventType === 'DELETE') {
        state.inquiries = state.inquiries.filter((q) => q.id !== payload.old.id);
        if (state.selectedId === payload.old.id) { state.selectedId = null; renderDetail(); }
        renderList();
      }
    })
    .subscribe((status) => {
      $('#liveBadge').classList.toggle('on', status === 'SUBSCRIBED');
    });
}

/* ------------------------------------------------------------------ */
/*  Inbox list                                                         */
/* ------------------------------------------------------------------ */
function renderTabs() {
  const tabs = [['all', 'All'], ...STATUSES].map(([key, label]) =>
    el('button', {
      type: 'button', role: 'tab', class: 'tab', 'data-status': key,
      'aria-selected': String(state.filter === key),
      onclick: () => { state.filter = key; renderTabs(); renderList(); },
    }, label, el('span', { class: 'tab-count', 'data-count': key })));
  $('#statusTabs').replaceChildren(...tabs);
  updateCounts();
}

function updateCounts() {
  const counts = { all: state.inquiries.length };
  for (const [key] of STATUSES) counts[key] = state.inquiries.filter((q) => q.status === key).length;
  document.querySelectorAll('[data-count]').forEach((n) => { n.textContent = counts[n.dataset.count] ?? 0; });
}

$('#search').addEventListener('input', (e) => { state.query = e.target.value.trim().toLowerCase(); renderList(); });

function visibleInquiries() {
  return state.inquiries.filter((q) => {
    if (state.filter !== 'all' && q.status !== state.filter) return false;
    if (!state.query) return true;
    return [q.name, q.email, q.company, q.message].some((s) => s && s.toLowerCase().includes(state.query));
  });
}

function renderList(flashId) {
  updateCounts();
  const rows = visibleInquiries();
  const items = rows.map((q) => {
    const files = Array.isArray(q.files) ? q.files.length : 0;
    return el('li', {},
      el('button', {
        type: 'button', class: 'inq-item', 'data-id': q.id,
        'aria-current': q.id === state.selectedId ? 'true' : null,
        onclick: () => select(q.id),
      },
        el('span', { class: 'inq-row' },
          el('strong', { class: 'inq-name', text: q.name }),
          el('time', { class: 'inq-time mono', datetime: q.created_at, text: timeAgo(q.created_at) })),
        el('span', { class: 'inq-sub', text: q.company ? `${q.company} · ${q.email}` : q.email }),
        el('span', { class: 'inq-snippet', text: q.message }),
        el('span', { class: 'inq-row' },
          el('span', { class: `status-pill s-${q.status}`, text: STATUS_LABEL[q.status] || q.status }),
          files ? el('span', { class: 'inq-files mono', text: `${files} file${files === 1 ? '' : 's'}` }) : null)));
  });
  $('#inquiryList').replaceChildren(...items);
  $('#listEmpty').hidden = rows.length > 0;
  $('#listEmpty').textContent = state.inquiries.length
    ? 'Nothing matches this filter.'
    : 'No inquiries yet. Submissions from the website form land here automatically.';

  if (flashId && !REDUCED) {
    const node = $(`.inq-item[data-id="${flashId}"]`);
    if (node) gsap.fromTo(node, { backgroundColor: 'rgba(255,90,31,0.25)' }, { backgroundColor: 'rgba(255,90,31,0)', duration: 1.6, clearProps: 'backgroundColor' });
  }
}

function select(id) {
  state.selectedId = id;
  renderList();
  renderDetail();
  $('#adminMain').classList.add('show-detail');
}

/* ------------------------------------------------------------------ */
/*  Detail                                                             */
/* ------------------------------------------------------------------ */
function renderDetail(animate = true) {
  const detail = $('#detail');
  const q = state.inquiries.find((x) => x.id === state.selectedId);
  if (!q) {
    $('#adminMain').classList.remove('show-detail');
    detail.replaceChildren(el('div', { class: 'detail-empty' },
      el('p', { text: 'Select an inquiry to see details, files, and notes.' })));
    return;
  }

  const statusSelect = el('select', {
    class: 'status-select', id: 'statusSelect', 'aria-label': 'Status',
    onchange: (e) => updateStatus(q, e.target.value),
  }, STATUSES.map(([key, label]) => el('option', { value: key, selected: q.status === key ? true : null, text: label })));

  const deleteBtn = armedButton('Delete inquiry', 'Click again to delete', () => deleteInquiry(q), 'btn btn-ghost btn-sm danger');

  const meta = [
    ['Company', q.company],
    ['Phone', q.phone],
    ['Budget', q.budget],
    ['Timeline', q.timeline],
    ['Submitted', new Date(q.created_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })],
    ['Reference', `WS-${q.id.slice(0, 8).toUpperCase()}`],
  ];

  const files = Array.isArray(q.files) ? q.files : [];

  detail.replaceChildren(
    el('div', { class: 'detail-inner' },
      el('button', { type: 'button', class: 'detail-back', onclick: () => { state.selectedId = null; renderList(); renderDetail(); } }, '← All inquiries'),
      el('header', { class: 'detail-head' },
        el('div', {},
          el('h2', { text: q.name }),
          el('a', { class: 'detail-email', href: `mailto:${q.email}?subject=${encodeURIComponent('Re: your project inquiry')}`, text: q.email })),
        el('div', { class: 'detail-actions' }, statusSelect, deleteBtn)),

      el('dl', { class: 'meta-grid' },
        meta.map(([k, v]) => el('div', {}, el('dt', { class: 'mono', text: k }), el('dd', { text: v || '—' })))),

      q.services?.length
        ? el('div', { class: 'detail-block' },
            el('h3', { class: 'mono', text: 'Services' }),
            el('ul', { class: 'chips' }, q.services.map((s) => el('li', { text: s }))))
        : null,

      el('div', { class: 'detail-block' },
        el('h3', { class: 'mono', text: 'Project details' }),
        el('p', { class: 'message', text: q.message })),

      el('div', { class: 'detail-block' },
        el('h3', { class: 'mono', text: `Files (${files.length})` }),
        files.length
          ? el('ul', { class: 'detail-files', id: 'detailFiles' }, files.map((f) =>
              el('li', { 'data-path': f.path },
                el('span', { class: 'thumb' }, el('span', { class: 'file-ext', text: (f.name.split('.').pop() || 'file').slice(0, 4) })),
                el('span', { class: 'file-info' },
                  el('span', { class: 'file-name', text: f.name, title: f.name }),
                  el('span', { class: 'file-meta', text: formatBytes(f.size) })),
                el('a', { class: 'btn btn-ghost btn-sm file-open', target: '_blank', rel: 'noopener', 'aria-disabled': 'true', text: 'Open' }))))
          : el('p', { class: 'muted', text: 'No files attached.' })),

      el('div', { class: 'detail-block notes' },
        el('h3', { class: 'mono', text: 'Team notes' }),
        el('ul', { class: 'note-list', id: 'noteList' }, el('li', { class: 'muted', text: 'Loading notes…' })),
        el('form', { class: 'note-form', id: 'noteForm', onsubmit: (e) => { e.preventDefault(); addNote(q.id); } },
          el('textarea', { name: 'body', rows: '3', maxlength: '5000', placeholder: 'Add a note — call summary, next steps, pricing… (Ctrl+Enter to save)', 'aria-label': 'New note', onkeydown: (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); addNote(q.id); } } }),
          el('button', { type: 'submit', class: 'btn btn-primary btn-sm' }, 'Save note'))),
    ),
  );

  if (animate && !REDUCED) gsap.from('.detail-inner > *', { y: 12, autoAlpha: 0, duration: 0.45, stagger: 0.04, ease: 'power3.out' });
  detail.scrollTop = 0;

  loadFileLinks(q);
  loadNotes(q.id);
}

function syncStatusSelect(status) {
  const sel = $('#statusSelect');
  if (sel) sel.value = status;
}

async function updateStatus(q, status) {
  const prev = q.status;
  q.status = status;
  renderList();
  const { error } = await supabase.from('inquiries').update({ status }).eq('id', q.id);
  if (error) {
    q.status = prev;
    syncStatusSelect(prev);
    renderList();
    toast(`Couldn’t save status: ${error.message}`, 'error');
  } else toast(`Status set to ${STATUS_LABEL[status]}`);
}

async function deleteInquiry(q) {
  const paths = (q.files || []).map((f) => f.path);
  if (paths.length) {
    const { error } = await supabase.storage.from(BUCKET).remove(paths);
    if (error) { toast(`Couldn’t delete files: ${error.message}`, 'error'); return; }
  }
  const { error } = await supabase.from('inquiries').delete().eq('id', q.id);
  if (error) { toast(`Couldn’t delete: ${error.message}`, 'error'); return; }
  state.inquiries = state.inquiries.filter((x) => x.id !== q.id);
  state.selectedId = null;
  renderList();
  renderDetail();
  toast('Inquiry deleted');
}

/** Private files are served through short-lived signed URLs. */
async function loadFileLinks(q) {
  const files = Array.isArray(q.files) ? q.files : [];
  if (!files.length) return;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(files.map((f) => f.path), 60 * 60);
  if (state.selectedId !== q.id) return;
  if (error) { toast(`Couldn’t load file links: ${error.message}`, 'error'); return; }
  data.forEach((entry, i) => {
    const row = document.querySelector(`#detailFiles li[data-path="${CSS.escape(files[i].path)}"]`);
    if (!row || !entry.signedUrl) return;
    const link = row.querySelector('.file-open');
    link.href = entry.signedUrl;
    link.removeAttribute('aria-disabled');
    if ((files[i].type || '').startsWith('image/')) {
      const img = el('img', { src: entry.signedUrl, alt: '', loading: 'lazy' });
      row.querySelector('.thumb').replaceChildren(img);
    }
  });
}

/* ------------------------------------------------------------------ */
/*  Notes                                                              */
/* ------------------------------------------------------------------ */
async function loadNotes(inquiryId) {
  const { data, error } = await supabase
    .from('inquiry_notes')
    .select('*')
    .eq('inquiry_id', inquiryId)
    .order('created_at', { ascending: true });
  if (state.selectedId !== inquiryId) return;
  if (error) { toast(`Couldn’t load notes: ${error.message}`, 'error'); return; }
  state.notes = data;
  renderNotes();
}

function renderNotes() {
  const list = $('#noteList');
  if (!list) return;
  if (!state.notes.length) {
    list.replaceChildren(el('li', { class: 'muted', text: 'No notes yet.' }));
    return;
  }
  list.replaceChildren(...state.notes.map(noteItem));
}

function noteItem(note) {
  const edited = new Date(note.updated_at) - new Date(note.created_at) > 1000;
  const li = el('li', { class: 'note', 'data-id': note.id },
    el('div', { class: 'note-meta mono' },
      el('span', { text: note.author_email || 'Team' }),
      el('span', { text: `${timeAgo(note.created_at)}${edited ? ' · edited' : ''}` })),
    el('p', { class: 'note-body', text: note.body }),
    el('div', { class: 'note-actions' },
      el('button', { type: 'button', class: 'link-btn', onclick: () => editNote(li, note) }, 'Edit'),
      armedButton('Delete', 'Confirm delete', () => deleteNote(note), 'link-btn danger')));
  return li;
}

function editNote(li, note) {
  const area = el('textarea', { rows: '3', maxlength: '5000', 'aria-label': 'Edit note' });
  area.value = note.body;
  const save = async () => {
    const body = area.value.trim();
    if (!body) { toast('A note can’t be empty', 'error'); return; }
    if (body === note.body) { renderNotes(); return; }
    const { data, error } = await supabase.from('inquiry_notes').update({ body }).eq('id', note.id).select().single();
    if (error) { toast(`Couldn’t save note: ${error.message}`, 'error'); return; }
    state.notes = state.notes.map((n) => (n.id === note.id ? data : n));
    renderNotes();
    toast('Note updated');
  };
  area.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); save(); }
    if (e.key === 'Escape') renderNotes();
  });
  li.querySelector('.note-body').replaceWith(area);
  li.querySelector('.note-actions').replaceChildren(
    el('button', { type: 'button', class: 'btn btn-primary btn-sm', onclick: save }, 'Save'),
    el('button', { type: 'button', class: 'link-btn', onclick: renderNotes }, 'Cancel'));
  area.focus();
  area.setSelectionRange(area.value.length, area.value.length);
}

async function addNote(inquiryId) {
  const form = $('#noteForm');
  const area = form.body;
  const body = area.value.trim();
  if (!body) { area.focus(); return; }
  const btn = form.querySelector('button');
  btn.disabled = true;
  const { data, error } = await supabase.from('inquiry_notes').insert({ inquiry_id: inquiryId, body }).select().single();
  btn.disabled = false;
  if (error) { toast(`Couldn’t save note: ${error.message}`, 'error'); return; }
  if (state.selectedId !== inquiryId) return;
  area.value = '';
  state.notes.push(data);
  renderNotes();
  const added = $(`.note[data-id="${data.id}"]`);
  if (added && !REDUCED) gsap.from(added, { y: 10, autoAlpha: 0, duration: 0.4, ease: 'power3.out' });
  toast('Note saved');
}

async function deleteNote(note) {
  const { error } = await supabase.from('inquiry_notes').delete().eq('id', note.id);
  if (error) { toast(`Couldn’t delete note: ${error.message}`, 'error'); return; }
  state.notes = state.notes.filter((n) => n.id !== note.id);
  renderNotes();
  toast('Note deleted');
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */
/** A button that needs two clicks (the page has no confirm dialogs). */
function armedButton(label, armedLabel, action, className) {
  let timer;
  const btn = el('button', { type: 'button', class: className }, label);
  btn.addEventListener('click', async () => {
    if (btn.dataset.armed) {
      clearTimeout(timer);
      btn.disabled = true;
      await action();
      btn.disabled = false;
      return;
    }
    btn.dataset.armed = 'true';
    btn.textContent = armedLabel;
    timer = setTimeout(() => { delete btn.dataset.armed; btn.textContent = label; }, 4000);
  });
  return btn;
}

let toastTween;
function toast(msg, type = 'ok') {
  const t = $('#toast');
  t.textContent = msg;
  t.dataset.type = type;
  toastTween?.kill();
  toastTween = gsap.timeline()
    .fromTo(t, { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: 0.3, ease: 'power3.out' })
    .to(t, { autoAlpha: 0, y: 8, duration: 0.3, ease: 'power2.in' }, type === 'error' ? '+=5' : '+=2.4');
}

function timeAgo(iso) {
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function formatBytes(n = 0) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

// Keep relative times fresh.
setInterval(() => { if (!$('#appView').hidden) renderList(); }, 60_000);
