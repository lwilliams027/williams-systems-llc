/* =====================================================================
   Client accounts (owners). Solo = one person; group = a company or team
   where several people share the same projects.

     accountsView   the Clients page: every account, its people and projects
     accountWizard  set up a client: who, their people, their projects,
                    then hands you each person's invite link
     manageAccount  add or remove people, rename, resend links

   Each person gets their own link (signup.html?invite=…). It opens a page
   where they set a password and land in their portal. The database only
   accepts sign-ups that come through the link.
   ===================================================================== */
import { supabase } from '../supabase.js';
import { el, fill, toast, modal, field, initials, fmtDate, timeAgo, money, STATUS, armedButton, REDUCED } from './util.js';
import { gsap } from 'gsap';

const SITE = new URL('./', location.href).href;
const LOCAL = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
export const inviteLink = (token) => `${SITE}signup.html?invite=${token}`;
const validEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
const mailto = (m, acct, link) => `mailto:${encodeURIComponent(m.email)}?subject=${encodeURIComponent('Your Williams Systems project page')}&body=${encodeURIComponent(
  `Hi${m.name ? ` ${m.name.split(' ')[0]}` : ''},\n\nYour project page${acct.kind === 'group' ? ` for ${acct.name}` : ''} is ready. Click the link below to set your password and sign in:\n\n${link}\n\nYou'll see your project's progress, files, schedule and billing, and you can message me any time.\n\nLandon\nWilliams Systems LLC`)}`;
const ICO = {
  solo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>',
  group: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><circle cx="17" cy="9" r="2.8"/><path d="M16 14.2a5.5 5.5 0 0 1 6 5.8"/></svg>',
  link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/></svg>',
};

/* ---------- data ---------- */
export async function loadAccounts() {
  const [a, m, i] = await Promise.all([
    supabase.from('client_accounts').select('*').order('created_at', { ascending: false }),
    supabase.from('account_members').select('*').order('created_at'),
    supabase.from('invites').select('id, token, accepted_at, created_at').is('accepted_at', null),
  ]);
  const err = a.error || m.error || i.error;
  if (err) { toast(`Couldn’t load clients: ${err.message}`, 'error'); return []; }
  const invites = new Map((i.data || []).map((x) => [x.id, x]));
  return (a.data || []).map((acct) => ({
    ...acct,
    members: (m.data || []).filter((x) => x.account_id === acct.id).map((x) => ({ ...x, invite: invites.get(x.invite_id) || null })),
  }));
}

/** Add people to an account; each one who isn't signed up yet gets an invite. */
async function addPeople(acct, people) {
  const out = [];
  for (const p of people) {
    const { data: row, error } = await supabase.from('account_members')
      .insert({ account_id: acct.id, email: p.email, name: p.name || null, role: p.role || 'member' }).select().single();
    if (error) {
      if (/duplicate|unique/i.test(error.message)) { toast(`${p.email} is already on this account`, 'error'); continue; }
      toast(`Couldn’t add ${p.email}: ${error.message}`, 'error'); continue;
    }
    out.push(await ensureInvite(row));
  }
  return out;
}

/** Someone not signed up yet needs an open invite; reuse theirs if there is one. */
async function ensureInvite(member) {
  if (member.user_id) return { ...member, invite: null };
  let { data: inv } = await supabase.from('invites').select('*').ilike('email', member.email).is('accepted_at', null).maybeSingle();
  if (!inv) {
    const { data: { user } } = await supabase.auth.getUser();
    const res = await supabase.from('invites').insert({ email: member.email, role: 'client', invited_by: user.id }).select().single();
    if (res.error) { toast(`Couldn’t create an invite for ${member.email}: ${res.error.message}`, 'error'); return { ...member, invite: null }; }
    inv = res.data;
  }
  if (member.invite_id !== inv.id) await supabase.from('account_members').update({ invite_id: inv.id }).eq('id', member.id);
  return { ...member, invite_id: inv.id, invite: inv };
}

