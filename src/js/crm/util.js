/* Shared helpers for the owner dashboard and the client portal.
   All data from the database is rendered as text (never innerHTML). */
import { gsap } from 'gsap';

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
export const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Tiny DOM builder. Strings become text nodes, so user data is always inert. */
export function el(tag, props = {}, ...children) {
  const svg = ['svg', 'path', 'rect', 'circle', 'line', 'polyline', 'polygon', 'g', 'text', 'defs', 'title'].includes(tag);
  const node = svg ? document.createElementNS('http://www.w3.org/2000/svg', tag) : document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === 'class') node.setAttribute('class', v);
    else if (k === 'text') node.textContent = v;
    else if (k === 'html') node.innerHTML = v; // only ever used with static icon markup
    else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    node.append(c instanceof Node ? c : String(c));
  }
  return node;
}

/** replaceChildren / append that skip null and false (the native ones print "null"). */
const kids = (list) => list.flat(Infinity).filter((k) => k != null && k !== false);
export const fill = (node, ...list) => node.replaceChildren(...kids(list));
export const add = (node, ...list) => node.append(...kids(list));

/* ---------- deal stages ---------- */
export const STATUS = {
  proposal:           { label: 'Proposal',           group: 'pending' },
  negotiating:        { label: 'Negotiating',        group: 'pending' },
  awaiting_signature: { label: 'Awaiting signature', group: 'pending' },
  active:             { label: 'Active',             group: 'live' },
  on_hold:            { label: 'On hold',            group: 'live' },
  complete:           { label: 'Complete',           group: 'done' },
  lost:               { label: 'Lost',               group: 'done' },
};
export const PENDING = ['proposal', 'negotiating', 'awaiting_signature'];
export const LIVE = ['active', 'on_hold'];
export const statusPill = (s) => el('span', { class: `crm-pill st-${s}`, text: STATUS[s]?.label || s });

export const EVENT_KINDS = {
  meeting: 'Meeting', call: 'Call', deadline: 'Deadline', milestone: 'Milestone',
  payment: 'Payment', task: 'Task', note: 'Note',
};

/* ---------- formatting ---------- */
const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const usdShort = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 });
export const money = (n) => usd.format(Number(n) || 0);
export const moneyShort = (n) => (Math.abs(n) >= 10000 ? usdShort.format(n) : usd.format(Number(n) || 0));
export const price = (c) => `${money(c.value)}${c.billing === 'monthly' ? '/mo' : ''}`;

// dates stored as 'YYYY-MM-DD' are calendar days, not moments: read them in local time
export const day = (d) => (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) ? new Date(d + 'T00:00:00') : new Date(d));
export const ymd = (d) => { const x = new Date(d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };
export const fmtDate = (d, opts = { month: 'short', day: 'numeric', year: 'numeric' }) => (d ? day(d).toLocaleDateString(undefined, opts) : '—');
export const fmtTime = (d) => new Date(d).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
export const daysFrom = (d) => Math.round((day(d) - new Date(ymd(new Date()) + 'T00:00:00')) / 86400000);

export function timeAgo(iso) {
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

export function dueText(c) {
  if (!c.due_date) return 'No due date';
  if (c.status === 'complete') return `Due ${fmtDate(c.due_date)}`;
  const n = daysFrom(c.due_date);
  if (n < 0) return `${-n} day${n === -1 ? '' : 's'} overdue`;
  if (n === 0) return 'Due today';
  return n <= 14 ? `Due in ${n} day${n === 1 ? '' : 's'}` : `Due ${fmtDate(c.due_date, { month: 'short', day: 'numeric' })}`;
}

export const initials = (s = '') => s.trim().split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || '?';

/* ---------- UI bits ---------- */
/** A button that needs two clicks (no confirm dialogs). */
export function armedButton(label, armedLabel, action, className) {
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
export function toast(msg, type = 'ok') {
  let t = $('#toast');
  if (!t) { t = el('div', { class: 'toast', id: 'toast', role: 'status', 'aria-live': 'polite' }); document.body.append(t); }
  t.textContent = msg;
  t.dataset.type = type;
  toastTween?.kill();
  toastTween = gsap.timeline()
    .fromTo(t, { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: 0.3, ease: 'power3.out' })
    .to(t, { autoAlpha: 0, y: 8, duration: 0.3, ease: 'power2.in' }, type === 'error' ? '+=5' : '+=2.4');
}

/** A simple modal. `body` is a node; resolves when closed. */
export function modal(title, body, { wide = false } = {}) {
  const close = () => { wrap.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  const wrap = el('div', { class: 'crm-modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': title, onclick: (e) => { if (e.target === wrap) close(); } },
    el('div', { class: `crm-modal-card${wide ? ' wide' : ''}` },
      el('header', { class: 'crm-modal-head' },
        el('h2', { text: title }),
        el('button', { type: 'button', class: 'crm-x', 'aria-label': 'Close', onclick: close, html: '&times;' })),
      body));
  document.body.append(wrap);
  document.addEventListener('keydown', onKey);
  if (!REDUCED) gsap.from(wrap.firstChild, { y: 18, autoAlpha: 0, duration: 0.35, ease: 'power3.out' });
  const first = wrap.querySelector('input, select, textarea');
  if (first) first.focus();
  return { close, root: wrap };
}

export const field = (label, input, hint) =>
  el('label', { class: 'crm-field' }, el('span', { text: label }), input, hint ? el('small', { text: hint }) : null);

export const icon = {
  home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg>',
  contracts: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 13h8M8 17h5"/></svg>',
  requests: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>',
  pending: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="5" height="16" rx="1.5"/><rect x="10" y="4" width="5" height="11" rx="1.5"/><rect x="17" y="4" width="4" height="7" rx="1.5"/></svg>',
  calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
  bell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>',
  send: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m22 2-7 20-4-9-9-4z"/><path d="M22 2 11 13"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
};
