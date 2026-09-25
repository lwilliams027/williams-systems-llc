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

/* Contact page tabs: "Book a free call" and "Send a message".
   contact.html#book and contact.html#message open the matching tab. */
const tabs = [...document.querySelectorAll('.as-tab')];
if (tabs.length) {
  const show = (id, focus) => {
    tabs.forEach((t) => {
      const on = t.getAttribute('aria-controls') === id;
      t.classList.toggle('on', on);
      t.setAttribute('aria-selected', String(on));
      document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
    });
    if (focus) document.querySelector('.as-reach').scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  tabs.forEach((t) => t.addEventListener('click', () => { show(t.getAttribute('aria-controls')); history.replaceState(null, '', '#' + t.getAttribute('aria-controls')); }));
  const fromHash = () => { const id = location.hash.slice(1); if (id === 'book' || id === 'message') show(id, true); };
  window.addEventListener('hashchange', fromHash);
  if (location.hash) setTimeout(fromHash, 300);
}
