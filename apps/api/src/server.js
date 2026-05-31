import crypto from 'node:crypto';
import cors from 'cors';
import express from 'express';
import pg from 'pg';
import Stripe from 'stripe';
import { Resend } from 'resend';

const { Pool } = pg;

const PORT = Number(process.env.PORT || 3000);
const APP_URL = env('APP_URL', 'https://bymeridian.com');
const CORS_ORIGIN = env('CORS_ORIGIN', APP_URL);
const AUTH_SECRET = env('AUTH_SECRET');
const DATABASE_URL = env('DATABASE_URL');
const STRIPE_SECRET_KEY = env('STRIPE_SECRET_KEY');
const STRIPE_WEBHOOK_SECRET = env('STRIPE_WEBHOOK_SECRET', '');
const RESEND_API_KEY = env('RESEND_API_KEY', '');
const DATAFORSEO_AUTH = env('DATAFORSEO_AUTH', '');

const PRICE_LOOKUPS = {
  starter: 'ai_search_starter_49',
  monitor: 'ai_search_monitor_99',
  growth: 'ai_search_growth_249',
  diagnostic: 'ai_search_diagnostic',
  operator: 'ai_search_operator',
  partner: 'ai_search_partner',
};

const PLAN_FEATURES = {
  starter: {
    label: 'Starter',
    price: '$49/mo',
    cadence: 'Monthly brief',
    prompts: 10,
    competitors: 3,
    refresh_days: 30,
    reruns: 'Monthly self-serve rerun',
    support: 'Email support',
  },
  monitor: {
    label: 'Monitor',
    price: '$99/mo',
    cadence: 'Fresh brief reruns',
    prompts: 25,
    competitors: 5,
    refresh_days: 14,
    reruns: 'On-demand brief reruns',
    support: 'Priority email support',
  },
  growth: {
    label: 'Growth',
    price: '$249/mo',
    cadence: 'Weekly monitoring loop',
    prompts: 50,
    competitors: 8,
    refresh_days: 7,
    reruns: 'Weekly refresh plus on-demand reruns',
    support: 'Priority support and exports',
  },
  diagnostic: {
    label: 'Diagnostic',
    price: '$750 one-time',
    cadence: 'One-time teardown',
    prompts: 10,
    competitors: 3,
    refresh_days: null,
    reruns: 'One diagnostic brief',
    support: 'Email handoff',
  },
  operator: {
    label: 'Operator',
    price: '$1,000/mo',
    cadence: 'Weekly monitoring plus implementation briefs',
    prompts: 75,
    competitors: 10,
    refresh_days: 7,
    reruns: 'Weekly refresh plus priority reruns',
    support: 'Implementation-ready content and schema briefs',
  },
  partner: {
    label: 'Partner',
    price: '$2,500/mo',
    cadence: 'Weekly monitoring plus direct strategy',
    prompts: 100,
    competitors: 15,
    refresh_days: 7,
    reruns: 'Priority refreshes',
    support: 'Monthly strategy review with Jeremy',
  },
};

const pool = DATABASE_URL
  ? new Pool({ connectionString: DATABASE_URL, ssl: DATABASE_URL.includes('railway') ? { rejectUnauthorized: false } : undefined })
  : null;
const stripe = STRIPE_SECRET_KEY ? new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2025-02-24.acacia' }) : null;
const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

const app = express();

app.use(cors({
  origin(origin, callback) {
    if (!origin || isAllowedOrigin(origin)) return callback(null, true);
    return callback(new Error('Origin not allowed'));
  },
  allowedHeaders: ['authorization', 'content-type'],
}));

app.post('/stripe/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  if (!stripe || !STRIPE_WEBHOOK_SECRET) return res.status(500).json({ error: 'Stripe webhook not configured' });

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'], STRIPE_WEBHOOK_SECRET);
  } catch (error) {
    return res.status(400).json({ error: `Webhook error: ${error.message}` });
  }

  try {
    await handleStripeEvent(event);
    return res.json({ received: true });
  } catch (error) {
    console.error('Webhook handling failed', error);
    return res.status(500).json({ error: 'Webhook handling failed' });
  }
});

app.use(express.json({ limit: '1mb' }));

app.get('/health', async (_req, res) => {
  const db = pool ? await pool.query('select 1 as ok').then(() => true).catch(() => false) : false;
  res.json({ ok: true, db, service: 'meridian-ai-search-api' });
});

app.post('/auth/request-link', async (req, res) => {
  requireDb(res);
  const email = cleanEmail(req.body.email);
  const name = clean(req.body.name);
  if (!email) return res.status(400).json({ error: 'A valid email is required.' });

  const user = await upsertUser({ email, name });
  const rawToken = randomToken();
  await pool.query(
    `insert into magic_links (token_hash, user_id, email, expires_at)
     values ($1, $2, $3, now() + interval '20 minutes')`,
    [hashToken(rawToken), user.id, email],
  );

  const verifyUrl = `${APP_URL}/app/auth/verify?token=${encodeURIComponent(rawToken)}`;
  await sendMagicLink({ email, name: user.name || email, verifyUrl });
  res.json({ ok: true });
});

