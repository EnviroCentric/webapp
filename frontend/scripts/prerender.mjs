import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { organization, publicPages, pageMetadata, siteUrl } from '../src/data/seo.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'dist');
const template = await readFile(path.join(output, 'index.html'), 'utf8');
const escape = value => value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const server = await createServer({ root, configFile: false, plugins: [react()], server: { middlewareMode: true }, appType: 'custom' });
try {
  const { renderPublicPage } = await server.ssrLoadModule('/src/seo/prerender.jsx');
  for (const route of Object.keys(publicPages)) {
    const page = pageMetadata(route);
    const head = `<title>${escape(page.title)}</title>
    <meta name="description" content="${escape(page.description)}" />
    <meta name="robots" content="${page.robots}" />
    <link rel="canonical" href="${page.canonical}" />
    <script id="organization-schema" type="application/ld+json">${JSON.stringify(organization).replace(/</g, '\\u003c')}</script>`;
    const html = template.replace(/<title>.*?<\/title>/s, head)
      .replace('<div id="root"></div>', () => `<div id="root">${renderPublicPage(route)}</div>`);
    const directory = route === '/' ? output : path.join(output, route.slice(1));
    await mkdir(directory, { recursive: true });
    await writeFile(path.join(directory, 'index.html'), html);
  }
  // Unknown and account routes must not inherit the homepage canonical/content.
  await writeFile(path.join(output, 'app.html'), template.replace('</head>', '<meta name="robots" content="noindex, follow" /></head>'));
  await writeFile(path.join(output, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${Object.keys(publicPages).map(route => `  <url><loc>${siteUrl}${route}</loc></url>`).join('\n')}\n</urlset>\n`);
  await writeFile(path.join(output, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${siteUrl}/sitemap.xml\n`);
  console.log(`Prerendered ${Object.keys(publicPages).length} public pages, sitemap.xml and robots.txt`);
} finally {
  await server.close();
}
