# Meridian AI Search Product System

Updated: 2026-05-31

## Goal

Reach `$5k MRR` with a product-first offer that improves over time and does not
depend on Jeremy doing custom work for every customer.

## Product Ladder

1. Starter: `$49/mo`
   - Low-friction self-serve entry.
   - One domain, ten buyer questions, three competitors, monthly operating
     brief.

2. Monitor: `$99/mo`
   - Recommended self-serve product.
   - One domain, twenty-five buyer questions, five competitors, source gaps,
     on-demand brief reruns.

3. Growth: `$249/mo`
   - Higher-coverage SaaS tier.
   - Fifty buyer questions, eight competitors, weekly monitoring loop, exportable
     source and asset queue.

4. Diagnostic: `$750` one-time
   - Paid entry product.
   - One domain, ten buyer questions, three competitors, source trail, 30-day
     action plan.

5. Operator: `$1,000/mo`
   - Productized execution guidance.
   - More prompts, content/schema briefs, implementation-ready fixes.

6. Partner: `$2,500/mo`
   - Limited manual tier.
   - Monthly operator review from Jeremy and prioritized implementation support.

## MRR Paths

- 102 Starter customers at `$49/mo`.
- 51 Monitor customers at `$99/mo`.
- 21 Growth customers at `$249/mo`.
- 5 Operator customers at `$1,000/mo`.
- 2 Partner customers at `$2,500/mo`.
- Practical mix: 20 Monitor + 12 Starter + 10 Growth = `$5,058/mo`.

## Live Assets

- Sales page: `/ai-search`
- Checkout API: `/api/create-checkout`
- Customer app: `/app`
- Login: `/app/login`
- Post-checkout setup: `/app/onboarding`
- Account and billing: `/app/account`
- Legacy intake API: `/api/visibility-intake`
- Backend API service: `apps/api`
- Stripe lookup keys:
  - `ai_search_diagnostic`
  - `ai_search_starter_49`
  - `ai_search_monitor_99`
  - `ai_search_growth_249`
  - `ai_search_operator`
  - `ai_search_partner`

## App Flow

1. Buyer chooses a plan on `/ai-search`.
2. Vercel `/api/create-checkout` forwards the checkout request to the backend API.
3. Backend creates or updates the user/account, starts Stripe Checkout, and stores
   the checkout session id.
4. Stripe redirects the buyer to `/app/onboarding?session_id=...`.
5. The app exchanges the checkout session id for a customer session token, then
   saves the monitoring brief.
6. `/app` shows account status, plan entitlements, and the current operating
   brief.
7. `/app/account` opens the Stripe billing portal for invoices, cards, and
   cancellation.

## Operating Rule

Self-serve subscriptions come first. Partner work is capped and should be
offered only when the monitor reveals a valuable enough gap to justify hands-on
work.

Do not use current clients, Bain contacts, or former Bain contacts as outbound
prospects.