/* ---------- one person's link, with copy + email ---------- */
function linkRow(m, acct) {
  if (m.user_id) return el('div', { class: 'ac-person-state ok' }, el('i'), m.joined_at ? `Joined ${timeAgo(m.joined_at)}` : 'Has an account');
  if (!m.invite) return el('div', { class: 'ac-person-state warn' }, el('i'), 'No link yet');
  const link = inviteLink(m.invite.token);
  return el('div', { class: 'ac-link' },
    el('input', { type: 'text', readonly: true, value: link, 'aria-label': `Invite link for ${m.email}`, onfocus: (e) => e.target.select() }),
    el('button', { type: 'button', class: 'btn btn-ghost btn-sm', text: 'Copy', onclick: () => copy(link) }),
    el('a', { class: 'btn btn-ghost btn-sm', href: mailto(m, acct, link), text: 'Email' }));
}
async function copy(text, msg = 'Link copied') {
  try { await navigator.clipboard.writeText(text); toast(msg); }
  catch { toast('Couldn’t copy. Select the link and press Ctrl+C.', 'error'); }
}
const localNote = () => (LOCAL ? el('p', { class: 'ac-local', text: 'You’re on the local preview, so these links open this computer’s copy. Links work for clients once the site is published.' }) : null);

/* =====================================================================
   The wizard: new client account
   ===================================================================== */
/**
 * preset: { kind, name, people: [{ name, email }], contractIds: [] }
 * contracts: every contract (ones without an account can be attached)
 */
