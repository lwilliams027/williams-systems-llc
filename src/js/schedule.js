/* =====================================================================
   Schedule page — pick a call type, a weekday, and a time, then send the
   request. There's no booking backend yet, so the request is sent by email
   (it opens the visitor's email app with everything filled in). When a
   calendar tool (Cal.com, Calendly) or Supabase is connected, swap send().
   ===================================================================== */
const EMAIL = 'lwilliams24270@gmail.com';
const $ = (s, r = document) => r.querySelector(s);

const form = $('#schedForm');
const daysBox = $('#schedDays');
const timesBox = $('#schedTimes');
const summary = $('#schedSummary');
const errBox = $('#schedError');
const done = $('#schedDone');
const state = { day: null, time: null };

const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
$('#schedTz').textContent = `(your time: ${tz.replace(/_/g, ' ')})`;

// Next 10 weekdays, starting tomorrow.
const days = [];
for (let d = new Date(), n = 0; days.length < 10 && n < 30; n++) {
  d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
  if (d.getDay() !== 0 && d.getDay() !== 6) days.push(d);
}
const TIMES = ['9:00 AM', '9:30 AM', '10:00 AM', '10:30 AM', '11:00 AM', '11:30 AM', '1:00 PM', '1:30 PM', '2:00 PM', '2:30 PM', '3:00 PM', '3:30 PM', '4:00 PM', '4:30 PM'];

const pick = (box, btn) => {
  box.querySelectorAll('button').forEach((b) => b.setAttribute('aria-checked', String(b === btn)));
};

days.forEach((d) => {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'sched-day';
  b.setAttribute('role', 'radio');
  b.setAttribute('aria-checked', 'false');
  b.innerHTML = `<small>${d.toLocaleDateString(undefined, { weekday: 'short' })}</small><b>${d.getDate()}</b><small>${d.toLocaleDateString(undefined, { month: 'short' })}</small>`;
  b.addEventListener('click', () => { state.day = d; pick(daysBox, b); update(); });
  daysBox.append(b);
});
TIMES.forEach((t) => {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'sched-time';
  b.setAttribute('role', 'radio');
  b.setAttribute('aria-checked', 'false');
  b.textContent = t;
  b.addEventListener('click', () => { state.time = t; pick(timesBox, b); update(); });
  timesBox.append(b);
});

const typeOf = () => form.querySelector('input[name="type"]:checked').value;
const dayText = () => state.day.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

function update() {
  if (state.day && state.time) summary.innerHTML = `<b>${typeOf()}</b> on <b>${dayText()}</b> at <b>${state.time}</b>`;
  else if (state.day) summary.textContent = 'Now pick a time.';
  else summary.textContent = 'Pick a day and a time.';
}
form.addEventListener('change', update);

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const data = new FormData(form);
  const name = String(data.get('name') || '').trim();
  const email = String(data.get('email') || '').trim();
  const problems = [];
  if (!state.day || !state.time) problems.push('pick a day and a time');
  if (!name) problems.push('add your name');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) problems.push('add a valid email');
  if (problems.length) {
    errBox.textContent = `Almost there: please ${problems.join(', ')}.`;
    errBox.hidden = false;
    return;
  }
  errBox.hidden = true;
  const when = `${dayText()} at ${state.time} (${tz})`;
  const body = [
    `Call type: ${typeOf()}`,
    `Requested time: ${when}`,
    `Name: ${name}`,
    `Email: ${email}`,
    `Company: ${String(data.get('company') || '').trim() || '-'}`,
    '',
    String(data.get('notes') || '').trim(),
  ].join('\n');
  window.location.href = `mailto:${EMAIL}?subject=${encodeURIComponent(`Call request: ${typeOf()}, ${when}`)}&body=${encodeURIComponent(body)}`;
  $('#schedDoneText').textContent = `We've prepared your request for a ${typeOf().toLowerCase()} on ${when}. Send the email that just opened, and we'll confirm the time.`;
  form.hidden = true;
  done.hidden = false;
  done.focus();
});

$('#schedAgain').addEventListener('click', () => { done.hidden = true; form.hidden = false; });
