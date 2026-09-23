/* =====================================================================
   Project inquiry form — validation, drag-and-drop attachments,
   uploads to Supabase Storage, and a row in public.inquiries.
   The Supabase client is loaded lazily so it doesn't weigh down page load.
   ===================================================================== */
import { gsap } from 'gsap';
import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin';

gsap.registerPlugin(DrawSVGPlugin);

const MAX_FILES = 10;
const MAX_BYTES = 25 * 1024 * 1024;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const FALLBACK_EMAIL = 'adapter127@gmail.com';

export function initInquiryForm({ reduced = false } = {}) {
  const form = document.getElementById('inquiryForm');
  if (!form) return;

  const body      = form.querySelector('#inquiryBody');
  const success   = form.querySelector('#inquirySuccess');
  const dropzone  = form.querySelector('#dropzone');
  const input     = form.querySelector('#fileInput');
  const list      = form.querySelector('#fileList');
  const errorBox  = form.querySelector('#formError');
  const progress  = form.querySelector('#formProgress');
  const bar       = progress.querySelector('i');
  const submitBtn = form.querySelector('#submitBtn');
  const btnLabel  = submitBtn.querySelector('.btn-label');

  /** @type {{ file: File, status: string, el: HTMLLIElement }[]} */
  let items = [];
  let busy = false;
  let clientPromise = null;
  const getClient = () => (clientPromise ||= import('./supabase.js'));

  // Start fetching the Supabase client as soon as someone engages with the form.
  form.addEventListener('focusin', () => { getClient(); }, { once: true });

  /* ---------- attachments ---------- */
  dropzone.addEventListener('click', () => { if (!busy) input.click(); });
  input.addEventListener('change', () => { addFiles(input.files); input.value = ''; });

  ['dragenter', 'dragover'].forEach((type) =>
    dropzone.addEventListener(type, (e) => { e.preventDefault(); if (!busy) dropzone.classList.add('drag'); }));
  ['dragleave', 'dragend'].forEach((type) =>
    dropzone.addEventListener(type, () => dropzone.classList.remove('drag')));
  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('drag');
    if (!busy && e.dataTransfer?.files?.length) addFiles(e.dataTransfer.files);
  });

  function addFiles(fileList) {
    const skipped = [];
    const added = [];
    for (const file of fileList) {
      if (items.length >= MAX_FILES) { skipped.push(`${file.name} (max ${MAX_FILES} files)`); continue; }
      if (file.size > MAX_BYTES)     { skipped.push(`${file.name} (over 25 MB)`); continue; }
      if (file.size === 0)           { skipped.push(`${file.name} (empty)`); continue; }
      if (items.some((it) => it.file.name === file.name && it.file.size === file.size)) continue;
      const item = { file, status: 'ready', el: null };
      item.el = renderFile(item);
      items.push(item);
      added.push(item.el);
    }
    list.append(...added);
    if (added.length && !reduced) {
      gsap.from(added, { y: 10, autoAlpha: 0, duration: 0.4, stagger: 0.05, ease: 'power3.out' });
    }
    showError(skipped.length ? `Skipped: ${skipped.join(', ')}.` : '');
  }

  function renderFile(item) {
    const li = document.createElement('li');
    li.className = 'file';
    li.dataset.status = 'ready';

    const ext = document.createElement('span');
    ext.className = 'file-ext';
    ext.textContent = (item.file.name.split('.').pop() || 'file').slice(0, 4);

    const info = document.createElement('span');
    info.className = 'file-info';
    const name = document.createElement('span');
    name.className = 'file-name';
    name.textContent = item.file.name;
    name.title = item.file.name;
    const meta = document.createElement('span');
    meta.className = 'file-meta';
    meta.textContent = formatBytes(item.file.size);
    info.append(name, meta);

    const state = document.createElement('span');
    state.className = 'file-state';
    state.textContent = 'Ready';

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'file-remove';
    remove.setAttribute('aria-label', `Remove ${item.file.name}`);
    remove.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';
    remove.addEventListener('click', () => {
      if (busy) return;
      items = items.filter((it) => it !== item);
      const done = () => li.remove();
      reduced ? done() : gsap.to(li, { autoAlpha: 0, x: 12, height: 0, marginTop: 0, paddingBlock: 0, duration: 0.3, ease: 'power2.in', onComplete: done });
    });

    li.append(ext, info, state, remove);
    return li;
  }

  function setFileStatus(item, status) {
    item.status = status;
    item.el.dataset.status = status;
    item.el.querySelector('.file-state').textContent =
      { ready: 'Ready', uploading: 'Uploading…', done: 'Uploaded', error: 'Failed' }[status];
  }

  /* ---------- validation ---------- */
  function readValues() {
    const data = new FormData(form);
    const text = (k) => String(data.get(k) || '').trim();
    return {
      name: text('name'),
      email: text('email'),
      company: text('company') || null,
      phone: text('phone') || null,
      services: data.getAll('services').map(String),
      budget: text('budget') || null,
      timeline: text('timeline') || null,
      message: text('message'),
      honeypot: text('website'),
    };
  }

  function validate(v) {
    const errors = {};
    if (!v.name) errors.name = 'Please tell us your name.';
    if (!v.email) errors.email = 'We need an email to reply to.';
    else if (!EMAIL_RE.test(v.email)) errors.email = 'That email doesn’t look right.';
    if (!v.message) errors.message = 'A sentence or two about the project helps a lot.';

    form.querySelectorAll('[data-field]').forEach((field) => {
      const key = field.dataset.field;
      const control = field.querySelector('input, textarea');
      field.querySelector('.field-error')?.remove();
      field.classList.toggle('invalid', Boolean(errors[key]));
      control.setAttribute('aria-invalid', errors[key] ? 'true' : 'false');
      if (errors[key]) {
        const msg = document.createElement('small');
        msg.className = 'field-error';
        msg.textContent = errors[key];
        field.append(msg);
      }
    });

    const firstBad = form.querySelector('.field.invalid input, .field.invalid textarea');
    if (firstBad) {
      firstBad.focus({ preventScroll: true });
      firstBad.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' });
      if (!reduced) gsap.fromTo(firstBad, { x: -6 }, { x: 0, duration: 0.5, ease: 'elastic.out(1, 0.3)' });
      return false;
    }
    return true;
  }

  // Clear a field's error as soon as the user fixes it.
  form.addEventListener('input', (e) => {
    const field = e.target.closest('[data-field].invalid');
    if (!field) return;
    field.classList.remove('invalid');
    field.querySelector('.field-error')?.remove();
    e.target.setAttribute('aria-invalid', 'false');
  });

  /* ---------- submit ---------- */
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (busy) return;

    const values = readValues();
    if (!validate(values)) return;
    showError('');

    // Bots fill the hidden field; pretend it worked and store nothing.
    if (values.honeypot) { showSuccess(values, crypto.randomUUID()); return; }

    setBusy(true);
    try {
      const { supabase, isConfigured, BUCKET } = await getClient();
      if (!isConfigured) {
        throw new Error(`The online form isn’t connected yet. Please email ${FALLBACK_EMAIL} instead.`);
      }

      const id = crypto.randomUUID();
      const totalBytes = items.reduce((n, it) => n + it.file.size, 0) || 1;
      let doneBytes = 0;
      setProgress(0.04);

      // Upload attachments in parallel into inquiries/<id>/...
      const results = await Promise.allSettled(items.map(async (item, i) => {
        setFileStatus(item, 'uploading');
        const path = `inquiries/${id}/${String(i + 1).padStart(2, '0')}-${safeName(item.file.name)}`;
        const { error } = await supabase.storage.from(BUCKET).upload(path, item.file, {
          contentType: item.file.type || 'application/octet-stream',
          upsert: false,
        });
        if (error) { setFileStatus(item, 'error'); throw new Error(`${item.file.name}: ${error.message}`); }
        setFileStatus(item, 'done');
        doneBytes += item.file.size;
        setProgress(0.04 + 0.86 * (doneBytes / totalBytes));
        return { path, name: item.file.name, size: item.file.size, type: item.file.type || null };
      }));

      const failed = results.filter((r) => r.status === 'rejected');
      if (failed.length) {
        throw new Error(`Couldn’t upload ${failed.length === 1 ? 'a file' : `${failed.length} files`} (${failed.map((f) => f.reason.message).join('; ')}). Please try again.`);
      }

      const { honeypot, ...row } = values;
      const { error } = await supabase.from('inquiries').insert({
        id,
        ...row,
        files: results.map((r) => r.value),
      });
      if (error) throw new Error(`We couldn’t save your inquiry (${error.message}). Please try again or email ${FALLBACK_EMAIL}.`);

      setProgress(1);
      showSuccess(values, id);
    } catch (err) {
      items.forEach((it) => { if (it.status !== 'error') setFileStatus(it, 'ready'); });
      showError(err?.message || `Something went wrong. Please try again or email ${FALLBACK_EMAIL}.`);
    } finally {
      setBusy(false);
    }
  });

  function setBusy(on) {
    busy = on;
    submitBtn.disabled = on;
    btnLabel.textContent = on ? (items.length ? 'Uploading…' : 'Sending…') : 'Send inquiry';
    submitBtn.classList.toggle('loading', on);
    list.querySelectorAll('.file-remove').forEach((b) => { b.disabled = on; });
    dropzone.disabled = on;
    if (on) { progress.hidden = false; gsap.set(bar, { scaleX: 0 }); }
    else gsap.delayedCall(0.4, () => { progress.hidden = true; });
  }

  function setProgress(p) {
    gsap.to(bar, { scaleX: Math.min(1, p), duration: reduced ? 0 : 0.4, ease: 'power2.out' });
  }

  function showError(msg) {
    errorBox.textContent = msg;
    const wasHidden = errorBox.hidden;
    errorBox.hidden = !msg;
    if (msg && wasHidden && !reduced) gsap.from(errorBox, { y: -6, autoAlpha: 0, duration: 0.3 });
  }

  function showSuccess(values, id) {
    form.querySelector('#successText').textContent =
      `Thanks, ${values.name.split(' ')[0]}. We’ll reply to ${values.email} with next steps${items.length ? ` — and we have your ${items.length === 1 ? 'file' : `${items.length} files`}` : ''}.`;
    form.querySelector('#successRef').textContent = `Reference · WS-${id.slice(0, 8).toUpperCase()}`;

    const swap = () => {
      body.hidden = true;
      success.hidden = false;
      success.focus({ preventScroll: true });
    };
    if (reduced) { swap(); return; }

    const check = success.querySelectorAll('.success-check circle, .success-check path');
    gsap.timeline()
      .to(body, { autoAlpha: 0, y: -12, duration: 0.35, ease: 'power2.in' })
      .add(swap)
      .set(body, { clearProps: 'all' })
      .from(success.children, { y: 16, autoAlpha: 0, duration: 0.6, stagger: 0.08, ease: 'power3.out' })
      .from(check, { drawSVG: '0%', duration: 0.7, stagger: 0.25, ease: 'power2.inOut' }, '<0.1');
  }

  form.querySelector('#sendAnother').addEventListener('click', () => {
    form.reset();
    items = [];
    list.replaceChildren();
    showError('');
    progress.hidden = true;
    gsap.set(bar, { scaleX: 0 });
    success.hidden = true;
    body.hidden = false;
    if (!reduced) gsap.from(body, { autoAlpha: 0, y: 12, duration: 0.5, ease: 'power3.out' });
    form.querySelector('[name="name"]').focus();
  });
}

function safeName(name) {
  const cleaned = name.normalize('NFKD').replace(/[^\w.-]+/g, '-').replace(/-+/g, '-').replace(/^[-.]+/, '');
  return (cleaned || 'file').slice(-100);
}

function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
