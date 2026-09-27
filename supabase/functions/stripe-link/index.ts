// =====================================================================
// stripe-link — owners only. Makes (or retires) the Stripe payment link
// for one invoice, so the client's Pay now opens a checkout for exactly
// that amount.
//
//   POST { invoice_id, action?: 'create' | 'deactivate', return_url? }
//
// Secrets (set by scripts/stripe-setup.mjs, never in the code):
//   STRIPE_SECRET_KEY
// Supabase provides SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
// =====================================================================
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const SB_URL = Deno.env.get('SUPABASE_URL')!;
const SB_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const sbHeaders = { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, 'Content-Type': 'application/json' };

async function stripe(path: string, params: Record<string, string> = {}, method = 'POST') {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method,
    headers: { Authorization: `Bearer ${Deno.env.get('STRIPE_SECRET_KEY')}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: method === 'GET' ? undefined : new URLSearchParams(params),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || `Stripe said ${res.status}`);
  return data;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Use POST.' }, 405);
  if (!Deno.env.get('STRIPE_SECRET_KEY')) return json({ error: 'Stripe isn’t connected yet.' }, 503);

  // who's asking? only owners may make payment links
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  const who = await fetch(`${SB_URL}/auth/v1/user`, { headers: { apikey: SB_KEY, Authorization: `Bearer ${token}` } });
  if (!who.ok) return json({ error: 'Sign in again.' }, 401);
  const user = await who.json();
  const admin = await fetch(`${SB_URL}/rest/v1/admins?user_id=eq.${user.id}&select=user_id`, { headers: sbHeaders }).then((r) => r.json());
  if (!Array.isArray(admin) || !admin.length) return json({ error: 'Owners only.' }, 403);

  const { invoice_id, action = 'create', return_url } = await req.json().catch(() => ({}));
  if (!/^[0-9a-f-]{36}$/i.test(invoice_id || '')) return json({ error: 'Which invoice?' }, 400);
  const [inv] = await fetch(`${SB_URL}/rest/v1/invoices?id=eq.${invoice_id}&select=*,contracts(title)`, { headers: sbHeaders }).then((r) => r.json());
  if (!inv) return json({ error: 'That invoice doesn’t exist.' }, 404);
  const save = (patch: Record<string, unknown>) =>
    fetch(`${SB_URL}/rest/v1/invoices?id=eq.${invoice_id}`, { method: 'PATCH', headers: { ...sbHeaders, Prefer: 'return=representation' }, body: JSON.stringify(patch) }).then((r) => r.json());

  try {
    // retire the old link (paid, void, or the amount changed)
    if (inv.stripe_link_id) {
      await stripe(`payment_links/${inv.stripe_link_id}`, { active: 'false' }).catch(() => null);
    }
    if (action === 'deactivate') {
      if (inv.status !== 'paid') await save({ stripe_link_id: null, pay_link: inv.stripe_link_id ? null : inv.pay_link });
      return json({ ok: true });
    }
    if (!['draft', 'sent'].includes(inv.status)) return json({ error: 'Only unpaid invoices get a payment link.' }, 400);
    const cents = Math.round(Number(inv.amount) * 100);
    if (!(cents >= 50)) return json({ error: 'Stripe needs at least $0.50.' }, 400);

    const price = await stripe('prices', {
      currency: 'usd',
      unit_amount: String(cents),
      'product_data[name]': `Invoice #${inv.number} · ${inv.title}`.slice(0, 250),
      'product_data[metadata][invoice_id]': inv.id,
    });
    const params: Record<string, string> = {
      'line_items[0][price]': price.id,
      'line_items[0][quantity]': '1',
      'metadata[invoice_id]': inv.id,
      'payment_intent_data[metadata][invoice_id]': inv.id,
      'payment_intent_data[description]': `Williams Systems LLC · Invoice #${inv.number}${inv.contracts?.title ? ` · ${inv.contracts.title}` : ''}`,
      'restrictions[completed_sessions][limit]': '1',   // one payment per bill
    };
    // back to their Billing page afterwards (Stripe wants a real https address)
    if (typeof return_url === 'string' && /^https:\/\//i.test(return_url) && return_url.length < 500) {
      params['after_completion[type]'] = 'redirect';
      params['after_completion[redirect][url]'] = return_url;
    } else {
      params['after_completion[type]'] = 'hosted_confirmation';
      params['after_completion[hosted_confirmation][custom_message]'] = 'Thank you! Your payment went through, and your bill will show as paid in your portal.';
    }
    const link = await stripe('payment_links', params);
    const [row] = await save({ pay_link: link.url, stripe_link_id: link.id });
    return json({ ok: true, url: link.url, invoice: row });
  } catch (e) {
    return json({ error: (e as Error).message }, 502);
  }
});
