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

const PRICE_LOOKUPS = {
  diagnostic: 'ai_search_diagnostic',
  monitor: 'ai_search_monitor',
  operator: 'ai_search_operator',
  partner: 'ai_search_partner',
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
  const mode = plan === 'diagnostic' ? 'payment' : 'subscription';

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
  if (session.status !== 'complete' && session.payment_status !== 'paid') {
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

  const brief = await getLatestBrief(account.id);
  const report = await getLatestReport(account.id, brief);
  res.json({ user: req.user, account, brief, report });
});

app.post('/onboarding', requireAuth, async (req, res) => {
  const account = await getPrimaryAccount(req.user.id);
  if (!account) return res.status(404).json({ error: 'No account found.' });

  const website = clean(req.body.website || account.website);
  const category = clean(req.body.category);
  const competitors = clean(req.body.competitors);
  const prompts = clean(req.body.prompts);
  const companyName = clean(req.body.company_name);

  if (!website || !category) return res.status(400).json({ error: 'Website and category are required.' });

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
  await ensureStarterReport(account.id, rows[0]);

  await sendInternalIntake({ user: req.user, account: { ...account, website, company_name: companyName }, brief: rows[0] });
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
      created_at timestamptz not null default now()
    );

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
  if (rows[0]) return rows[0];
  return brief ? buildStarterReport(brief) : null;
}

async function ensureStarterReport(accountId, brief) {
  const report = buildStarterReport(brief);
  await pool.query(
    `insert into reports (account_id, title, visibility_score, citation_score, competitor_pressure, summary, question, answer_surface, source_gap, next_fix)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      accountId,
      report.title,
      report.visibility_score,
      report.citation_score,
      report.competitor_pressure,
      report.summary,
      report.question,
      report.answer_surface,
      report.source_gap,
      report.next_fix,
    ],
  );
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
  return {
    id: row.id,
    company_name: row.company_name,
    website: row.website,
    plan: row.plan,
    status: row.status,
    stripe_customer_id: row.stripe_customer_id,
    stripe_subscription_id: row.stripe_subscription_id,
    current_period_end: row.current_period_end,
  };
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
