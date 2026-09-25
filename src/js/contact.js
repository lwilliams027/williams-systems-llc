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

/* The phone in the hero is a real text box. On a phone, sending opens the
   texting app to our number with the message filled in. On a computer (which
   can't send texts), the words move into the "Send a message" form instead. */
const phone = document.getElementById('textPhone');
if (phone) {
  const input = phone.querySelector('input');
  const thread = phone.querySelector('.as-tp-thread');
  const tel = phone.dataset.tel;
  const canText = window.matchMedia('(pointer: coarse)').matches || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  const bubble = (cls, text) => {
    const p = document.createElement('p');
    p.className = cls;
    p.textContent = text;
    thread.append(p);
    thread.scrollTop = thread.scrollHeight;
  };
  phone.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) { input.focus(); return; }
    bubble('out', text);
    input.value = '';
    if (canText) {
      setTimeout(() => bubble('in', 'Opening your texting app, just hit send there. We reply within 24 hours.'), 500);
      // iPhones use "&body=", Android "?body="; "?&body=" works on both
      setTimeout(() => { window.location.href = `sms:${tel}?&body=${encodeURIComponent(text)}`; }, 900);
    } else {
      setTimeout(() => bubble('in', `Texting works from a phone, at ${tel.replace(/^\+1(\d{3})(\d{3})(\d{4})$/, '($1) $2-$3')}. I've put your message in the form below so you can send it from here.`), 500);
      setTimeout(() => {
        const msg = document.querySelector('#contactForm textarea[name="message"]');
        if (msg) msg.value = text;
        const tab = document.getElementById('tabMessage');
        if (tab) tab.click();
        document.querySelector('.as-reach')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        setTimeout(() => document.querySelector('#contactForm input[name="name"]')?.focus({ preventScroll: true }), 700);
      }, 1600);
    }
  });
}
