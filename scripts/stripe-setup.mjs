#!/usr/bin/env node
/* =====================================================================
   Connects Stripe. Run once (and again whenever you change keys):

     1. Put your Stripe SECRET key in a file named .stripe-key in the
        project folder (git-ignored). Start with the test key: sk_test_…
     2. npm run stripe:setup

   What it does
     · checks the key with Stripe
     · stores it as a Supabase Edge Function secret (never in the code)
     · deploys the stripe-link and stripe-webhook functions
     · creates the Stripe webhook that tells the site when a bill is paid,
       and stores its signing secret
     · marks Stripe as connected, so invoices get payment links

   Re-running is safe. Switching from test to live: put the live key
   (sk_live_…) in .stripe-key and run it again.
   ===================================================================== */
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => (existsSync(join(ROOT, f)) ? readFileSync(join(ROOT, f), 'utf8').trim() : '');
const fail = (msg) => { console.error(`✖ ${msg}`); process.exit(1); };
const step = (msg) => console.log(`\n▸ ${msg}`);

const pat = process.env.SUPABASE_ACCESS_TOKEN || read('.supabase-token');
const ref = process.env.SUPABASE_PROJECT_REF || (read('.supabase-temp.json') && JSON.parse(read('.supabase-temp.json')).ref);
const key = process.env.STRIPE_SECRET_KEY || read('.stripe-key');
if (!pat) fail('No Supabase access token (.supabase-token).');
if (!ref) fail('No project ref (.supabase-temp.json).');

async function api(path, { method = 'GET', body, form } = {}) {
  const res = await fetch(`https://api.supabase.com${path}`, {
    method,
    headers: { Authorization: `Bearer ${pat}`, ...(form ? {} : { 'Content-Type': 'application/json' }) },
    body: form || (body ? JSON.stringify(body) : undefined),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}
const sql = (query) => api(`/v1/projects/${ref}/database/query`, { method: 'POST', body: { query } });

/** Deploy one function from supabase/functions/<name>/index.ts */
export async function deployFunction(name, { verifyJwt = false } = {}) {
  const form = new FormData();
  form.append('metadata', JSON.stringify({ entrypoint_path: 'index.ts', name, verify_jwt: verifyJwt }));
  form.append('file', new Blob([readFileSync(join(ROOT, 'supabase/functions', name, 'index.ts'))], { type: 'application/typescript' }), 'index.ts');
  return api(`/v1/projects/${ref}/functions/deploy?slug=${name}`, { method: 'POST', form });
}

async function stripe(path, params, method = 'POST') {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method,
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: method === 'GET' || method === 'DELETE' ? undefined : new URLSearchParams(params),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || `Stripe said ${res.status}`);
  return data;
}

const onlyDeploy = process.argv.includes('--deploy-only');
step('Deploying the payment functions');
await deployFunction('stripe-link');
await deployFunction('stripe-webhook');
console.log('  stripe-link, stripe-webhook deployed');
if (!onlyDeploy) await connect();

async function connect() {
if (!key) fail('Put your Stripe secret key in a file named .stripe-key (it starts with sk_test_ or sk_live_), then run this again.');
if (!/^(sk|rk)_(test|live)_/.test(key)) fail('That doesn’t look like a Stripe secret key. It starts with sk_test_ or sk_live_ (Stripe → Developers → API keys).');
const mode = key.includes('_test_') ? 'test' : 'live';

step(`Checking the key with Stripe (${mode} mode)`);
const acct = await stripe('account', null, 'GET');
const name = acct.settings?.dashboard?.display_name || acct.business_profile?.name || acct.email || acct.id;
console.log(`  connected to ${name}`);

step('Creating the webhook (Stripe → your site when a bill is paid)');
const url = `https://${ref}.supabase.co/functions/v1/stripe-webhook`;
const existing = await stripe('webhook_endpoints?limit=100', null, 'GET');
for (const w of existing.data.filter((x) => x.url === url)) await stripe(`webhook_endpoints/${w.id}`, null, 'DELETE');
const hook = await stripe('webhook_endpoints', {
  url,
  'enabled_events[0]': 'checkout.session.completed',
  'enabled_events[1]': 'checkout.session.async_payment_succeeded',
  description: 'Williams Systems site: mark invoices paid',
});
console.log(`  ${hook.id}`);

step('Storing the keys as Supabase secrets');
await api(`/v1/projects/${ref}/secrets`, { method: 'POST', body: [
  { name: 'STRIPE_SECRET_KEY', value: key },
  { name: 'STRIPE_WEBHOOK_SECRET', value: hook.secret },
] });
console.log('  STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET set');

await sql(`insert into public.app_settings (key, value, updated_at)
  values ('stripe', '${JSON.stringify({ connected: true, mode, account: name, connectedAt: new Date().toISOString() }).replace(/'/g, "''")}'::jsonb, now())
  on conflict (key) do update set value = excluded.value, updated_at = now();`);

console.log(`\n✔ Stripe is connected in ${mode} mode. New invoices get a payment link automatically.`);
if (mode === 'test') console.log('  Test card: 4242 4242 4242 4242, any future date, any CVC.');
}