app.post('/auth/verify', async (req, res) => {
  requireDb(res);
  const rawToken = clean(req.body.token);
  if (!rawToken) return res.status(400).json({ error: 'Token is required.' });

  const tokenHash = hashToken(rawToken);
  const { rows } = await pool.query(
    `select ml.id, ml.user_id, ml.expires_at, ml.used_at, u.email, u.name
     from magic_links ml
     join users u on u.id = ml.user_id
     where ml.token_hash = $1`,
    [tokenHash],
  );
  const link = rows[0];
  if (!link || link.used_at || new Date(link.expires_at) < new Date()) {
    return res.status(401).json({ error: 'This login link has expired.' });
  }

  await pool.query('update magic_links set used_at = now() where id = $1', [link.id]);
  const sessionToken = randomToken();
  await pool.query(
    `insert into sessions (token_hash, user_id, expires_at)
     values ($1, $2, now() + interval '45 days')`,
    [hashToken(sessionToken), link.user_id],
  );

  res.json({
    token: sessionToken,
    user: { id: link.user_id, email: link.email, name: link.name },
  });
});

app.get('/me', requireAuth, async (req, res) => {
  const account = await getPrimaryAccount(req.user.id);
  res.json({ user: req.user, account });
});

app.post('/checkout', async (req, res) => {
  requireDb(res);
  if (!stripe) return res.status(500).json({ error: 'Stripe not configured' });

  const plan = clean(req.body.plan || 'monitor').toLowerCase();
  const email = cleanEmail(req.body.email);
  const name = clean(req.body.name);
  const website = clean(req.body.website);
  const source = clean(req.body.source || 'ai-search');

  if (!PRICE_LOOKUPS[plan]) return res.status(400).json({ error: `Unknown plan: ${plan}` });
  if (!email || !website) return res.status(400).json({ error: 'Email and website are required.' });

  const user = await upsertUser({ email, name });
  const account = await upsertAccount({ userId: user.id, website, plan, status: 'checkout_started' });
  const price = await lookupPrice(plan);
  const mode = isOneTimePlan(plan) ? 'payment' : 'subscription';

  const session = await stripe.checkout.sessions.create({
    mode,
    line_items: [{ price: price.id, quantity: 1 }],
    customer_email: email,
    client_reference_id: account.id,
    metadata: { user_id: user.id, account_id: account.id, email, website, plan, source },
    success_url: `${APP_URL}/app/onboarding?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${APP_URL}/ai-search#plans`,
    allow_promotion_codes: true,
    ...(mode === 'subscription'
      ? { subscription_data: { metadata: { user_id: user.id, account_id: account.id, email, website, plan, source } } }
      : { payment_intent_data: { metadata: { user_id: user.id, account_id: account.id, email, website, plan, source } } }),
  });

  await pool.query(
    `update accounts set stripe_checkout_session_id = $1, stripe_customer_id = coalesce(stripe_customer_id, $2), updated_at = now()
     where id = $3`,
    [session.id, session.customer || null, account.id],
  );

  res.json({ url: session.url });
});

app.post('/checkout/session-login', async (req, res) => {
  requireDb(res);
  if (!stripe) return res.status(500).json({ error: 'Stripe not configured' });

  const sessionId = clean(req.body.session_id);
  if (!sessionId) return res.status(400).json({ error: 'Session id is required.' });

  const session = await stripe.checkout.sessions.retrieve(sessionId);
  if (session.status !== 'complete' || !['paid', 'no_payment_required'].includes(session.payment_status)) {
    return res.status(402).json({ error: 'Checkout is not complete yet.' });
  }
  const accountId = session.metadata?.account_id || session.client_reference_id;
  if (!accountId) return res.status(404).json({ error: 'Account not found for session.' });

  const { rows } = await pool.query(
    `select a.*, u.id as user_id, u.email, u.name
     from accounts a
     join users u on u.id = a.user_id
     where a.id = $1`,
    [accountId],
  );
  const record = rows[0];
  if (!record) return res.status(404).json({ error: 'Account not found.' });

  const sessionToken = randomToken();
  const subscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id || null;
  const paidStatus = subscriptionId ? 'active' : 'paid_diagnostic';
  await pool.query(
    `update accounts
     set status = $1,
         stripe_customer_id = coalesce(stripe_customer_id, $2),
         stripe_subscription_id = coalesce($3, stripe_subscription_id),
         updated_at = now()
     where id = $4`,
    [paidStatus, session.customer || null, subscriptionId, accountId],
  );
  record.status = paidStatus;
  record.stripe_customer_id = record.stripe_customer_id || session.customer || null;
  record.stripe_subscription_id = record.stripe_subscription_id || subscriptionId;

  await pool.query(
    `insert into sessions (token_hash, user_id, expires_at)
     values ($1, $2, now() + interval '45 days')`,
    [hashToken(sessionToken), record.user_id],
  );

  res.json({
    token: sessionToken,
    user: { id: record.user_id, email: record.email, name: record.name },
    account: serializeAccount(record),
  });
});

