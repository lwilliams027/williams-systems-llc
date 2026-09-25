/* Contact page form. There's no backend yet, so the message is sent by email:
   it opens the visitor's email app with everything filled in. When a form
   service or Supabase is connected, replace send(). */
const TO = 'lwilliams24270@gmail.com';
const form = document.getElementById('contactForm');
if (form) {
  const err = document.getElementById('contactError');
  const sent = document.getElementById('contactSent');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const d = new FormData(form);
    const name = String(d.get('name') || '').trim();
    const email = String(d.get('email') || '').trim();
    const needs = d.getAll('needs');
    const problems = [];
    if (!name) problems.push('add your name');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) problems.push('add a valid email');
    if (problems.length) { err.textContent = `Almost there: please ${problems.join(' and ')}.`; err.hidden = false; return; }
    err.hidden = true;
    const body = [
      `Name: ${name}`, `Email: ${email}`, `Phone: ${String(d.get('phone') || '').trim() || '-'}`,
      `Needs: ${needs.length ? needs.join(', ') : '-'}`, '', String(d.get('message') || '').trim(),
    ].join('\n');
    window.location.href = `mailto:${TO}?subject=${encodeURIComponent(`New inquiry from ${name}`)}&body=${encodeURIComponent(body)}`;
    sent.hidden = false;
    sent.focus();
  });
}
