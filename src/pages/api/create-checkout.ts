import type { APIRoute } from 'astro';
import Stripe from 'stripe';

function envValue(value: string | undefined): string {
  return (value || '').replace(/\\n$/, '').trim();
}

// Map landing page plan slugs to Stripe price IDs
const PLAN_PRICE_MAP: Record<string, string> = {
  starter:    envValue(import.meta.env.STRIPE_PRICE_ID_STARTER),
  foundation: envValue(import.meta.env.STRIPE_PRICE_ID_STARTER),
  growth:     envValue(import.meta.env.STRIPE_PRICE_ID_GROWTH),
  pro:        envValue(import.meta.env.STRIPE_PRICE_ID_PRO),
  authority:  envValue(import.meta.env.STRIPE_PRICE_ID_AGENCY),
};

const PLAN_LOOKUP_MAP: Record<string, string> = {
  starter: 'ai_search_starter_49',
  monitor: 'ai_search_monitor_99',
  growth: 'ai_search_growth_249',
  diagnostic: 'ai_search_diagnostic',
  operator: 'ai_search_operator',
  partner: 'ai_search_partner',
};

export const POST: APIRoute = async ({ request }) => {
  const data = await request.json();
  const plan: string = (data.plan || 'growth').toLowerCase();
  const email: string = (data.email || '').trim();
  const name: string  = (data.name  || '').trim();
  const website: string = (data.website || '').trim();
  const source: string = (data.source || 'landing').trim();
  const apiUrl = envValue(import.meta.env.MERIDIAN_API_URL);

  if (apiUrl && source === 'ai-search') {
    const resp = await fetch(`${apiUrl}/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan, email, name, website, source }),
    });
    const body = await resp.text();
    return new Response(body, {
      status: resp.status,
      headers: { 'Content-Type': resp.headers.get('content-type') || 'application/json' },
    });
  }

  let priceId = PLAN_PRICE_MAP[plan] || '';

  const stripeKey = envValue(import.meta.env.STRIPE_SECRET_KEY);
  if (!stripeKey) {
    return new Response(JSON.stringify({ error: 'Stripe not configured' }), { status: 500 });
  }

  const stripe = new Stripe(stripeKey, { apiVersion: '2025-02-24.acacia' });

  if (!priceId && PLAN_LOOKUP_MAP[plan]) {
    const prices = await stripe.prices.list({
      active: true,
      limit: 1,
      lookup_keys: [PLAN_LOOKUP_MAP[plan]],
    });
    priceId = prices.data[0]?.id || '';
  }

  if (!priceId) {
    return new Response(JSON.stringify({ error: `Unknown plan: ${plan}` }), { status: 400 });
  }
  const checkoutMode = plan === 'diagnostic' ? 'payment' : 'subscription';

  const session = await stripe.checkout.sessions.create({
    mode: checkoutMode,
    line_items: [{ price: priceId, quantity: 1 }],
    customer_email: email || undefined,
    metadata: { name, email, website, plan, source },
    client_reference_id: website || email || undefined,
    success_url: source === 'ai-search'
      ? `https://bymeridian.com/app/onboarding?plan=${encodeURIComponent(plan)}&session_id={CHECKOUT_SESSION_ID}`
      : 'https://bymeridian.com/thank-you?type=signup&session_id={CHECKOUT_SESSION_ID}',
    cancel_url: source === 'ai-search'
      ? 'https://bymeridian.com/ai-search'
      : 'https://bymeridian.com/start',
    allow_promotion_codes: true,
    ...(checkoutMode === 'subscription'
      ? { subscription_data: { metadata: { name, email, website, plan, source } } }
      : { payment_intent_data: { metadata: { name, email, website, plan, source } } }),
  });

  return new Response(JSON.stringify({ url: session.url }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