export function accountWizard({ contracts = [], preset = {}, onDone } = {}) {
  const st = {
    kind: preset.kind || 'solo',
    name: preset.name || '',
    people: preset.people?.length ? preset.people.map((p) => ({ name: p.name || '', email: p.email || '' })) : [{ name: '', email: '' }],
    attach: new Set(preset.contractIds || []),
    newProjects: [],
  };
  const body = el('div', { class: 'ac-wiz crm-form' });
  const m = modal('New client account', body, { wide: true });
  m.root.querySelector('.crm-modal-card').classList.add('ac-wiz-card');
  const free = contracts.filter((c) => !c.account_id && c.status !== 'lost');

  function render() {
    const kindCard = (k, title, sub) => el('button', { type: 'button', class: 'ac-kind', role: 'radio', 'aria-checked': String(st.kind === k), onclick: () => {
      st.kind = k;
      if (k === 'solo') st.people = st.people.slice(0, 1);
      render();
    } }, el('span', { class: 'ac-kind-ico', html: ICO[k] }), el('strong', { text: title }), el('small', { text: sub }));

    const nameInput = el('input', { maxlength: 160, value: st.name, placeholder: st.kind === 'group' ? 'e.g. Juniper Studio' : 'e.g. Jordan Rivera', oninput: (e) => { st.name = e.target.value; } });

    const personRow = (p, i) => el('li', { class: 'ac-prow' },
      el('span', { class: 'ac-av sm', text: initials(p.name || p.email || '?') }),
      el('input', { maxlength: 120, value: p.name, placeholder: 'Name', 'aria-label': `Person ${i + 1} name`, oninput: (e) => { p.name = e.target.value; if (st.kind === 'solo' && !st.name) nameInput.placeholder = e.target.value || 'e.g. Jordan Rivera'; } }),
      el('input', { type: 'email', maxlength: 200, value: p.email, placeholder: 'email@company.com', 'aria-label': `Person ${i + 1} email`, oninput: (e) => { p.email = e.target.value.trim(); } }),
      i === 0 ? el('span', { class: 'ac-lead', text: 'Main contact' })
        : el('button', { type: 'button', class: 'cv-x', 'aria-label': 'Remove', html: '&times;', onclick: () => { st.people.splice(i, 1); render(); } }));

    const projRow = (c) => el('label', { class: 'ac-proj' },
      el('input', { type: 'checkbox', checked: st.attach.has(c.id) ? true : null, onchange: (e) => { if (e.target.checked) st.attach.add(c.id); else st.attach.delete(c.id); } }),
      el('i', { class: `crm-proj-dot st-${c.status}` }),
      el('span', {}, el('strong', { text: c.title }), el('small', { text: [STATUS[c.status]?.label, c.client_name || c.client_email].filter(Boolean).join(' · ') })));

    const newProjRow = (p, i) => el('li', { class: 'ac-newproj' },
      el('input', { maxlength: 160, value: p.title, placeholder: 'Project name', 'aria-label': 'Project name', oninput: (e) => { p.title = e.target.value; } }),
      el('select', { 'aria-label': 'Billing', onchange: (e) => { p.billing = e.target.value; } },
        el('option', { value: 'one_time', text: 'One-time', selected: p.billing === 'one_time' ? true : null }),
        el('option', { value: 'monthly', text: 'Monthly', selected: p.billing === 'monthly' ? true : null })),
      el('input', { type: 'number', min: 0, step: 50, inputmode: 'decimal', value: p.value, placeholder: 'Price', 'aria-label': 'Price (USD)', oninput: (e) => { p.value = e.target.value; } }),
      el('button', { type: 'button', class: 'cv-x', 'aria-label': 'Remove', html: '&times;', onclick: () => { st.newProjects.splice(i, 1); render(); } }));

    const msg = el('p', { class: 'crm-form-msg', role: 'alert', hidden: true });
    fill(body,
      el('section', { class: 'ac-step' }, el('h3', {}, el('b', { text: '1' }), 'Who is it for?'),
        el('div', { class: 'ac-kinds', role: 'radiogroup', 'aria-label': 'Account type' },
          kindCard('solo', 'Solo', 'One person and their projects'),
          kindCard('group', 'Group', 'A company or team. Everyone sees the same projects')),
        field(st.kind === 'group' ? 'Company or group name' : 'Client name', nameInput)),
      el('section', { class: 'ac-step' }, el('h3', {}, el('b', { text: '2' }), st.kind === 'group' ? 'People on the account' : 'Their email'),
        el('ul', { class: 'ac-people-edit' }, st.people.map(personRow)),
        st.kind === 'group' ? el('button', { type: 'button', class: 'link-btn ac-add', text: '+ Add another person', onclick: () => { st.people.push({ name: '', email: '' }); render(); body.querySelector('.ac-prow:last-child input')?.focus(); } }) : null,
        el('p', { class: 'ac-hint', text: 'Each person gets their own link. It opens a page where they set a password, then they’re signed in.' })),
      el('section', { class: 'ac-step' }, el('h3', {}, el('b', { text: '3' }), 'Projects'),
        free.length ? el('div', { class: 'ac-projs' }, free.map(projRow)) : null,
        st.newProjects.length ? el('ul', { class: 'ac-newprojs' }, st.newProjects.map(newProjRow)) : null,
        el('button', { type: 'button', class: 'link-btn ac-add', text: '+ Create a new project', onclick: () => { st.newProjects.push({ title: '', billing: 'one_time', value: '' }); render(); body.querySelector('.ac-newproj:last-child input')?.focus(); } }),
        !free.length && !st.newProjects.length ? el('p', { class: 'ac-hint', text: 'Add their first project now, or attach one later from the project page.' }) : null),
      msg,
      el('div', { class: 'crm-form-actions' },
        el('button', { type: 'button', class: 'btn btn-ghost', text: 'Cancel', onclick: () => m.close() }),
        el('button', { type: 'button', class: 'btn btn-primary', text: 'Create account & get links', onclick: (e) => create(e.currentTarget, msg) })));
  }

  async function create(btn, msg) {
    const say = (t) => { msg.textContent = t; msg.hidden = !t; };
    const people = st.people.filter((p) => p.email || p.name);
    if (!people.length) return say('Add at least one person’s email.');
    const bad = people.find((p) => !validEmail(p.email));
    if (bad) return say(`Check the email for ${bad.name || 'each person'}.`);
    if (new Set(people.map((p) => p.email.toLowerCase())).size !== people.length) return say('The same email is listed twice.');
    const name = st.name.trim() || (st.kind === 'solo' ? people[0].name.trim() : '');
    if (!name) return say(st.kind === 'group' ? 'Name the company or group.' : 'Add the client’s name.');
    const projects = st.newProjects.filter((p) => p.title.trim());
    say(''); btn.disabled = true; btn.textContent = 'Setting it up…';

    const { data: acct, error } = await supabase.from('client_accounts').insert({ name, kind: st.kind }).select().single();
    if (error) { btn.disabled = false; btn.textContent = 'Create account & get links'; return say(error.message); }
    const members = await addPeople(acct, people.map((p, i) => ({ ...p, name: p.name.trim(), role: i === 0 ? 'lead' : 'member' })));
    const lead = people[0];
    const contact = { client_name: st.kind === 'solo' ? name : lead.name.trim() || null, client_email: lead.email.toLowerCase(), company: st.kind === 'group' ? name : null };
    if (st.attach.size) {
      const { error: e2 } = await supabase.from('contracts').update({ account_id: acct.id }).in('id', [...st.attach]);
      if (e2) toast(`Couldn’t attach projects: ${e2.message}`, 'error');
    }
    for (const p of projects) {
      const { error: e3 } = await supabase.from('contracts').insert({ title: p.title.trim(), billing: p.billing, value: Number(p.value) || 0, status: 'active', account_id: acct.id, ...contact });
      if (e3) toast(`Couldn’t create ${p.title}: ${e3.message}`, 'error');
    }
    m.close();
    onDone?.(acct);
    showLinks({ ...acct, members }, { title: 'Account ready', intro: `${name} is set up${st.attach.size + projects.length ? ` with ${st.attach.size + projects.length} project${st.attach.size + projects.length === 1 ? '' : 's'}` : ''}. Send each person their link:` });
  }

  render();
  setTimeout(() => body.querySelector('.ac-kind[aria-checked="true"]')?.focus(), 0);
  return m;
}

