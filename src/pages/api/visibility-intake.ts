import type { APIRoute } from 'astro';
import { Resend } from 'resend';

function clean(value: unknown): string {
  return String(value || '').trim();
}

function envValue(value: string | undefined): string {
  return (value || '').replace(/\\n$/, '').trim();
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export const POST: APIRoute = async ({ request }) => {
  const data = await request.json();

  const name = clean(data.name);
  const email = clean(data.email);
  const website = clean(data.website);
  const category = clean(data.category);
  const competitors = clean(data.competitors);
  const prompts = clean(data.prompts);
  const plan = clean(data.plan || 'monitor');
  const sessionId = clean(data.session_id);

  if (!name || !email || !website || !category) {
    return new Response(JSON.stringify({ error: 'Missing required fields.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const apiKey = envValue(import.meta.env.RESEND_API_KEY);
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'Email service not configured.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const resend = new Resend(apiKey);
  const safe = {
    name: escapeHtml(name),
    email: escapeHtml(email),
    website: escapeHtml(website),
    category: escapeHtml(category),
    competitors: escapeHtml(competitors || 'Not provided'),
    prompts: escapeHtml(prompts || 'Not provided'),
    plan: escapeHtml(plan),
    sessionId: escapeHtml(sessionId || 'Not provided'),
  };

  const intakeHtml = `
    <div style="font-family: system-ui, sans-serif; max-width: 680px; margin: 0 auto;">
      <h2 style="color: #E8714A; margin-bottom: 4px;">New Meridian AI Search customer intake</h2>
      <p style="color: #64748B; margin-top: 0;">Plan: <strong>${safe.plan}</strong></p>
      <hr style="border: none; border-top: 1px solid #E2E8F0; margin: 24px 0;" />
      <table style="width: 100%; border-collapse: collapse;">
        <tr><td style="padding: 8px 0; color: #94A3B8; font-size: 12px; text-transform: uppercase; width: 140px;">Name</td><td>${safe.name}</td></tr>
        <tr><td style="padding: 8px 0; color: #94A3B8; font-size: 12px; text-transform: uppercase;">Email</td><td><a href="mailto:${safe.email}" style="color: #E8714A;">${safe.email}</a></td></tr>
        <tr><td style="padding: 8px 0; color: #94A3B8; font-size: 12px; text-transform: uppercase;">Website</td><td><a href="${safe.website}" style="color: #E8714A;">${safe.website}</a></td></tr>
        <tr><td style="padding: 8px 0; color: #94A3B8; font-size: 12px; text-transform: uppercase;">Category</td><td>${safe.category}</td></tr>
        <tr><td style="padding: 8px 0; color: #94A3B8; font-size: 12px; text-transform: uppercase;">Stripe Session</td><td>${safe.sessionId}</td></tr>
      </table>
      <hr style="border: none; border-top: 1px solid #E2E8F0; margin: 24px 0;" />
      <p style="color: #94A3B8; font-size: 12px; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 8px;">Competitors</p>
      <p style="white-space: pre-wrap; color: #0F172A;">${safe.competitors}</p>
      <p style="color: #94A3B8; font-size: 12px; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 8px;">Buyer questions / prompts</p>
      <p style="white-space: pre-wrap; color: #0F172A;">${safe.prompts}</p>
    </div>
  `;

  await resend.emails.send({
    from: 'Meridian Leads <noreply@bymeridian.com>',
    to: ['jeremy@bymeridian.com'],
    replyTo: email,
    subject: `New AI Search intake: ${name} (${website})`,
    html: intakeHtml,
  });

  await resend.emails.send({
    from: 'Jeremy at Meridian <jeremy@bymeridian.com>',
    to: [email],
    subject: 'Your Meridian AI Search monitor is queued',
    html: `
      <div style="font-family: system-ui, sans-serif; max-width: 620px; margin: 0 auto; color: #0F172A;">
        <p>Hi ${safe.name},</p>
        <p>Your AI search visibility monitor is queued for <strong>${safe.website}</strong>.</p>
        <p>The first run checks whether AI answer surfaces mention, cite, or omit you when buyers ask about <strong>${safe.category}</strong>. The output is a prompt map, competitor/citation table, and recommended next actions.</p>
        <p>If you want to add context, reply with any must-watch competitors, priority pages, or buyer segments.</p>
        <p>Talk soon,<br/><strong>Jeremy</strong><br/><span style="color: #64748B;">Meridian &mdash; <a href="https://bymeridian.com" style="color: #E8714A;">bymeridian.com</a></span></p>
      </div>
    `,
  });

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
