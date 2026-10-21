import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { organization, pageMetadata } from '../data/seo';

export default function Seo() {
  const { pathname } = useLocation();
  useEffect(() => {
    const page = pageMetadata(pathname);
    document.title = page.title;
    for (const [name, content] of Object.entries({ description: page.description, robots: page.robots })) {
      let tag = document.head.querySelector(`meta[name="${name}"]`);
      if (!tag) { tag = document.createElement('meta'); tag.name = name; document.head.append(tag); }
      tag.content = content;
    }
    let canonical = document.head.querySelector('link[rel="canonical"]');
    if (page.canonical) {
      if (!canonical) { canonical = document.createElement('link'); canonical.rel = 'canonical'; document.head.append(canonical); }
      canonical.href = page.canonical;
    } else canonical?.remove();

    let schema = document.getElementById('organization-schema');
    if (page.canonical) {
      if (!schema) { schema = document.createElement('script'); schema.id = 'organization-schema'; schema.type = 'application/ld+json'; document.head.append(schema); }
      schema.textContent = JSON.stringify(organization);
    } else schema?.remove();
  }, [pathname]);
  return null;
}
