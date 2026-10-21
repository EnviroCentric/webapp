# React + Vite

## Public search metadata and deployment

`src/data/seo.js` defines the canonical production origin, metadata for each public route, and organization details. `Seo` updates the document head during client navigation. Public URLs are `/`, `/services`, `/our-projects`, `/contact`, and the four service pages defined in `src/data/serviceSlides.js`; account and unknown routes use `noindex` and have no canonical URL.

`npm run build` also renders each public page into HTML, generates `dist/sitemap.xml` and `dist/robots.txt`, and copies the original company logo to the public site. Keep `public/logo.png` in sync with `src/assets/logo.png`. Public content renders from the same React page components used in the browser.

The build emits directory index files (for example `dist/services/asbestos/index.html`). Deploy using `npm run deploy` with `WEBSITE_BUCKET`, `DISTRIBUTION_ID`, and `AWS_REGION` configured: `deploy.js` maps nested index files to extensionless S3 keys (for example `services/asbestos` and `services`) with `text/html`, assigns XML and TXT their correct content types, then invalidates the CDN cache. This allows `/services` and `/services/asbestos` to coexist on S3. Use this deployment script rather than the legacy batch upload, which does not perform that URL mapping.

Upload the frontend build before deploying the infrastructure change that switches CloudFront's SPA error fallback to `/app.html`. That fallback is a neutral `noindex` shell for account and unknown URLs, instead of the prerendered homepage. An existing distribution requires the equivalent fallback update. Public pages and sitemap entries must use the same canonical origin; change `siteUrl` if the production hostname changes.

After deployment, inspect the public URLs in Search Console and submit `https://enviro-centric.com/sitemap.xml`. Metadata and structured data help describe the business but do not guarantee rankings or a particular search appearance.

## Readability and shared shading

Clear crystal-glass text boxes are the default. The navbar Readability switch enables the existing dark blue-gray text boxes; switching it off restores clear glass. The no-box option is removed. Preferences persist in `localStorage.readabilityMode`: 2 is glass, 3 is dark, and a previously saved 1 now maps to glass. An older `showTextBoxes=true` preference still maps to dark boxes. The control continues to work if storage is blocked.

Content surface variables are scoped to `main`; the navbar and its menus have their own independent palette. `--navbar-rgb` in `src/index.css` uses the screenshot-matched blue-gray #35414F (53, 65, 79) for both the navbar and shared page gradient. The gradient starts below the 64px navbar, so shading does not affect navigation. The services scroll hint is right-aligned. Desktop services use one panel; mobile applies the chosen style to individual cards.

## Services carousel behavior

The services carousel uses real routes: `/services/asbestos`, `/services/lead`, `/services/microbial`, and `/services/hazardous-waste`. Each has its own prerendered content, metadata and sitemap entry. Top service bubbles, left/right keys when the carousel region is focused, and horizontal touch swipes outside the details navigate between these routes. The header reads “Our Services”; the top-right location/company label is removed. The slide counter appears beside the bubbles; there are no bottom arrow controls. Browser Back/Forward work normally; switching slides preserves the carousel's scroll position, while subsection links still scroll to their target. Old `/services#...` bookmarks redirect to the relevant service page.

At desktop widths of 1024px and above, the heading sits to the left of one scrollable information panel. Wheel input over the stage scrolls that panel first. At a panel boundary, 180px of additional wheel movement advances/reverses the service, with a 1000ms cooldown to absorb momentum. Direction changes or gaps longer than 220ms clear partial threshold input. Scrolling beyond the first/last service releases the document scroll, allowing access to the footer. Mobile uses normal document scrolling and transparent, individually outlined detail cards.

`useSlowServiceScroll` waits three seconds, then automatically scrolls only the desktop information panel at 4 pixels per second. It stops at the bottom without advancing the carousel. Wheel, touch, scrolling keys, scrollbar interaction or external panel scrolling disable it immediately, with `sessionStorage.servicesAutoScrollStopped` preserving that stop across navigation and reloads for the browser tab. It does not run on mobile or with reduced motion enabled; hidden/offscreen content does not advance.

`src/data/serviceSlides.js` controls the photo, crop position, label and SEO summary for each category. The original supplied PNGs are preserved in `src/assets/landscapes/`; JPEG web copies are in `public/images/landscapes/`. The fourth slide uses the existing Big Sur image. The photo stage waits for the incoming photo to load before crossfading, and reduced-motion preferences disable the content animation and photo transition.

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react/README.md) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript and enable type-aware lint rules. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

## Public website contact form
Set `VITE_CONTACT_FORM_URL` to a contact intake endpoint accepting a JSON POST before building for production. The form sends firstName, lastName, email, countryCode, phone, details, clientType, referral, and optional communicationsConsent. The endpoint must support your website origin and return a successful HTTP status only after accepting the request. Without this setting, the form preserves entries and explains that online submission is unavailable. No CAPTCHA or privacy-policy claim is displayed until those services and content are configured.

The public client introduction is at `/our-projects`; `/projects` remains the authenticated project portal. Homepage landscapes rotate every six seconds and can be paused or manually selected. Services landscapes change as category headings pass the viewport anchor. Reduced-motion preferences disable automatic homepage rotation.
