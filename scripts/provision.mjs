#!/usr/bin/env node
/* =====================================================================
   Creates (or reuses) a temporary Supabase project for this site and
   wires everything up:
     1. creates project "williams-systems-temp" in your first org
     2. waits until it is healthy
     3. applies supabase/schema.sql (tables, RLS, storage bucket, realtime)
     4. turns off public sign-ups (only invited team members can log in)
     5. creates the team login and marks it as admin
     6. writes .env.local, ADMIN-LOGIN.txt, and GitHub repo variables

   Needs a Supabase personal access token, from either:
     - env SUPABASE_ACCESS_TOKEN, or
     - a file named .supabase-token in the project root
   Create one at https://supabase.com/dashboard/account/tokens

   Usage:  npm run provision            (admin email defaults below)
           ADMIN_EMAIL=you@x.com npm run provision
   Safe to re-run: state is kept in .supabase-temp.json.
   ===================================================================== */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const p = (f) => join(ROOT, f);

const PROJECT_NAME = 'williams-systems-temp';
const REGION = process.env.SUPABASE_REGION || 'us-east-1';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'adapter127@gmail.com';
const SITE_URL = 'https://lwilliams027.github.io/williams-systems-llc/';
const REPO = 'lwilliams027/williams-systems-llc';
const STATE_FILE = p('.supabase-temp.json');

const token = (process.env.SUPABASE_ACCESS_TOKEN
  || (existsSync(p('.supabase-token')) ? readFileSync(p('.supabase-token'), 'utf8') : '')).trim();
if (!token) {
  console.error('No Supabase access token. Put one in .supabase-token or set SUPABASE_ACCESS_TOKEN.\nCreate it at https://supabase.com/dashboard/account/tokens');
  process.exit(1);
}

const state = existsSync(STATE_FILE) ? JSON.parse(readFileSync(STATE_FILE, 'utf8')) : {};
const save = () => writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const step = (msg) => console.log(`\n▸ ${msg}`);