app.get('/dashboard', requireAuth, async (req, res) => {
  const account = await getPrimaryAccount(req.user.id);
  if (!account) return res.json({ user: req.user, account: null, brief: null, report: null });
  if (!hasPaidAccess(account)) return res.json({ user: req.user, account, brief: null, report: null, access_required: true });

  const brief = await getLatestBrief(account.id);
  const report = await getLatestReport(account.id, brief);
  res.json({ user: req.user, account, brief, report });
});

app.post('/reports/run', requireAuth, async (req, res) => {
  const account = await getPrimaryAccount(req.user.id);
  if (!account) return res.status(404).json({ error: 'No account found.' });
  if (!hasPaidAccess(account)) return res.status(402).json({ error: 'A completed checkout is required before running a brief.' });
  const brief = await getLatestBrief(account.id);
  if (!brief) return res.status(400).json({ error: 'Submit an onboarding brief first.' });

  const report = await generateAndStoreReport(account, brief);
  res.json({ ok: true, report });
});

app.post('/onboarding', requireAuth, async (req, res) => {
  const account = await getPrimaryAccount(req.user.id);
  if (!account) return res.status(404).json({ error: 'No account found.' });
  if (!hasPaidAccess(account)) return res.status(402).json({ error: 'A completed checkout is required before generating the first brief.' });

  const website = clean(req.body.website || account.website);
  const category = clean(req.body.category);
  const competitors = clean(req.body.competitors);
  const prompts = clean(req.body.prompts);
  const companyName = clean(req.body.company_name);
  const features = getPlanFeatures(account.plan);

  if (!website || !category) return res.status(400).json({ error: 'Website and category are required.' });
  if (parseList(competitors).length > features.competitors) {
    return res.status(400).json({ error: `${features.label} supports up to ${features.competitors} competitors. Remove a few or upgrade your plan.` });
  }
  if (parseList(prompts).length > features.prompts) {
    return res.status(400).json({ error: `${features.label} supports up to ${features.prompts} buyer questions. Remove a few or upgrade your plan.` });
  }

  await pool.query(
    `update accounts set website = $1, company_name = nullif($2, ''), updated_at = now() where id = $3`,
    [website, companyName, account.id],
  );
  const { rows } = await pool.query(
    `insert into briefs (account_id, category, competitors, prompts)
     values ($1, $2, $3, $4)
     returning *`,
    [account.id, category, competitors, prompts],
  );
  const freshAccount = { ...account, website, company_name: companyName };
  await generateAndStoreReport(freshAccount, rows[0]);

  await sendInternalIntake({ user: req.user, account: freshAccount, brief: rows[0] });
  res.json({ ok: true, brief: rows[0] });
});

app.post('/billing/portal', requireAuth, async (req, res) => {
  if (!stripe) return res.status(500).json({ error: 'Stripe not configured' });
  const account = await getPrimaryAccount(req.user.id);
  if (!account?.stripe_customer_id) {
    return res.status(400).json({ error: 'No Stripe customer is attached to this account yet.' });
  }
  const session = await stripe.billingPortal.sessions.create({
    customer: account.stripe_customer_id,
    return_url: `${APP_URL}/app/account`,
  });
  res.json({ url: session.url });
});

app.post('/logout', requireAuth, async (req, res) => {
  await pool.query('delete from sessions where token_hash = $1', [req.sessionHash]);
  res.json({ ok: true });
});

app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

await migrate();
startReportScheduler();
app.listen(PORT, () => {
  console.log(`Meridian AI Search API listening on ${PORT}`);
});

async function migrate() {
  if (!pool) throw new Error('DATABASE_URL is required');
  await pool.query(`
    create extension if not exists pgcrypto;

    create table if not exists users (
      id uuid primary key default gen_random_uuid(),
      email text unique not null,
      name text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    create table if not exists accounts (
      id uuid primary key default gen_random_uuid(),
      user_id uuid not null references users(id) on delete cascade,
      company_name text,
      website text not null,
      plan text not null default 'monitor',
      status text not null default 'pending',
      stripe_customer_id text,
      stripe_subscription_id text,
      stripe_checkout_session_id text,
      current_period_end timestamptz,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    create table if not exists magic_links (
      id uuid primary key default gen_random_uuid(),
      token_hash text unique not null,
      user_id uuid not null references users(id) on delete cascade,
      email text not null,
      expires_at timestamptz not null,
      used_at timestamptz,
      created_at timestamptz not null default now()
    );

    create table if not exists sessions (
      id uuid primary key default gen_random_uuid(),
      token_hash text unique not null,
      user_id uuid not null references users(id) on delete cascade,
      expires_at timestamptz not null,
      created_at timestamptz not null default now()
    );

    create table if not exists briefs (
      id uuid primary key default gen_random_uuid(),
      account_id uuid not null references accounts(id) on delete cascade,
      category text not null,
      competitors text,
      prompts text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    create table if not exists reports (
      id uuid primary key default gen_random_uuid(),
      account_id uuid not null references accounts(id) on delete cascade,
      title text not null,
      visibility_score integer not null default 0,
      citation_score integer not null default 0,
      competitor_pressure integer not null default 0,
      summary text not null,
      question text not null,
      answer_surface text not null,
      source_gap text not null,
      next_fix text not null,
      report_json jsonb,
      created_at timestamptz not null default now()
    );

    alter table reports add column if not exists report_json jsonb;

    create index if not exists accounts_user_id_idx on accounts(user_id);
    create index if not exists sessions_token_hash_idx on sessions(token_hash);
  `);
}

