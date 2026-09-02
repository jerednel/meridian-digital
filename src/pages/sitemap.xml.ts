import type { APIRoute } from 'astro';
import { SITE } from '../lib/site';

export const prerender = true;

const pages = [
  '/',
  '/sample',
  '/how-it-works',
  '/about',
  '/insights',
  '/insights/shortlist-before-the-site',
  '/insights/questions-that-turn-into-revenue',
  '/insights/why-answers-cite-competitors',
  '/insights/what-a-sprint-finds',
  '/contact',
  '/privacy',
  '/terms',
  '/platform',
];

export const GET: APIRoute = () => {
  const urls = pages
    .map((path) => {
      const loc = path === '/' ? `${SITE.url}/` : `${SITE.url}${path}`;
      return `  <url><loc>${loc}</loc></url>`;
    })
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