async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(`https://api.supabase.com${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data; try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) {
    const err = new Error(`${method} ${path} → ${res.status}: ${typeof data === 'string' ? data : JSON.stringify(data)}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

async function sql(query, attempts = 6) {
  for (let i = 1; ; i++) {
    try { return await api(`/v1/projects/${state.ref}/database/query`, { method: 'POST', body: { query } }); }
    catch (e) {
      if (i >= attempts) throw e;
      console.log(`  database not ready yet (${e.status}), retrying…`);
      await sleep(10_000);
    }
  }
}

// ---------- 1. project ----------
if (!state.ref) {
  step('Finding your Supabase organization');
  const orgs = await api('/v1/organizations');
  if (!orgs?.length) throw new Error('No Supabase organizations on this account.');
  const org = orgs.find((o) => o.id === process.env.SUPABASE_ORG || o.slug === process.env.SUPABASE_ORG) || orgs[0];
  console.log(`  using "${org.name}" (${org.id})`);

  step(`Creating project "${PROJECT_NAME}" in ${REGION}`);
  state.dbPassword = randomBytes(18).toString('base64url');
  const project = await api('/v1/projects', {
    method: 'POST',
    body: { name: PROJECT_NAME, organization_id: org.id, db_pass: state.dbPassword, region: REGION },
  });
  state.ref = project.id || project.ref;
  state.org = org.id;
  save();
  console.log(`  project ref: ${state.ref}`);
} else {
  step(`Reusing project ${state.ref}`);
}
const URL_BASE = `https://${state.ref}.supabase.co`;

// ---------- 2. wait for healthy ----------
step('Waiting for the project to come online (usually 1–3 minutes)');
for (let i = 0; ; i++) {
  const proj = await api(`/v1/projects/${state.ref}`);
  if (proj.status === 'ACTIVE_HEALTHY') { console.log('  healthy'); break; }
  if (i > 60) throw new Error(`Project still ${proj.status} after 10 minutes.`);
  process.stdout.write(`  ${proj.status}…\r`);
  await sleep(10_000);
}

// ---------- 3. keys ----------
step('Fetching API keys');
const keys = await api(`/v1/projects/${state.ref}/api-keys?reveal=true`);
const pick = (...names) => keys.find((k) => names.includes(k.name) || names.includes(k.type))?.api_key;
const anonKey = pick('anon') || pick('publishable');
const serviceKey = pick('service_role') || pick('secret');
if (!anonKey || !serviceKey) throw new Error(`Couldn’t find API keys in: ${keys.map((k) => k.name).join(', ')}`);

// ---------- 4. schema ----------
step('Applying supabase/schema.sql');
await sql(readFileSync(p('supabase/schema.sql'), 'utf8'));
console.log('  tables, security rules, storage bucket, and realtime ready');

// ---------- 5. auth settings ----------
step('Locking down sign-ups and setting site URLs');
await api(`/v1/projects/${state.ref}/config/auth`, {
  method: 'PATCH',
  body: {
    disable_signup: true,
    site_url: SITE_URL,
    uri_allow_list: `${SITE_URL}**,http://127.0.0.1:5173/**,http://localhost:5173/**`,
  },
});

// ---------- 6. team login ----------
step(`Creating team login for ${ADMIN_EMAIL}`);
const authHeaders = serviceKey.startsWith('sb_')
  ? { apikey: serviceKey }
  : { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };
if (!state.adminPassword) {
  state.adminPassword = randomBytes(12).toString('base64url');
  const res = await fetch(`${URL_BASE}/auth/v1/admin/users`, {
    method: 'POST',
    headers: { ...authHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: state.adminPassword, email_confirm: true }),
  });
  if (!res.ok) {
    const body = await res.text();
    if (res.status === 422 && /already/i.test(body)) {
      delete state.adminPassword;
      console.log('  user already exists — keeping its current password');
    } else throw new Error(`Creating admin user failed (${res.status}): ${body}`);
  }
  save();
}
const safeEmail = ADMIN_EMAIL.replace(/'/g, "''");
await sql(`insert into public.admins (user_id) select id from auth.users where email = '${safeEmail}' on conflict do nothing;`);
console.log('  admin access granted');

// ---------- 7. outputs ----------
step('Writing .env.local and ADMIN-LOGIN.txt');
writeFileSync(p('.env.local'), `VITE_SUPABASE_URL=${URL_BASE}\nVITE_SUPABASE_ANON_KEY=${anonKey}\n`);
writeFileSync(p('ADMIN-LOGIN.txt'), [
  'Williams Systems LLC — team dashboard (TEMPORARY Supabase project)',
  '',
  `Dashboard (live):  ${SITE_URL}admin.html`,
  'Dashboard (local): http://127.0.0.1:5173/admin.html',
  `Email:             ${ADMIN_EMAIL}`,
  `Password:          ${state.adminPassword || '(unchanged — user already existed)'}`,
  '',
  `Supabase project:  https://supabase.com/dashboard/project/${state.ref}`,
  `Database password: ${state.dbPassword || '(set when the project was created elsewhere)'}`,
  '',
  'Keep this file private. It is git-ignored.',
  '',
].join('\n'));

step(`Setting GitHub repo variables on ${REPO}`);
try {
  execFileSync('gh', ['variable', 'set', 'VITE_SUPABASE_URL', '--repo', REPO, '--body', URL_BASE], { stdio: 'inherit' });
  execFileSync('gh', ['variable', 'set', 'VITE_SUPABASE_ANON_KEY', '--repo', REPO, '--body', anonKey], { stdio: 'inherit' });
} catch (e) {
  console.warn(`  couldn’t set repo variables (${e.message}). Set them by hand in GitHub → Settings → Variables.`);
}

console.log(`\n✔ Done. Supabase URL: ${URL_BASE}\n  Login details are in ADMIN-LOGIN.txt\n  Restart "npm run dev" so Vite picks up .env.local, and push to redeploy the live site.`);