async function requireAuth(req, res, next) {
  requireDb(res);
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) return res.status(401).json({ error: 'Authentication required.' });

  const sessionHash = hashToken(token);
  const { rows } = await pool.query(
    `select s.user_id, s.expires_at, u.email, u.name
     from sessions s
     join users u on u.id = s.user_id
     where s.token_hash = $1`,
    [sessionHash],
  );
  const session = rows[0];
  if (!session || new Date(session.expires_at) < new Date()) {
    return res.status(401).json({ error: 'Session expired.' });
  }
  req.sessionHash = sessionHash;
  req.user = { id: session.user_id, email: session.email, name: session.name };
  return next();
}

async function handleStripeEvent(event) {
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const accountId = session.metadata?.account_id || session.client_reference_id;
    if (!accountId) return;
    const subscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id || null;
    await pool.query(
      `update accounts
       set status = $1,
           stripe_customer_id = $2,
           stripe_subscription_id = coalesce($3, stripe_subscription_id),
           updated_at = now()
       where id = $4`,
      [subscriptionId ? 'active' : 'paid_diagnostic', session.customer || null, subscriptionId, accountId],
    );
  }

  if (event.type.startsWith('customer.subscription.')) {
    const subscription = event.data.object;
    const accountId = subscription.metadata?.account_id;
    if (!accountId) return;
    await pool.query(
      `update accounts
       set status = $1,
           stripe_subscription_id = $2,
           stripe_customer_id = $3,
           current_period_end = to_timestamp($4),
           updated_at = now()
       where id = $5`,
      [subscription.status, subscription.id, subscription.customer, subscription.current_period_end || null, accountId],
    );
  }
}

async function upsertUser({ email, name }) {
  const { rows } = await pool.query(
    `insert into users (email, name)
     values ($1, nullif($2, ''))
     on conflict (email) do update
       set name = coalesce(nullif(excluded.name, ''), users.name),
           updated_at = now()
     returning *`,
    [email, name],
  );
  return rows[0];
}

async function upsertAccount({ userId, website, plan, status }) {
  const existing = await pool.query(
    `select * from accounts where user_id = $1 and website = $2 order by created_at desc limit 1`,
    [userId, website],
  );
  if (existing.rows[0]) {
    const { rows } = await pool.query(
      `update accounts set plan = $1, status = $2, updated_at = now() where id = $3 returning *`,
      [plan, status, existing.rows[0].id],
    );
    return rows[0];
  }
  const { rows } = await pool.query(
    `insert into accounts (user_id, website, plan, status)
     values ($1, $2, $3, $4)
     returning *`,
    [userId, website, plan, status],
  );
  return rows[0];
}

async function getPrimaryAccount(userId) {
  const { rows } = await pool.query(
    `select * from accounts where user_id = $1 order by updated_at desc limit 1`,
    [userId],
  );
  return rows[0] ? serializeAccount(rows[0]) : null;
}

async function getLatestBrief(accountId) {
  const { rows } = await pool.query(
    `select * from briefs where account_id = $1 order by created_at desc limit 1`,
    [accountId],
  );
  return rows[0] || null;
}

async function getLatestReport(accountId, brief) {
  const { rows } = await pool.query(
    `select * from reports where account_id = $1 order by created_at desc limit 1`,
    [accountId],
  );
  if (rows[0]) return serializeReport(rows[0]);
  return brief ? buildStarterReport(brief) : null;
}

function startReportScheduler() {
  if (!pool) return;
  setTimeout(() => refreshDueReports().catch((error) => console.error('Scheduled report refresh failed', error)), 15000);
  setInterval(() => refreshDueReports().catch((error) => console.error('Scheduled report refresh failed', error)), 6 * 60 * 60 * 1000);
}

async function refreshDueReports() {
  const { rows } = await pool.query(
    `select a.*,
            b.id as brief_id,
            b.category,
            b.competitors,
            b.prompts,
            b.created_at as brief_created_at,
            r.created_at as latest_report_at
       from accounts a
       join lateral (
         select * from briefs where account_id = a.id order by created_at desc limit 1
       ) b on true
       left join lateral (
         select created_at from reports where account_id = a.id order by created_at desc limit 1
       ) r on true
      where a.status in ('active', 'trialing')
      order by coalesce(r.created_at, b.created_at) asc
      limit 25`,
  );

  let refreshed = 0;
  for (const row of rows) {
    const features = getPlanFeatures(row.plan);
    if (!features.refresh_days) continue;
    const latest = row.latest_report_at ? new Date(row.latest_report_at) : null;
    const dueAt = latest ? latest.getTime() + features.refresh_days * 24 * 60 * 60 * 1000 : 0;
    if (latest && dueAt > Date.now()) continue;
    await generateAndStoreReport(serializeAccount(row), {
      id: row.brief_id,
      account_id: row.id,
      category: row.category,
      competitors: row.competitors,
      prompts: row.prompts,
      created_at: row.brief_created_at,
    });
    refreshed += 1;
    if (refreshed >= 10) break;
  }

  if (refreshed) console.log(`Refreshed ${refreshed} scheduled AI Search reports`);
}

