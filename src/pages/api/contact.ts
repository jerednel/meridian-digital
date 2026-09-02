import type { APIRoute } from 'astro';
import { Resend } from 'resend';
import { escapeHtml, parseLead } from '../../lib/lead';
import { SITE } from '../../lib/site';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const contentType = request.headers.get('content-type') || '';
  let raw: Record<string, string> = {};

  if (contentType.includes('application/json')) {
    const data = await request.json();
    raw = {
      name: String(data.name || ''),
      email: String(data.email || ''),
      website: String(data.website || ''),
      company_fax: String(data.company_fax || ''),
      source: String(data.source || 'contact'),
    };
  } else {
    const data = await request.formData();
    raw = {
      name: data.get('name')?.toString() || '',
      email: data.get('email')?.toString() || '',
      website: data.get('website')?.toString() || '',
      company_fax: data.get('company_fax')?.toString() || '',
      source: 'contact',
    };
  }

  const parsed = parseLead(raw);
  if (!parsed.ok) {
    return new Response(JSON.stringify({ error: parsed.error }), {
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

  const { name, email, website, source } = parsed.data;
  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from: `Meridian Contact <noreply@${SITE.domain}>`,
    to: [SITE.email],
    replyTo: email,
    subject: `Contact from ${name || email}`,
    html: `
      <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Contact form</h2>
        <p>Source: ${escapeHtml(source)}</p>
        <p>Name: ${escapeHtml(name || 'Not provided')}</p>
        <p>Email: ${escapeHtml(email)}</p>
        <p>Website: ${escapeHtml(website)}</p>
      </div>
    `,
  });

  if (error) {
    return new Response(JSON.stringify({ error: 'Failed to send message. Please try again.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