/** The links, ready to send. */
export function showLinks(acct, { title = 'Invite links', intro } = {}) {
  const pending = acct.members.filter((x) => x.invite && !x.user_id);
  const body = el('div', { class: 'ac-links' },
    el('div', { class: 'ac-done-head' },
      el('span', { class: 'ac-done-ico', html: ICO.link }),
      el('div', {}, el('strong', { text: acct.name }), el('small', { text: acct.kind === 'group' ? `Group · ${acct.members.length} people` : 'Solo account' }))),
    intro ? el('p', { class: 'ac-hint', text: intro }) : null,
    el('ul', { class: 'ac-link-list' }, acct.members.map((x) => el('li', {},
      el('div', { class: 'ac-person' }, el('span', { class: 'ac-av sm', text: initials(x.name || x.email) }),
        el('div', {}, el('strong', { text: x.name || x.email }), x.name ? el('small', { text: x.email }) : null)),
      linkRow(x, acct)))),
    localNote(),
    el('div', { class: 'crm-form-actions' },
      pending.length > 1 ? el('button', { type: 'button', class: 'btn btn-ghost', text: 'Copy all links', onclick: () => copy(pending.map((x) => `${x.name || x.email} (${x.email}): ${inviteLink(x.invite.token)}`).join('\n'), 'All links copied') }) : null,
      el('button', { type: 'button', class: 'btn btn-primary', text: 'Done', onclick: () => mm.close() })));
  const mm = modal(title, body, { wide: true });
  return mm;
}

/* =====================================================================
   Manage one account
   ===================================================================== */
