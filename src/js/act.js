/* =====================================================================
   act.html — what the autopilot email buttons open.

   ?job=<id>    a change Claude made for a ticket (review / approve / hold /
                ask for changes / discard)
   ?ticket=<id> just the ticket (status + message the client)
   &do=<x>      which section the button was for; it is only highlighted.
                Nothing happens until you click here, so mail scanners that
                open links can't approve a push.

   Owners only. The autopilot server on the PC (autopilot/server.mjs)
   picks the decision up within a few seconds.
   ===================================================================== */
import { supabase, isConfigured } from './supabase.js';

const card = document.getElementById('actCard');
const qs = new URLSearchParams(location.search);
const UUID = /^[0-9a-f-]{36}$/i;
const STATUS = { open: 'Open', in_progress: 'In progress', waiting: 'Waiting on client', resolved: 'Done', closed: 'Closed' };
const JOB = {
  queued: 'Queued', working: 'Claude is working', ready: 'Ready — goes live when the timer ends', pushing: 'Pushing',
  pushed: 'Live', no_change: 'No code change made', failed: 'Needs you', manual: 'No repo mapped — handle by hand', discarded: 'Discarded',
};

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const when = (d) => new Date(d).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
const say = (msg, ok = true) => {
  card.querySelector('.auth-msg')?.remove();
  card.insertAdjacentHTML('afterbegin', `<p class="auth-msg ${ok ? 'ok' : 'err'}">${esc(msg)}</p>`);
  card.scrollIntoView({ block: 'start', behavior: 'smooth' });
};

async function start() {
  if (!isConfigured) { card.innerHTML = '<h1>Not connected</h1>'; return; }
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return location.replace(`login.html?next=${encodeURIComponent('act.html' + location.search)}`);
  const { data: admin } = await supabase.rpc('is_admin');
  if (!admin) { card.innerHTML = '<h1>Owners only</h1><p>This page is for the Williams Systems team.</p>'; return; }
  render();
}

async function load() {
  let job = null;
  let ticketId = qs.get('ticket');
  if (UUID.test(qs.get('job') || '')) {
    ({ data: job } = await supabase.from('automation_jobs').select('*').eq('id', qs.get('job')).maybeSingle());
    ticketId = job?.ticket_id;
  } else if (UUID.test(ticketId || '')) {
    ({ data: job } = await supabase.from('automation_jobs').select('*').eq('ticket_id', ticketId).maybeSingle());
  }
  if (!UUID.test(ticketId || '')) return {};
  const [{ data: ticket }, { data: thread }] = await Promise.all([
    supabase.from('tickets').select('*, client:profiles(full_name, email), contract:contracts(title)').eq('id', ticketId).maybeSingle(),
    supabase.from('ticket_messages').select('kind, sender_name, sender_role, body, created_at').eq('ticket_id', ticketId).order('created_at', { ascending: false }).limit(6),
  ]);
  return { job, ticket, thread: (thread || []).reverse() };
}

