import { OFFER, SITE } from './site';

const ORG_ID = `${SITE.url}/#organization`;
const SERVICE_ID = `${SITE.url}/#sprint`;
const WEBSITE_ID = `${SITE.url}/#website`;

export function organizationSchema() {
  return {
    '@type': 'Organization',
    '@id': ORG_ID,
    name: SITE.name,
    legalName: SITE.legalName,
    url: SITE.url,
    email: SITE.email,
    logo: `${SITE.url}/logos/logo-light-black.jpg`,
    founder: {
      '@type': 'Person',
      name: SITE.founder,
    },
    sameAs: [SITE.url],
  };
}

export function websiteSchema() {
  return {
    '@type': 'WebSite',
    '@id': WEBSITE_ID,
    url: SITE.url,
    name: SITE.name,
    publisher: { '@id': ORG_ID },
  };
}

export function serviceSchema() {
  return {
    '@type': 'Service',
    '@id': SERVICE_ID,
    name: OFFER.sprintName,
    serviceType: 'AI search visibility analysis',
    description:
      'A 30-day engagement that maps buyer questions, measures who is named in Google and AI answers, and reports where competitors appear instead of you.',
    provider: { '@id': ORG_ID },
    url: SITE.url,
    areaServed: 'US',
    offers: {
      '@type': 'Offer',
      name: OFFER.sprintName,
      price: String(OFFER.sprintPrice),
      priceCurrency: 'USD',
      availability: 'https://schema.org/InStock',
      url: `${SITE.url}/#missing`,
    },
  };
}

export function articleSchema(opts: {
  title: string;
  description: string;
  url: string;
  datePublished: string;
  dateModified?: string;
}) {
  return {
    '@type': 'Article',
    headline: opts.title,
    description: opts.description,
    url: opts.url,
    mainEntityOfPage: opts.url,
    datePublished: opts.datePublished,
    dateModified: opts.dateModified || opts.datePublished,
    author: {
      '@type': 'Person',
      name: SITE.founder,
    },
    publisher: { '@id': ORG_ID },
  };
}

export function breadcrumbSchema(items: { name: string; url: string }[]) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

export function graph(nodes: Record<string, unknown>[]) {
  return {
    '@context': 'https://schema.org',
    '@graph': nodes,
  };
}