export async function manageAccount(accountId, { contracts = [], onChanged } = {}) {
  const all = await loadAccounts();
  let acct = all.find((a) => a.id === accountId);
  if (!acct) return toast('That account couldn’t be found.', 'error');
  const body = el('div', { class: 'ac-manage crm-form' });
  const m = modal(acct.name, body, { wide: true });
  const reload = async () => { acct = (await loadAccounts()).find((a) => a.id === accountId); if (!acct) { m.close(); onChanged?.(); return; } render(); onChanged?.(); };

  function render() {
    const projs = contracts.filter((c) => c.account_id === acct.id);
    const name = el('input', { maxlength: 160, value: acct.name });
    const email = el('input', { type: 'email', maxlength: 200, placeholder: 'email@company.com', 'aria-label': 'Email' });
    const pname = el('input', { maxlength: 120, placeholder: 'Name', 'aria-label': 'Name' });
    const add = async () => {
      const e = email.value.trim();
      if (!validEmail(e)) return toast('Enter a valid email.', 'error');
      if (acct.kind === 'solo') await supabase.from('client_accounts').update({ kind: 'group' }).eq('id', acct.id);
      const [row] = await addPeople(acct, [{ email: e, name: pname.value.trim() }]);
      if (row) toast(row.user_id ? `${e} already had an account and now sees these projects` : `Added. Send ${e} their link.`);
      reload();
    };
    email.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } });
    fill(body,
      el('div', { class: 'ac-manage-top' },
        el('span', { class: 'ac-kind-chip', html: `${ICO[acct.kind]}<span>${acct.kind === 'group' ? 'Group' : 'Solo'}</span>` }),
        field('Name', name),
        el('button', { type: 'button', class: 'btn btn-ghost btn-sm', text: 'Save name', onclick: async () => {
          if (!name.value.trim()) return;
          await supabase.from('client_accounts').update({ name: name.value.trim() }).eq('id', acct.id); toast('Saved'); reload();
        } })),
      el('section', { class: 'ac-step' }, el('h3', { text: 'People' }),
        el('ul', { class: 'ac-link-list' }, acct.members.map((x) => el('li', {},
          el('div', { class: 'ac-person' }, el('span', { class: 'ac-av sm', text: initials(x.name || x.email) }),
            el('div', {}, el('strong', { text: x.name || x.email }), el('small', { text: [x.name ? x.email : null, x.role === 'lead' ? 'Main contact' : null].filter(Boolean).join(' · ') }))),
          linkRow(x, acct),
          el('div', { class: 'ac-person-actions' },
            !x.user_id && !x.invite ? el('button', { type: 'button', class: 'link-btn', text: 'Make link', onclick: async () => { await ensureInvite(x); reload(); } }) : null,
            acct.members.length > 1 ? armedButton('Remove', 'Sure?', async () => {
              const { error } = await supabase.from('account_members').delete().eq('id', x.id);
              if (error) return toast(error.message, 'error');
              if (x.invite && !x.user_id) await supabase.from('invites').delete().eq('id', x.invite.id);
              toast(`${x.email} removed`); reload();
            }, 'link-btn danger') : null)))),
        el('div', { class: 'ac-addrow' }, pname, email, el('button', { type: 'button', class: 'btn btn-primary btn-sm', text: 'Add person', onclick: add })),
        acct.kind === 'solo' ? el('p', { class: 'ac-hint', text: 'Adding a second person turns this into a group account.' }) : null),
      el('section', { class: 'ac-step' }, el('h3', { text: 'Projects' }),
        projs.length ? el('ul', { class: 'ac-projlist' }, projs.map((c) => el('li', {},
          el('i', { class: `crm-proj-dot st-${c.status}` }), el('span', { text: c.title }), el('small', { text: `${money(c.value)}${c.billing === 'monthly' ? '/mo' : ''}` }),
          el('button', { type: 'button', class: 'link-btn', text: 'Detach', onclick: async () => { await supabase.from('contracts').update({ account_id: null }).eq('id', c.id); c.account_id = null; toast('Detached'); reload(); } }))))
          : el('p', { class: 'ac-hint', text: 'No projects yet.' }),
        (() => {
          const free = contracts.filter((c) => !c.account_id && c.status !== 'lost');
          if (!free.length) return null;
          const sel = el('select', { 'aria-label': 'Attach a project' }, el('option', { value: '', text: 'Attach a project…' }), free.map((c) => el('option', { value: c.id, text: c.title })));
          sel.addEventListener('change', async () => { if (!sel.value) return; await supabase.from('contracts').update({ account_id: acct.id }).eq('id', sel.value); const c = contracts.find((x) => x.id === sel.value); if (c) c.account_id = acct.id; toast('Attached'); reload(); });
          return sel;
        })()),
      localNote(),
      el('div', { class: 'crm-form-actions ac-danger' },
        armedButton('Delete account', 'Click again: projects stay, people lose access', async () => {
          const { error } = await supabase.from('client_accounts').delete().eq('id', acct.id);
          if (error) return toast(error.message, 'error');
          toast('Account deleted'); m.close(); onChanged?.();
        }, 'link-btn danger'),
        el('button', { type: 'button', class: 'btn btn-primary', text: 'Done', onclick: () => m.close() })));
  }
  render();
  return m;
}

/* =====================================================================
   The Clients page
   ===================================================================== */