async function generateAndStoreReport(account, brief) {
  const report = await buildStrategicReport(account, brief);
  await pool.query(
    `insert into reports (account_id, title, visibility_score, citation_score, competitor_pressure, summary, question, answer_surface, source_gap, next_fix, report_json)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [
      account.id,
      report.title,
      report.visibility_score,
      report.citation_score,
      report.competitor_pressure,
      report.summary,
      report.question,
      report.answer_surface,
      report.source_gap,
      report.next_fix,
      JSON.stringify(report),
    ],
  );
  return report;
}

function buildStarterReport(brief) {
  const category = brief.category || 'your category';
  return {
    title: `Starter AI Search run for ${category}`,
    visibility_score: 24,
    citation_score: 38,
    competitor_pressure: 72,
    summary: 'Your first monitoring cycle is queued. This starter scorecard shows the structure of the recurring report while Meridian builds the first live run from your buyer-question map.',
    question: `Which ${category} vendors should a buyer compare before making a shortlist?`,
    answer_surface: 'Initial run pending. The first cycle will check whether you are mentioned directly, cited indirectly, or omitted while competitors appear.',
    source_gap: 'The monitor will identify which third-party pages, comparison content, documentation, and implementation guides shape the answer.',
    next_fix: 'Submit the strongest competitors and buyer questions. Meridian will convert them into the first live prompt set and prioritized fix queue.',
  };
}

async function buildStrategicReport(account, brief) {
  const website = normalizeDomain(account.website);
  const features = getPlanFeatures(account.plan);
  const competitors = parseList(brief.competitors).slice(0, features.competitors);
  const category = brief.category || 'your category';
  const promptMap = buildPromptMap(category, website, competitors, brief.prompts, features.prompts);
  const evidence = await gatherEvidence({ website, competitors, category, promptMap });
  const competitorRows = buildCompetitorRows({ website, competitors, evidence });
  const sourceGaps = buildSourceGaps({ website, category, competitors, evidence });
  const actionQueue = buildActionQueue({ website, category, competitors, sourceGaps, promptMap, evidence });
  const scores = scoreReport({ website, competitors, evidence, sourceGaps, actionQueue });
  const firstPrompt = promptMap[0]?.question || `Which ${category} vendors should a buyer compare before making a shortlist?`;
  const topCompetitor = competitorRows.find((row) => row.domain !== website)?.domain || competitors[0] || 'the category leader';

  return {
    title: `Answer-market brief for ${category}`,
    visibility_score: scores.visibility,
    citation_score: scores.citation,
    competitor_pressure: scores.pressure,
    summary: `Meridian found ${sourceGaps.length} likely answer-market gaps for ${website}. The strongest early move is not more generic SEO content; it is a buyer-shortlist asset that makes ${website} easier for AI systems to name, compare, and cite when prospects ask about ${category}.`,
    question: firstPrompt,
    answer_surface: buildAnswerSurface({ website, topCompetitor, evidence }),
    source_gap: sourceGaps[0]?.diagnosis || `AI systems need neutral, comparison-friendly source material before they can confidently cite ${website}.`,
    next_fix: actionQueue[0]?.action || `Publish a comparison page that names the category, alternatives, buyer risks, and implementation criteria for ${category}.`,
    generated_at: new Date().toISOString(),
    evidence_status: evidence.status,
    website,
    category,
    plan: account.plan,
    plan_features: features,
    competitors,
    prompt_map: promptMap,
    competitor_rows: competitorRows,
    source_gaps: sourceGaps,
    action_queue: actionQueue,
    data_sources: evidence.sources,
    raw_signals: evidence.signals,
  };
}

async function gatherEvidence({ website, competitors, category, promptMap }) {
  const sources = [];
  const signals = {
    homepage: null,
    competitor_homepages: [],
    llm_mentions: null,
    errors: [],
  };

  const homepage = await fetchPageSummary(`https://${website}`);
  if (homepage) {
    signals.homepage = homepage;
    sources.push({ type: 'homepage', label: website, status: 'collected' });
  }

  for (const domain of competitors.slice(0, 3)) {
    const summary = await fetchPageSummary(`https://${normalizeDomain(domain)}`);
    if (summary) {
      signals.competitor_homepages.push(summary);
      sources.push({ type: 'competitor_homepage', label: normalizeDomain(domain), status: 'collected' });
    }
  }

  if (DATAFORSEO_AUTH) {
    try {
      const mentions = await dataForSeoMentions({ website, competitors, category, promptMap });
      signals.llm_mentions = mentions;
      sources.push({ type: 'dataforseo_llm_mentions', label: 'DataForSEO LLM Mentions', status: 'collected' });
    } catch (error) {
      signals.errors.push(`DataForSEO unavailable: ${error.message}`);
      sources.push({ type: 'dataforseo_llm_mentions', label: 'DataForSEO LLM Mentions', status: 'unavailable' });
    }
  } else {
    sources.push({ type: 'dataforseo_llm_mentions', label: 'DataForSEO LLM Mentions', status: 'not_configured' });
  }

  return {
    status: sources.some((source) => source.status === 'collected') ? 'evidence_collected' : 'strategy_only',
    sources,
    signals,
  };
}

async function dataForSeoMentions({ website, competitors, category, promptMap }) {
  const target = [
    { domain: website, search_filter: 'include', search_scope: ['any'], include_subdomains: true },
    ...competitors.slice(0, 3).map((domain) => ({
      domain: normalizeDomain(domain),
      search_filter: 'include',
      search_scope: ['any'],
      include_subdomains: true,
    })),
    { keyword: category, search_scope: ['question', 'answer'], match_type: 'partial_match' },
  ].slice(0, 10);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  let resp;
  try {
    resp = await fetch('https://api.dataforseo.com/v3/ai_optimization/llm_mentions/search/live', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Basic ${DATAFORSEO_AUTH}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([{
        language_name: 'English',
        location_code: 2840,
        target,
        platform: 'google',
        order_by: ['ai_search_volume,desc'],
        limit: 10,
      }]),
    });
  } finally {
    clearTimeout(timer);
  }
  const json = await resp.json();
  if (!resp.ok || json.status_code >= 40000) {
    throw new Error(json.status_message || `DataForSEO status ${resp.status}`);
  }

  const task = json.tasks?.[0] || {};
  const items = task.result?.[0]?.items || task.result || [];
  return {
    cost: task.cost || 0,
    count: Array.isArray(items) ? items.length : 0,
    items: Array.isArray(items) ? items.slice(0, 10).map(simplifyMentionItem) : [],
  };
}

