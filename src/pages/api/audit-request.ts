import type { APIRoute } from 'astro';
import { Resend } from 'resend';

export const POST: APIRoute = async ({ request }) => {
  const data = await request.json();

  const name    = (data.name || '').trim();
  const email   = (data.email || '').trim();
  const website = (data.website || '').trim();
  const source  = (data.source || 'direct').trim();

  if (!name || !email || !website) {
    return new Response(JSON.stringify({ error: 'Missing required fields.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const apiKey = import.meta.env.RESEND_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'Email service not configured.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const resend = new Resend(apiKey);

  // Notify Jeremy
  await resend.emails.send({
    from: 'Meridian Leads <noreply@bymeridian.com>',
    to: ['jeremy@bymeridian.com'],
    replyTo: email,
    subject: `🎯 New audit request from ${name} (${website})`,
    html: `
      <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #E8714A; margin-bottom: 4px;">New Free Audit Request</h2>
        <p style="color: #64748B; margin-top: 0;">Source: <strong>${source}</strong></p>
        <hr style="border: none; border-top: 1px solid #E2E8F0; margin: 24px 0;" />
        <table style="width: 100%; border-collapse: collapse;">
          <tr><td style="padding: 8px 0; color: #94A3B8; font-size: 12px; text-transform: uppercase; letter-spacing: 0.06em; width: 120px;">Name</td><td style="padding: 8px 0; color: #0F172A; font-weight: 500;">${name}</td></tr>
          <tr><td style="padding: 8px 0; color: #94A3B8; font-size: 12px; text-transform: uppercase; letter-spacing: 0.06em;">Email</td><td style="padding: 8px 0;"><a href="mailto:${email}" style="color: #E8714A;">${email}</a></td></tr>
          <tr><td style="padding: 8px 0; color: #94A3B8; font-size: 12px; text-transform: uppercase; letter-spacing: 0.06em;">Website</td><td style="padding: 8px 0;"><a href="${website}" style="color: #E8714A;">${website}</a></td></tr>
        </table>
        <hr style="border: none; border-top: 1px solid #E2E8F0; margin: 24px 0;" />
        <p style="color: #94A3B8; font-size: 12px;">Reply directly to send the audit report to ${name}.</p>
      </div>
    `,
  });

  // Auto-reply to prospect
  await resend.emails.send({
    from: 'Jeremy at Meridian <jeremy@bymeridian.com>',
    to: [email],
    subject: `Your SEO audit is queued — expect it within 24 hours`,
    html: `
      <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto; color: #0F172A;">
        <p>Hi ${name},</p>
        <p>Got your request — I'll run a full audit on <strong>${website}</strong> and have results in your inbox within 24 hours.</p>
        <p>Here's what I'll cover:</p>
        <ul style="line-height: 2;">
          <li>Technical issues hurting your rankings</li>
          <li>CTR opportunities hiding in your current rankings</li>
          <li>Keyword gaps vs your competitors</li>
          <li>3 specific content recommendations for your site</li>
        </ul>
        <p>If you have any context about your goals or what you've tried before, just reply to this email — it'll help me make the audit more useful.</p>
        <p>Talk soon,<br/><strong>Jeremy</strong><br/><span style="color: #888; font-size: 0.9em;">Meridian &mdash; <a href="https://bymeridian.com" style="color: #E8714A;">bymeridian.com</a></span></p>
      </div>
    `,
  });

  // Queue the automated audit — must await before returning or Vercel kills the request
  try {
    await fetch('https://app.bymeridian.com/api/free-audit-webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, website, source }),
    });
  } catch (_) { /* non-fatal — emails already sent */ }

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
