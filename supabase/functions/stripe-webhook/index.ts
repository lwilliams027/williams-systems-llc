// =====================================================================
// stripe-webhook — Stripe calls this when someone pays. It checks the
// signature, then marks that invoice paid (which notifies the client,
// logs it, and lifts an account hold) and retires the payment link.
//
// Secrets (set by scripts/stripe-setup.mjs): STRIPE_SECRET_KEY,
// STRIPE_WEBHOOK_SECRET. Deployed without JWT checks: Stripe signs
// its requests instead.
// =====================================================================
const SB_URL = Deno.env.get('SUPABASE_URL')!;
const SB_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const sbHeaders = { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, 'Content-Type': 'application/json' };
const enc = new TextEncoder();

async function verify(body: string, header: string, secret: string) {
  const parts = Object.fromEntries(header.split(',').map((p) => p.split('=')).map(([k, ...v]) => [k, v.join('=')]));
  const t = Number(parts.t);
  const sigs = header.split(',').filter((p) => p.startsWith('v1=')).map((p) => p.slice(3));
  if (!t || !sigs.length || Math.abs(Date.now() / 1000 - t) > 300) return false;
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(`${t}.${body}`)));
  const hex = [...mac].map((b) => b.toString(16).padStart(2, '0')).join('');
  // constant-time compare
  return sigs.some((s) => s.length === hex.length && [...s].reduce((d, ch, i) => d | (ch.charCodeAt(0) ^ hex.charCodeAt(i)), 0) === 0);
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Use POST', { status: 405 });
  const secret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
  if (!secret) return new Response('Not configured', { status: 503 });
  const body = await req.text();
  if (!(await verify(body, req.headers.get('Stripe-Signature') || '', secret))) return new Response('Bad signature', { status: 400 });

  const event = JSON.parse(body);
  if (!['checkout.session.completed', 'checkout.session.async_payment_succeeded'].includes(event.type)) return new Response('ignored');
  const s = event.data.object;
  if (s.payment_status !== 'paid') return new Response('not paid yet');

  // find the invoice: by its payment link, or the id we tucked into the metadata
  const byLink = s.payment_link ? `stripe_link_id=eq.${encodeURIComponent(s.payment_link)}` : null;
  const id = s.metadata?.invoice_id;
  const q = byLink || (id && /^[0-9a-f-]{36}$/i.test(id) ? `id=eq.${id}` : null);
  if (!q) return new Response('no invoice');
  const [inv] = await fetch(`${SB_URL}/rest/v1/invoices?${q}&select=id,status`, { headers: sbHeaders }).then((r) => r.json());
  if (!inv) return new Response('invoice not found');
  if (inv.status !== 'paid') {
    await fetch(`${SB_URL}/rest/v1/invoices?id=eq.${inv.id}`, {
      method: 'PATCH', headers: sbHeaders,
      body: JSON.stringify({ status: 'paid', paid_via: 'stripe', stripe_payment_id: s.payment_intent || s.id }),
    });
  }
  if (s.payment_link && Deno.env.get('STRIPE_SECRET_KEY')) {
    await fetch(`https://api.stripe.com/v1/payment_links/${s.payment_link}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${Deno.env.get('STRIPE_SECRET_KEY')}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'active=false',
    }).catch(() => null);
  }
  return new Response('ok');
});
