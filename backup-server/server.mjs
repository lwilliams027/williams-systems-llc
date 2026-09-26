/* =============================================================================
   Williams Systems LLC — private backup server

   A second home for everything in Supabase (accounts, invites, requests,
   inquiries, notes, and uploaded files), in the spirit of the Face & Mane
   records server: tiny, dependency-free, `node server.mjs` and it runs.

   Only you can push to it:
     · every request (except /health) needs your backup key, sent as
       "Authorization: Bearer <key>". The key lives only in .backup-token in
       the project folder (git-ignored); this server keeps just its SHA-256.
     · by default it only listens on this computer (127.0.0.1). Set
       BACKUP_HOST=0.0.0.0 to reach it from other machines on your network.
     · the website never talks to it.

   Storage (backup-server/data, git-ignored)
     snapshots/backup-<time>.json   one full copy per backup, newest KEEP kept
     files/<sha256>                 uploaded files, stored once however many
                                    snapshots mention them
     key.sha256                     the hash of your backup key

   API (all but /health need the key)
     GET  /health                 → { ok }
     GET  /                       → status page
     GET  /snapshots              → [{ name, size, createdAt }] newest first
     GET  /snapshots/:name        → that snapshot (JSON)
     PUT  /snapshots              → body: snapshot JSON → { name }
     HEAD /files/:sha             → 200 if stored, 404 if not
     PUT  /files/:sha             → raw bytes (checked against the sha) → { sha }
     GET  /files/:sha             → the bytes

   First run with no key: one is made, written to ../.backup-token, and printed.
   Rotate it any time with:  node server.mjs --new-key
============================================================================= */
import http from 'node:http';
import { createReadStream, existsSync } from 'node:fs';
import { mkdir, readFile, writeFile, readdir, stat, unlink, rename } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const DATA = process.env.BACKUP_DATA_DIR || path.join(HERE, 'data');
const SNAPS = path.join(DATA, 'snapshots');
const FILES = path.join(DATA, 'files');
const KEY_HASH = path.join(DATA, 'key.sha256');
const KEY_FILE = path.join(ROOT, '.backup-token');
const HOST = process.env.BACKUP_HOST || '127.0.0.1';
const PORT = Number(process.env.BACKUP_PORT || 4420);
const KEEP = Number(process.env.BACKUP_KEEP || 60);
const MAX_BODY = 200 * 1024 * 1024;               // 200 MB per request

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

await mkdir(SNAPS, { recursive: true });
await mkdir(FILES, { recursive: true });

/* ------------------------------ the backup key ------------------------------ */
async function ensureKey() {
  if (process.argv.includes('--new-key') || !existsSync(KEY_HASH)) {
    const key = randomBytes(32).toString('base64url');
    await writeFile(KEY_HASH, sha256(key));
    await writeFile(KEY_FILE, key);
    console.log(`\n  New backup key written to ${KEY_FILE}`);
    console.log('  (git-ignored; it is the only copy — the server keeps just its hash)\n');
  }
  return Buffer.from((await readFile(KEY_HASH, 'utf8')).trim(), 'hex');
}
const keyHash = await ensureKey();

function authorized(req) {
  const m = /^Bearer\s+(.+)$/.exec(req.headers.authorization || '');
  if (!m) return false;
  const given = Buffer.from(sha256(m[1].trim()), 'hex');
  return given.length === keyHash.length && timingSafeEqual(given, keyHash);
}

