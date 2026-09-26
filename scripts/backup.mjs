#!/usr/bin/env node
/* =====================================================================
   Copies everything in Supabase to your private backup server.

     npm run backup:server     (in one window: starts the backup server)
     npm run backup            (takes a snapshot and pushes it)

   What goes in a snapshot
     · tables: admins, profiles, invites, access_requests, inquiries,
       inquiry_notes, contracts, contract_messages, events, activity,
       notifications
     · accounts (auth.users) — emails, names, dates; never password hashes
     · every uploaded file in storage (sent once, then reused by hash)

   Needs, all git-ignored in the project folder:
     .supabase-token        your Supabase personal access token
     .supabase-temp.json    which project (written by npm run provision)
     .backup-token          your backup key (written by the backup server)
   BACKUP_URL overrides the server address (default http://127.0.0.1:4420).
   ===================================================================== */
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => (existsSync(join(ROOT, f)) ? readFileSync(join(ROOT, f), 'utf8').trim() : '');
const fail = (msg) => { console.error(`✖ ${msg}`); process.exit(1); };

const pat = process.env.SUPABASE_ACCESS_TOKEN || read('.supabase-token');
const ref = process.env.SUPABASE_PROJECT_REF || (read('.supabase-temp.json') && JSON.parse(read('.supabase-temp.json')).ref);
const backupKey = process.env.BACKUP_TOKEN || read('.backup-token');
const SERVER = (process.env.BACKUP_URL || 'http://127.0.0.1:4420').replace(/\/$/, '');
if (!pat) fail('No Supabase access token (.supabase-token).');
if (!ref) fail('No project ref (.supabase-temp.json). Run npm run provision first.');
if (!backupKey) fail('No backup key (.backup-token). Start the backup server once: npm run backup:server');

const TABLES = ['admins', 'profiles', 'invites', 'access_requests', 'inquiries', 'inquiry_notes',
  'contracts', 'contract_messages', 'events', 'activity', 'notifications'];
const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(`https://api.supabase.com${path}`, {
    method,
    headers: { Authorization: `Bearer ${pat}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}
const sql = (query) => api(`/v1/projects/${ref}/database/query`, { method: 'POST', body: { query } });
const rows = async (query) => (await sql(`select coalesce(json_agg(t), '[]'::json) as rows from (${query}) t`))[0].rows;

async function server(path, { method = 'GET', body, type } = {}) {
  let res;
  try {
    res = await fetch(`${SERVER}${path}`, {
      method,
      headers: { Authorization: `Bearer ${backupKey}`, ...(type ? { 'Content-Type': type } : {}) },
      body,
    });
  } catch { fail(`Backup server isn’t running at ${SERVER}. Start it with: npm run backup:server`); }
  if (res.status === 401) fail('The backup server refused the backup key in .backup-token.');
  return res;
}

// ---------- 1. is the backup server there? ----------
const health = await fetch(`${SERVER}/health`).catch(() => null);
if (!health?.ok) fail(`Backup server isn’t running at ${SERVER}. Start it with: npm run backup:server`);

// ---------- 2. tables and accounts ----------
console.log(`▸ Reading project ${ref}`);
const tables = {};
for (const t of TABLES) {
  tables[t] = await rows(`select * from public.${t}`);
  console.log(`  ${t}: ${tables[t].length}`);
}
tables['auth.users'] = await rows(
  `select id, email, phone, raw_user_meta_data, raw_app_meta_data, email_confirmed_at, last_sign_in_at, created_at, updated_at
     from auth.users`,
);
console.log(`  accounts: ${tables['auth.users'].length}`);

// ---------- 3. uploaded files ----------
const objects = await rows(`select bucket_id, name, metadata, created_at from storage.objects where name not like '%.emptyFolderPlaceholder'`);
const files = [];
if (objects.length) {
  const keys = await api(`/v1/projects/${ref}/api-keys?reveal=true`);
  const serviceKey = keys.find((k) => ['service_role', 'secret'].includes(k.name) || k.type === 'secret')?.api_key;
  if (!serviceKey) fail('Couldn’t get a service key to download files.');
  const headers = serviceKey.startsWith('sb_') ? { apikey: serviceKey } : { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };

  for (const o of objects) {
    const path = o.name.split('/').map(encodeURIComponent).join('/');
    const res = await fetch(`https://${ref}.supabase.co/storage/v1/object/${o.bucket_id}/${path}`, { headers });
    if (!res.ok) { console.warn(`  couldn’t download ${o.bucket_id}/${o.name} (${res.status}) — skipped`); continue; }
    const buf = Buffer.from(await res.arrayBuffer());
    const sha = sha256(buf);
    if ((await server(`/files/${sha}`, { method: 'HEAD' })).status !== 200) {
      const put = await server(`/files/${sha}`, { method: 'PUT', body: buf, type: 'application/octet-stream' });
      if (!put.ok) fail(`Uploading ${o.name} failed (${put.status}).`);
    }
    files.push({ bucket: o.bucket_id, name: o.name, sha, size: buf.length, contentType: o.metadata?.mimetype || null, createdAt: o.created_at });
  }
}
console.log(`  files: ${files.length}`);

// ---------- 4. push the snapshot ----------
const snapshot = { version: 1, project: ref, takenAt: new Date().toISOString(), tables, files };
const res = await server('/snapshots', { method: 'PUT', body: JSON.stringify(snapshot), type: 'application/json' });
const out = await res.json().catch(() => ({}));
if (!res.ok) fail(`Backup server said ${res.status}: ${out.error || ''}`);
console.log(`\n✔ Backed up to ${SERVER} as ${out.name}`);