function simplifyMentionItem(item) {
  return {
    keyword: item.keyword || item.question || item.prompt || '',
    platform: item.platform || item.ai_platform || '',
    ai_search_volume: item.ai_search_volume || item.search_volume || null,
    mentions_count: item.mentions_count || item.count || null,
    domain: item.domain || item.target || '',
    url: item.url || item.page_url || '',
    title: item.title || '',
  };
}

async function fetchPageSummary(url) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const resp = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'MeridianAIVisibilityBot/0.1 (+https://bymeridian.com)' },
    });
    clearTimeout(timer);
    if (!resp.ok) return null;
    const html = await resp.text();
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 4000);
    return {
      url,
      title: matchMeta(html, /<title[^>]*>([\s\S]*?)<\/title>/i),
      description: matchMeta(html, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)
        || matchMeta(html, /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i),
      h1: matchMeta(html, /<h1[^>]*>([\s\S]*?)<\/h1>/i),
      has_schema: /application\/ld\+json|schema\.org/i.test(html),
      has_comparison_language: /\b(compare|alternative|versus|vs\.?|pricing|implementation|integration|security|risk|buyers?|vendor|shortlist)\b/i.test(text),
      word_sample: text,
    };
  } catch {
    return null;
  }
}

function buildPromptMap(category, website, competitors, userPrompts, limit = 10) {
  const custom = parseList(userPrompts).map((question) => ({ question, intent: 'customer-specified', priority: 'high' }));
  const competitorText = competitors.length ? competitors.slice(0, 3).join(', ') : 'the known alternatives';
  const defaults = [
    { question: `Which ${category} vendors should a buyer compare before making a shortlist?`, intent: 'shortlist', priority: 'high' },
    { question: `What are the best ${category} options for a mid-market B2B team?`, intent: 'best-options', priority: 'high' },
    { question: `How does ${website} compare with ${competitorText}?`, intent: 'comparison', priority: 'high' },
    { question: `What implementation risks should buyers consider before choosing a ${category} vendor?`, intent: 'risk', priority: 'medium' },
    { question: `Which ${category} vendors are strongest for technical teams?`, intent: 'technical-fit', priority: 'medium' },
    { question: `What questions should procurement ask before buying ${category}?`, intent: 'procurement', priority: 'medium' },
  ];
  return [...custom, ...defaults].slice(0, limit);
}

function buildCompetitorRows({ website, competitors, evidence }) {
  const homepageText = evidence.signals.homepage?.word_sample || '';
  const rows = [
    {
      domain: website,
      role: 'you',
      answer_readiness: scoreReadiness(evidence.signals.homepage),
      likely_strength: classifyStrength(homepageText),
      missing_asset: missingAsset(evidence.signals.homepage),
    },
  ];
  for (const domain of competitors) {
    const normalized = normalizeDomain(domain);
    const summary = evidence.signals.competitor_homepages.find((page) => normalizeDomain(page.url) === normalized);
    rows.push({
      domain: normalized,
      role: 'competitor',
      answer_readiness: scoreReadiness(summary) + 8,
      likely_strength: classifyStrength(summary?.word_sample || ''),
      missing_asset: summary ? missingAsset(summary) : 'Unknown until monitored; treat as an answer-surface competitor.',
    });
  }
  return rows;
}