export function accountsView(root, { getContracts, projectHref, onChanged }) {
  let accounts = [], q = '', alive = true;
  const changed = () => { load(); onChanged?.(); };

  async function load() {
    const list = await loadAccounts();
    if (!alive) return;
    const first = !accounts.length;
    accounts = list;
    render(first);
  }

  function render(animate = false) {
    const contracts = getContracts();
    const people = accounts.flatMap((a) => a.members);
    const waiting = people.filter((p) => !p.user_id).length;
    const shown = accounts.filter((a) => !q || [a.name, ...a.members.flatMap((x) => [x.email, x.name])].filter(Boolean).join(' ').toLowerCase().includes(q));
    const loose = contracts.filter((c) => !c.account_id && c.status !== 'lost');
    const search = el('input', { type: 'search', class: 'ac-search', placeholder: 'Search clients or emails…', value: q, 'aria-label': 'Search clients' });
    search.addEventListener('input', () => { q = search.value.trim().toLowerCase(); render(); root.querySelector('.ac-search')?.focus(); const s = root.querySelector('.ac-search'); if (s) s.setSelectionRange(s.value.length, s.value.length); });

    const card = (a) => {
      const projs = contracts.filter((c) => c.account_id === a.id);
      const joined = a.members.filter((x) => x.user_id).length;
      return el('article', { class: 'ac-card' },
        el('header', { class: 'ac-card-head' },
          el('span', { class: `ac-av${a.kind === 'group' ? ' group' : ''}`, text: initials(a.name) }),
          el('div', { class: 'ac-card-title' }, el('strong', { text: a.name }),
            el('small', { text: `${a.kind === 'group' ? 'Group' : 'Solo'} · ${joined}/${a.members.length} signed up · since ${fmtDate(a.created_at, { month: 'short', year: 'numeric' })}` })),
          el('button', { type: 'button', class: 'btn btn-ghost btn-sm', text: 'Manage', onclick: () => manageAccount(a.id, { contracts, onChanged: changed }) })),
        el('ul', { class: 'ac-card-people' }, a.members.map((x) => el('li', {},
          el('span', { class: 'ac-av xs', text: initials(x.name || x.email) }),
          el('span', { class: 'ac-card-person' }, el('b', { text: x.name || x.email }), x.name ? el('small', { text: x.email }) : null),
          x.user_id ? el('span', { class: 'ac-pill ok', text: 'Active' })
            : x.invite ? el('button', { type: 'button', class: 'ac-pill wait', title: 'Copy their invite link', html: `${ICO.link}<span>Copy link</span>`, onclick: () => copy(inviteLink(x.invite.token)) })
              : el('span', { class: 'ac-pill', text: 'No link' })))),
        el('div', { class: 'ac-card-projs' },
          projs.length ? projs.map((c) => el('a', { class: 'ac-chip', href: projectHref(c) }, el('i', { class: `crm-proj-dot st-${c.status}` }), c.title))
            : el('span', { class: 'ac-hint', text: 'No projects yet' })),
        a.members.some((x) => !x.user_id && x.invite) ? el('button', { type: 'button', class: 'link-btn ac-card-links', text: 'Show invite links', onclick: () => showLinks(a) }) : null);
    };

    fill(root, el('div', { class: 'ac' },
      el('header', { class: 'ac-head' },
        el('div', {}, el('h2', { text: 'Clients' }),
          el('p', { text: accounts.length ? [`${accounts.length} account${accounts.length === 1 ? '' : 's'}`, `${people.length} people`, waiting ? `${waiting} haven’t signed up yet` : 'everyone’s signed up'].join(' · ') : 'Set up a client, add their people and projects, and send the links.' })),
        el('div', { class: 'ac-head-actions' }, accounts.length > 4 ? search : null,
          el('button', { type: 'button', class: 'btn btn-primary btn-sm', html: '<span>+ New client</span>', onclick: () => accountWizard({ contracts, onDone: changed }) }))),
      loose.length ? el('div', { class: 'ac-loose' },
        el('span', { text: `${loose.length} project${loose.length === 1 ? ' has' : 's have'} no client account: ` }),
        loose.slice(0, 4).map((c) => el('button', { type: 'button', class: 'ac-chip', onclick: () => accountWizard({ contracts, preset: { name: c.company || c.client_name || '', kind: c.company ? 'group' : 'solo', people: c.client_email ? [{ name: c.client_name, email: c.client_email }] : [], contractIds: [c.id] }, onDone: changed }) },
          el('i', { class: `crm-proj-dot st-${c.status}` }), c.title, el('b', { text: ' → set up' })))) : null,
      shown.length ? el('div', { class: 'ac-grid' }, shown.map(card))
        : el('div', { class: 'ac-empty' },
          el('span', { class: 'ac-empty-ico', html: ICO.group }),
          el('strong', { text: accounts.length ? 'No matches' : 'No client accounts yet' }),
          el('p', { text: accounts.length ? 'Try another name or email.' : 'A solo account is one person. A group lets several people from the same company share their projects.' }),
          accounts.length ? null : el('button', { type: 'button', class: 'btn btn-primary btn-sm', text: 'Set up your first client', onclick: () => accountWizard({ contracts, onDone: changed }) }))));
    if (animate && !REDUCED) gsap.from(root.querySelectorAll('.ac-card'), { y: 12, autoAlpha: 0, duration: 0.4, stagger: 0.04, ease: 'power3.out', clearProps: 'all' });
  }

  fill(root, el('div', { class: 'cv-loading', text: 'Loading clients…' }));
  load();
  const ch = supabase.channel(`accounts-${Math.random().toString(36).slice(2, 8)}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'account_members' }, () => load())
    .subscribe();
  return { reload: load, render: () => render(), destroy: () => { alive = false; supabase.removeChannel(ch); } };
}
