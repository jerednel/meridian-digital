import type { APIRoute } from 'astro';
import { Resend } from 'resend';

export const POST: APIRoute = async ({ request }) => {
  const data = await request.formData();

  const name    = data.get('name')?.toString().trim() || '';
  const email   = data.get('email')?.toString().trim() || '';
  const website = data.get('website')?.toString().trim() || '';
  const goals   = data.get('goals')?.toString().trim() || '';
  const referral = data.get('referral')?.toString().trim() || '';

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

  const { error } = await resend.emails.send({
    from: 'Meridian Contact <noreply@bymeridian.com>',
    to: ['jeremy@bymeridian.com'],
    replyTo: email,
    subject: `New inquiry from ${name}`,
    html: `
      <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #E8714A; margin-bottom: 4px;">New Contact Form Submission</h2>
        <p style="color: #64748B; margin-top: 0;">bymeridian.com</p>
        <hr style="border: none; border-top: 1px solid #E2E8F0; margin: 24px 0;" />
        <table style="width: 100%; border-collapse: collapse;">
          <tr><td style="padding: 8px 0; color: #94A3B8; font-size: 12px; text-transform: uppercase; letter-spacing: 0.06em; width: 120px;">Name</td><td style="padding: 8px 0; color: #0F172A; font-weight: 500;">${name}</td></tr>
          <tr><td style="padding: 8px 0; color: #94A3B8; font-size: 12px; text-transform: uppercase; letter-spacing: 0.06em;">Email</td><td style="padding: 8px 0;"><a href="mailto:${email}" style="color: #E8714A;">${email}</a></td></tr>
          <tr><td style="padding: 8px 0; color: #94A3B8; font-size: 12px; text-transform: uppercase; letter-spacing: 0.06em;">Website</td><td style="padding: 8px 0;"><a href="${website}" style="color: #E8714A;">${website}</a></td></tr>
          ${referral ? `<tr><td style="padding: 8px 0; color: #94A3B8; font-size: 12px; text-transform: uppercase; letter-spacing: 0.06em;">Referral</td><td style="padding: 8px 0; color: #0F172A;">${referral}</td></tr>` : ''}
        </table>
        ${goals ? `
        <hr style="border: none; border-top: 1px solid #E2E8F0; margin: 24px 0;" />
        <p style="color: #94A3B8; font-size: 12px; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 8px;">Goals</p>
        <p style="color: #0F172A; line-height: 1.6; margin: 0;">${goals.replace(/\n/g, '<br>')}</p>
        ` : ''}
        <hr style="border: none; border-top: 1px solid #E2E8F0; margin: 24px 0;" />
        <p style="color: #94A3B8; font-size: 12px;">Reply directly to this email to respond to ${name}.</p>
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