function buildSourceGaps({ website, category, competitors, evidence }) {
  const homepage = evidence.signals.homepage;
  const gaps = [];
  if (!homepage?.has_comparison_language) {
    gaps.push({
      gap: 'No buyer-comparison asset',
      diagnosis: `${website} is not making it easy for AI systems to compare it against ${competitors[0] || 'alternatives'} for ${category}.`,
      why_it_matters: 'AI answers tend to synthesize explicit comparison, risk, pricing, and implementation language when building vendor shortlists.',
    });
  }
  if (!homepage?.has_schema) {
    gaps.push({
      gap: 'Weak machine-readable entity layer',
      diagnosis: `${website} should expose organization, product/service, FAQ, and article/schema context so answer engines can resolve the entity confidently.`,
      why_it_matters: 'Schema will not force citation, but it reduces ambiguity and supports inclusion when the model is choosing between similar vendors.',
    });
  }
  gaps.push({
    gap: 'Missing neutral citation targets',
    diagnosis: `The next visibility jump likely comes from third-party source placement: category roundups, implementation guides, integration pages, partner directories, or analyst-style comparisons.`,
    why_it_matters: 'Many AI systems prefer neutral sources when making vendor recommendations; your own site is necessary but often insufficient.',
  });
  return gaps.slice(0, 5);
}

function buildActionQueue({ website, category, competitors, sourceGaps, promptMap }) {
  const competitorText = competitors.slice(0, 3).join(', ') || 'the top alternatives';
  return [
    {
      priority: 1,
      action: `Publish an "${category} vendor comparison" page that explicitly compares ${website} with ${competitorText}.`,
      asset_type: 'comparison page',
      prompt_covered: promptMap.find((prompt) => prompt.intent === 'comparison')?.question,
      effort: 'medium',
      expected_effect: 'Raises answer readiness for shortlist and comparison prompts.',
    },
    {
      priority: 2,
      action: `Create a buyer-risk checklist for ${category}: implementation risk, security, integrations, timeline, and switching cost.`,
      asset_type: 'implementation guide',
      prompt_covered: promptMap.find((prompt) => prompt.intent === 'risk')?.question,
      effort: 'medium',
      expected_effect: 'Gives AI systems concrete criteria to cite beyond generic marketing copy.',
    },
    {
      priority: 3,
      action: `Add Organization, Product/Service, FAQ, and Breadcrumb schema to the core ${website} product pages.`,
      asset_type: 'technical entity layer',
      prompt_covered: 'All prompts',
      effort: 'low',
      expected_effect: 'Improves entity disambiguation and citation confidence.',
    },
    {
      priority: 4,
      action: `Pitch two neutral category references: one partner/integration directory and one expert roundup or implementation guide.`,
      asset_type: 'third-party citation',
      prompt_covered: promptMap[0]?.question,
      effort: 'high',
      expected_effect: 'Creates external evidence AI systems can cite without relying on your own claims.',
    },
    {
      priority: 5,
      action: `Instrument a weekly prompt watchlist for the top ${Math.min(promptMap.length, 10)} buyer questions and record mention/citation drift.`,
      asset_type: 'monitoring loop',
      prompt_covered: 'All prompts',
      effort: 'low',
      expected_effect: 'Separates one-off prompt noise from real answer-market movement.',
    },
  ].filter((item, index) => index < Math.max(4, sourceGaps.length));
}

function scoreReport({ competitors, evidence, sourceGaps, actionQueue }) {
  const readiness = scoreReadiness(evidence.signals.homepage);
  const dataBonus = evidence.signals.llm_mentions?.count ? 8 : 0;
  const gapPenalty = sourceGaps.length * 6;
  const visibility = clamp(readiness + dataBonus - gapPenalty + 20, 12, 84);
  const citation = clamp((evidence.signals.homepage?.has_schema ? 56 : 34) + dataBonus - sourceGaps.length * 4, 10, 82);
  const pressure = clamp(48 + competitors.length * 8 + actionQueue.length * 3 - readiness / 4, 35, 92);
  return { visibility, citation, pressure };
}

function buildAnswerSurface({ website, topCompetitor, evidence }) {
  const evidencePhrase = evidence.signals.llm_mentions?.count
    ? `DataForSEO returned ${evidence.signals.llm_mentions.count} relevant AI-mention rows to seed the watchlist.`
    : 'The first run is using page and category evidence while live AI-mention sampling is expanded.';
  return `${website} is not yet framed as an obvious shortlist answer. ${topCompetitor} is the first comparison pressure point to watch. ${evidencePhrase}`;
}

function scoreReadiness(summary) {
  if (!summary) return 20;
  let score = 30;
  if (summary.title) score += 8;
  if (summary.description) score += 10;
  if (summary.h1) score += 8;
  if (summary.has_schema) score += 14;
  if (summary.has_comparison_language) score += 18;
  return clamp(score, 0, 100);
}