let timer;
async function render() {
  const { job, ticket, thread } = await load();
  if (!ticket) { card.innerHTML = '<h1>Not found</h1><p>That ticket or job doesn’t exist any more.</p>'; return; }
  const focus = qs.get('do') || '';
  const d = job?.details || {};
  const canDecide = job && ['ready', 'failed', 'no_change'].includes(job.status);
  const who = ticket.client?.full_name || ticket.client?.email || 'Client';

  card.innerHTML = `
    <p class="auth-kicker">Ticket #${ticket.number}${ticket.contract ? ' · ' + esc(ticket.contract.title) : ''}</p>
    <h1>${esc(ticket.title)}</h1>
    <div class="act-meta">
      <span class="act-pill hot">${esc(STATUS[ticket.status] || ticket.status)}</span>
      <span class="act-pill">${esc(ticket.kind)} · ${esc(ticket.priority)}</span>
      <span class="act-pill">${esc(who)} · ${when(ticket.created_at)}</span>
    </div>
    ${ticket.body ? `<p class="act-body">${esc(ticket.body)}</p>` : ''}

    ${job ? `
    <div class="act-section${/approve|hold|changes|discard|review/.test(focus) ? ' focus' : ''}" id="review">
      <h2>Claude’s change · ${esc(JOB[job.status] || job.status)}</h2>
      ${job.status === 'ready' && job.deadline && job.decision !== 'hold'
        ? `<p>Goes live <span class="act-timer" id="timer"></span> unless you hold it.</p>` : ''}
      ${job.decision === 'hold' ? '<p>On hold — the timer is stopped.</p>' : ''}
      ${job.summary ? `<p class="act-body">${esc(job.summary)}</p>` : ''}
      ${(d.previews || []).length ? `<div class="act-row">${d.previews.map((pv) => (pv.url
        ? `<a class="btn btn-primary" href="${esc(pv.url)}" target="_blank" rel="noopener noreferrer">Preview ${esc(pv.name)} ↗</a>`
        : `<span class="act-pill">No ${esc(pv.name)} preview${pv.error ? ': ' + esc(pv.error.slice(0, 120)) : ''}</span>`)).join('')}</div>` : ''}
      ${d.diffstat ? `<pre class="act-files">${esc(d.diffstat)}</pre>` : ''}
      ${d.check ? `<p>Build check: <b>${esc(d.check)}</b></p>` : ''}
      ${d.error ? `<p class="auth-msg err">${esc(d.error)}</p>` : ''}
      ${canDecide ? `
        <div class="act-row">
          ${job.status === 'ready' ? '<button class="btn btn-primary" data-decide="approve">Approve &amp; push now</button>' : ''}
          ${job.status === 'ready' && job.decision !== 'hold' ? '<button class="btn btn-ghost" data-decide="hold">Hold</button>' : ''}
          <button class="btn btn-ghost" data-decide="discard">Discard</button>
        </div>
        <label class="auth-field"><span>Ask Claude for changes</span>
          <textarea id="changeNote" placeholder="e.g. Make the button blue and keep the old wording"></textarea></label>
        <div class="act-row"><button class="btn btn-ghost" data-decide="changes">Send to Claude</button></div>` : ''}
    </div>` : ''}

    <div class="act-section${/status|done|close|waiting/.test(focus) ? ' focus' : ''}" id="status">
      <h2>Ticket status</h2>
      <div class="act-row">
        ${['in_progress', 'waiting', 'resolved', 'closed'].map((s) =>
          `<button class="btn ${s === 'resolved' ? 'btn-primary' : 'btn-ghost'}" data-status="${s}" ${ticket.status === s ? 'disabled' : ''}>${STATUS[s]}</button>`).join('')}
      </div>
    </div>

    <div class="act-section${/message|reply/.test(focus) ? ' focus' : ''}" id="message">
      <h2>Message ${esc(who)}</h2>
      ${thread.length ? `<ul class="act-thread">${thread.map((m) => m.kind === 'system'
        ? `<li class="sys">${esc(m.body)} · ${when(m.created_at)}</li>`
        : `<li><b>${esc(m.sender_name || m.sender_role)}</b> · ${when(m.created_at)}<br>${esc(m.body)}</li>`).join('')}</ul>` : ''}
      <label class="auth-field"><span>Your message (they see it on the ticket)</span>
        <textarea id="msgBody" maxlength="4000">${esc(job?.status === 'pushed' ? d.clientReply : '')}</textarea></label>
      <div class="act-row"><button class="btn btn-primary" id="sendMsg">Send message</button></div>
    </div>`;

  card.querySelector('.focus')?.scrollIntoView({ block: 'start' });
  clearInterval(timer);
  const t = card.querySelector('#timer');
  if (t) {
    const tick = () => {
      const left = new Date(job.deadline) - Date.now();
      t.textContent = left > 0 ? `in ${Math.floor(left / 60000)}m ${String(Math.floor(left / 1000) % 60).padStart(2, '0')}s` : 'any moment now';
    };
    tick(); timer = setInterval(tick, 1000);
  }

  card.querySelectorAll('[data-decide]').forEach((b) => b.addEventListener('click', async () => {
    const decision = b.dataset.decide;
    const note = card.querySelector('#changeNote')?.value.trim() || null;
    if (decision === 'changes' && !note) return say('Write what Claude should change first.', false);
    if (decision === 'discard' && !confirm('Throw this change away?')) return;
    b.disabled = true;
    const { error } = await supabase.from('automation_jobs').update({ decision, note }).eq('id', job.id);
    if (error) return say(error.message, false);
    await render();
    say({ approve: 'Approved — your PC will push it in a few seconds.', hold: 'On hold. Approve or discard it whenever you’re ready.',
          changes: 'Sent to Claude. You’ll get a new email when the update is ready.', discard: 'Discarded.' }[decision]);
  }));

  card.querySelectorAll('[data-status]').forEach((b) => b.addEventListener('click', async () => {
    b.disabled = true;
    const { error } = await supabase.from('tickets').update({ status: b.dataset.status }).eq('id', ticket.id);
    if (error) return say(error.message, false);
    await render();
    say(`Ticket marked ${STATUS[b.dataset.status]}. ${who} has been notified.`);
  }));

  card.querySelector('#sendMsg').addEventListener('click', async (e) => {
    const body = card.querySelector('#msgBody').value.trim();
    if (!body) return say('Write a message first.', false);
    e.target.disabled = true;
    const { error } = await supabase.from('ticket_messages').insert({ ticket_id: ticket.id, body });
    if (error) { e.target.disabled = false; return say(error.message, false); }
    await render();
    say(`Sent to ${who}.`);
  });
}

start();