/* --------------------------------- helpers ---------------------------------- */
function send(res, status, body, type = 'application/json') {
  const data = type === 'application/json' ? JSON.stringify(body) : body;
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(data);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) { reject(Object.assign(new Error('too large'), { status: 413 })); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function listSnapshots() {
  const names = (await readdir(SNAPS)).filter((f) => /^backup-[\w.-]+\.json$/.test(f)).sort().reverse();
  return Promise.all(names.map(async (name) => {
    const s = await stat(path.join(SNAPS, name));
    return { name, size: s.size, createdAt: s.mtime.toISOString() };
  }));
}

// keep the newest KEEP snapshots, and only the files that a kept snapshot mentions
async function prune() {
  const snaps = await listSnapshots();
  for (const old of snaps.slice(KEEP)) await unlink(path.join(SNAPS, old.name)).catch(() => {});
  const wanted = new Set();
  for (const s of snaps.slice(0, KEEP)) {
    try { for (const f of JSON.parse(await readFile(path.join(SNAPS, s.name), 'utf8')).files || []) wanted.add(f.sha); } catch { /* unreadable: keep its files */ return; }
  }
  for (const f of await readdir(FILES)) if (!wanted.has(f)) await unlink(path.join(FILES, f)).catch(() => {});
}

/* --------------------------------- server ----------------------------------- */
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const parts = url.pathname.split('/').filter(Boolean);
  try {
    if (req.method === 'GET' && url.pathname === '/health') return send(res, 200, { ok: true });
    if (!authorized(req)) return send(res, 401, { error: 'backup key required' });

    if (req.method === 'GET' && parts.length === 0) {
      const snaps = await listSnapshots();
      const files = (await readdir(FILES)).length;
      return send(res, 200, `<!doctype html><meta charset="utf-8"><title>Backups</title><body style="font:15px system-ui;background:#0b0c10;color:#e5e7eb;padding:40px"><h1>Williams Systems backups</h1><p>${snaps.length} snapshots (keeping ${KEEP}) · ${files} files</p><ul>${snaps.slice(0, 20).map((s) => `<li>${s.name} · ${(s.size / 1024).toFixed(1)} KB</li>`).join('')}</ul></body>`, 'text/html; charset=utf-8');
    }

    if (parts[0] === 'snapshots') {
      if (req.method === 'GET' && parts.length === 1) return send(res, 200, await listSnapshots());
      if (req.method === 'GET' && parts.length === 2) {
        if (!/^backup-[\w.-]+\.json$/.test(parts[1])) return send(res, 400, { error: 'bad name' });
        const file = path.join(SNAPS, parts[1]);
        if (!existsSync(file)) return send(res, 404, { error: 'not found' });
        res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
        return createReadStream(file).pipe(res);
      }
      if (req.method === 'PUT' && parts.length === 1) {
        const body = await readBody(req);
        const snap = JSON.parse(body.toString('utf8'));
        if (!snap || typeof snap !== 'object' || !snap.tables) return send(res, 400, { error: 'not a snapshot' });
        const missing = (snap.files || []).filter((f) => !existsSync(path.join(FILES, f.sha)));
        if (missing.length) return send(res, 409, { error: 'files missing', missing: missing.map((f) => f.sha) });
        const name = `backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
        const tmp = path.join(SNAPS, `.${name}.tmp`);
        await writeFile(tmp, body);
        await rename(tmp, path.join(SNAPS, name));
        await prune();
        console.log(`  saved ${name} (${(body.length / 1024).toFixed(1)} KB)`);
        return send(res, 201, { name });
      }
    }

    if (parts[0] === 'files' && parts.length === 2) {
      const sha = parts[1];
      if (!/^[0-9a-f]{64}$/.test(sha)) return send(res, 400, { error: 'bad sha' });
      const file = path.join(FILES, sha);
      if (req.method === 'HEAD') { res.writeHead(existsSync(file) ? 200 : 404); return res.end(); }
      if (req.method === 'GET') {
        if (!existsSync(file)) return send(res, 404, { error: 'not found' });
        res.writeHead(200, { 'Content-Type': 'application/octet-stream', 'Cache-Control': 'no-store' });
        return createReadStream(file).pipe(res);
      }
      if (req.method === 'PUT') {
        const body = await readBody(req);
        if (sha256(body) !== sha) return send(res, 400, { error: 'bytes do not match the sha' });
        if (!existsSync(file)) await writeFile(file, body);
        return send(res, 201, { sha });
      }
    }

    send(res, 404, { error: 'not found' });
  } catch (err) {
    send(res, err.status || 500, { error: err.status ? err.message : 'server error' });
    if (!err.status) console.error(err);
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Williams Systems backup server on http://${HOST}:${PORT}`);
  console.log(`  data: ${DATA}  ·  keeping the newest ${KEEP} snapshots`);
  if (HOST === '127.0.0.1') console.log('  only reachable from this computer (set BACKUP_HOST=0.0.0.0 to change)');
});