function classifyStrength(text) {
  const matches = [
    ['pricing', /\bpricing|plans|cost\b/i],
    ['implementation', /\bimplementation|deploy|onboarding|migration\b/i],
    ['security', /\bsecurity|compliance|soc 2|privacy|governance\b/i],
    ['integration', /\bintegration|api|workflow|connect\b/i],
    ['comparison', /\bcompare|alternative|versus|vs\.?\b/i],
  ].filter(([, regex]) => regex.test(text)).map(([label]) => label);
  return matches.length ? matches.join(', ') : 'generic positioning';
}

function missingAsset(summary) {
  if (!summary) return 'Homepage fetch failed; verify crawlability and metadata.';
  if (!summary.has_comparison_language) return 'Comparison/risk page with explicit alternatives and buyer criteria.';
  if (!summary.has_schema) return 'Structured entity schema for organization, product, FAQ, and breadcrumbs.';
  return 'Neutral third-party citations and category references.';
}

function serializeReport(row) {
  return row.report_json || row;
}

function parseList(value) {
  return String(value || '')
    .split(/\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeDomain(value) {
  return String(value || '')
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .split('/')[0]
    .toLowerCase();
}

function matchMeta(html, regex) {
  const match = html.match(regex);
  return match?.[1]?.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() || '';
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

async function lookupPrice(plan) {
  const prices = await stripe.prices.list({
    active: true,
    limit: 1,
    lookup_keys: [PRICE_LOOKUPS[plan]],
  });
  const price = prices.data[0];
  if (!price) throw new Error(`Stripe price not found for ${plan}`);
  return price;
}

async function sendMagicLink({ email, name, verifyUrl }) {
  if (!resend) {
    console.log(`Magic link for ${email}: ${verifyUrl}`);
    return;
  }
  await resend.emails.send({
    from: 'Meridian <jeremy@bymeridian.com>',
    to: [email],
    subject: 'Your Meridian login link',
    html: `
      <div style="font-family: system-ui, sans-serif; max-width: 620px; margin: 0 auto; color: #0f172a;">
        <p>Hi ${escapeHtml(name)},</p>
        <p>Use this secure link to open your Meridian AI Search account:</p>
        <p><a href="${verifyUrl}" style="display:inline-block;background:#0e8a4a;color:white;text-decoration:none;padding:12px 16px;border-radius:8px;font-weight:700;">Open Meridian</a></p>
        <p style="color:#64748b;">This link expires in 20 minutes.</p>
      </div>
    `,
  });
}

async function sendInternalIntake({ user, account, brief }) {
  if (!resend) return;
  await resend.emails.send({
    from: 'Meridian App <noreply@bymeridian.com>',
    to: ['jeremy@bymeridian.com'],
    replyTo: user.email,
    subject: `Meridian onboarding brief: ${account.website}`,
    html: `
      <div style="font-family: system-ui, sans-serif; max-width: 680px; margin: 0 auto;">
        <h2>New AI Search onboarding brief</h2>
        <p><strong>Email:</strong> ${escapeHtml(user.email)}</p>
        <p><strong>Website:</strong> ${escapeHtml(account.website)}</p>
        <p><strong>Company:</strong> ${escapeHtml(account.company_name || 'Not provided')}</p>
        <p><strong>Plan:</strong> ${escapeHtml(account.plan || 'monitor')}</p>
        <p><strong>Category:</strong> ${escapeHtml(brief.category)}</p>
        <h3>Competitors</h3>
        <p style="white-space:pre-wrap;">${escapeHtml(brief.competitors || 'Not provided')}</p>
        <h3>Buyer questions</h3>
        <p style="white-space:pre-wrap;">${escapeHtml(brief.prompts || 'Not provided')}</p>
      </div>
    `,
  });
}

function serializeAccount(row) {
  const features = getPlanFeatures(row.plan);
  return {
    id: row.id,
    company_name: row.company_name,
    website: row.website,
    plan: row.plan,
    plan_label: features.label,
    plan_features: features,
    status: row.status,
    stripe_customer_id: row.stripe_customer_id,
    stripe_subscription_id: row.stripe_subscription_id,
    current_period_end: row.current_period_end,
  };
}

function hasPaidAccess(account) {
  return ['active', 'trialing', 'paid_diagnostic'].includes(account.status);
}

function isOneTimePlan(plan) {
  return plan === 'diagnostic';
}

function getPlanFeatures(plan) {
  return PLAN_FEATURES[plan] || PLAN_FEATURES.monitor;
}

function env(name, fallback = '') {
  return (process.env[name] || fallback).replace(/\\n$/, '').trim();
}

function clean(value) {
  return String(value || '').trim();
}

function cleanEmail(value) {
  const email = clean(value).toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : '';
}

function randomToken() {
  return crypto.randomBytes(32).toString('base64url');
}

function hashToken(token) {
  return crypto.createHmac('sha256', AUTH_SECRET).update(token).digest('hex');
}

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function requireDb(res) {
  if (!pool) {
    res.status(500).json({ error: 'Database not configured' });
    throw new Error('Database not configured');
  }
}

function isAllowedOrigin(origin) {
  if (origin === CORS_ORIGIN || origin === APP_URL) return true;
  if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) return true;
  return false;
}
