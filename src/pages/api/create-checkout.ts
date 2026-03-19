import type { APIRoute } from 'astro';
import Stripe from 'stripe';

// Map landing page plan slugs to Stripe price IDs
const PLAN_PRICE_MAP: Record<string, string> = {
  foundation: import.meta.env.STRIPE_PRICE_ID_STARTER || '',
  growth:     import.meta.env.STRIPE_PRICE_ID_GROWTH  || '',
  pro:        import.meta.env.STRIPE_PRICE_ID_PRO     || '',
  authority:  import.meta.env.STRIPE_PRICE_ID_AGENCY  || '',
};

export const POST: APIRoute = async ({ request }) => {
  const data = await request.json();
  const plan: string = (data.plan || 'growth').toLowerCase();
  const email: string = (data.email || '').trim();
  const name: string  = (data.name  || '').trim();

  const priceId = PLAN_PRICE_MAP[plan];
  if (!priceId) {
    return new Response(JSON.stringify({ error: `Unknown plan: ${plan}` }), { status: 400 });
  }

  const stripeKey = import.meta.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    return new Response(JSON.stringify({ error: 'Stripe not configured' }), { status: 500 });
  }

  const stripe = new Stripe(stripeKey, { apiVersion: '2025-02-24.acacia' });

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    customer_email: email || undefined,
    metadata: { name, plan, source: data.source || 'landing' },
    success_url: 'https://bymeridian.com/thank-you?type=signup&session_id={CHECKOUT_SESSION_ID}',
    cancel_url:  'https://bymeridian.com/start',
    allow_promotion_codes: true,
    subscription_data: {
      metadata: { name, plan },
    },
  });

  return new Response(JSON.stringify({ url: session.url }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
