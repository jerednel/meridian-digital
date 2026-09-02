import { FREE_EMAIL_DOMAINS } from './site';

export type LeadInput = {
  website?: string;
  email?: string;
  name?: string;
  source?: string;
  company_fax?: string;
};

export type LeadPayload = {
  website: string;
  email: string;
  name: string;
  source: string;
};

export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function normalizeWebsite(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(withProtocol);
    if (!url.hostname || !url.hostname.includes('.')) return null;
    if (url.hostname === 'localhost' || url.hostname.endsWith('.local')) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function isWorkEmail(email: string): boolean {
  const trimmed = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return false;
  const domain = trimmed.split('@')[1];
  if (!domain) return false;
  return !FREE_EMAIL_DOMAINS.has(domain);
}

export function parseLead(input: LeadInput): { ok: true; data: LeadPayload } | { ok: false; error: string } {
  if (input.company_fax && input.company_fax.trim()) {
    return { ok: false, error: 'Unable to submit. Please try again.' };
  }

  const website = normalizeWebsite(input.website || '');
  if (!website) {
    return { ok: false, error: 'Enter a company website, including the domain.' };
  }

  const email = (input.email || '').trim().toLowerCase();
  if (!email) {
    return { ok: false, error: 'Enter a work email.' };
  }
  if (!isWorkEmail(email)) {
    return { ok: false, error: 'Use a work email, not a personal inbox.' };
  }

  const name = (input.name || '').trim().slice(0, 120);
  const source = (input.source || 'site').trim().slice(0, 80) || 'site';

  return { ok: true, data: { website, email, name, source } };
}
