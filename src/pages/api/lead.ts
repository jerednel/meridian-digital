import type { APIRoute } from 'astro';
import { Resend } from 'resend';
import { escapeHtml, parseLead } from '../../lib/lead';
import { OFFER, SITE } from '../../lib/site';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid request.' }, 400);
  }

  const parsed = parseLead((body || {}) as Record<string, string>);
  if (!parsed.ok) {
    return json({ error: parsed.error }, 400);
  }

  const apiKey = import.meta.env.RESEND_API_KEY;
  if (!apiKey) {
    return json({ error: 'Email service not configured.' }, 500);
  }

  const { website, email, name, source } = parsed.data;
  const safeName = escapeHtml(name || 'Not provided');
  const safeEmail = escapeHtml(email);
  const safeWebsite = escapeHtml(website);
  const safeSource = escapeHtml(source);

  const resend = new Resend(apiKey);

  const { error } = await resend.emails.send({
    from: `Meridian Leads <noreply@${SITE.domain}>`,
    to: [SITE.email],
    replyTo: email,
    subject: `Sprint inquiry: ${name || email} (${website})`,
    html: `
      <div style="font-family: system-ui, sans-serif; max-width: 640px; margin: 0 auto;">
        <h2 style="margin-bottom: 4px;">New ${OFFER.sprintName} inquiry</h2>
        <p style="color: #64748B; margin-top: 0;">Source: ${safeSource}</p>
        <table style="width: 100%; border-collapse: collapse;">
          <tr><td style="padding: 8px 0; color: #94A3B8; width: 120px;">Name</td><td>${safeName}</td></tr>
          <tr><td style="padding: 8px 0; color: #94A3B8;">Email</td><td><a href="mailto:${safeEmail}">${safeEmail}</a></td></tr>
          <tr><td style="padding: 8px 0; color: #94A3B8;">Website</td><td><a href="${safeWebsite}">${safeWebsite}</a></td></tr>
        </table>
        <p style="color: #94A3B8; font-size: 12px; margin-top: 24px;">Reply directly to this email.</p>
      </div>
    `,
  });

  if (error) {
    return json({ error: 'Failed to send. Please try again.' }, 500);
  }

  await resend.emails.send({
    from: `Jeremy at Meridian <${SITE.email}>`,
    to: [email],
    subject: `We'll look at where buyers may be missing ${new URL(website).hostname}`,
    html: `
      <div style="font-family: system-ui, sans-serif; max-width: 620px; margin: 0 auto; color: #1c1915;">
        <p>${name ? `Hi ${escapeHtml(name)},` : 'Hello,'}</p>
        <p>Got it. I'll look at the buyer questions around <strong>${safeWebsite}</strong> and come back with what I actually find — including if there isn't a meaningful gap.</p>
        <p>This is not a generic audit. The reply will cover who is named when buyers research your category in Google and AI search, and whether a 30-day Sprint is warranted.</p>
        <p>If you want to add competitors or must-watch questions, just reply.</p>
        <p>Jeremy<br/><span style="color:#5e584f;">Meridian — ${SITE.domain}</span></p>
      </div>
    `,
  });

  return json({ success: true }, 200);
};

function json(data: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
