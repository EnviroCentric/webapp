# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react/README.md) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript and enable type-aware lint rules. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

## Public website contact form
Set `VITE_CONTACT_FORM_URL` to a contact intake endpoint accepting a JSON POST before building for production. The form sends firstName, lastName, email, countryCode, phone, details, clientType, referral, and optional communicationsConsent. The endpoint must support your website origin and return a successful HTTP status only after accepting the request. Without this setting, the form preserves entries and explains that online submission is unavailable. No CAPTCHA or privacy-policy claim is displayed until those services and content are configured.

The public client introduction is at `/our-projects`; `/projects` remains the authenticated project portal. Homepage landscapes rotate every six seconds and can be paused or manually selected. Services landscapes change as category headings pass the viewport anchor. Reduced-motion preferences disable automatic homepage rotation.


## Visibility and About Us release

This branch contains search metadata, sitemap/robots generation, build-time rendering of the four existing public pages, the transparent company favicon, Envirocentric branding, and updated company experience, credentials and NAICS information. Services retain the existing category anchors at `/services#asbestos`, `/services#lead`, `/services#microbial` and `/services#hazardous-waste`. Carousel routes, carousel photos, scrolling/animation changes, contact API work and other unfinished UI changes remain in the original `sarah` checkout.

`src/data/seo.js` defines the production origin, page descriptions and organization schema. The primary name is Envirocentric, with Enviro-Centric as an alternate name. Account/unknown routes have no canonical and use `noindex`.

Run `npm run build` to build and prerender `/`, `/services`, `/our-projects` and `/contact`, plus `sitemap.xml`, `robots.txt` and a neutral `app.html` fallback. `public/logo.png` is the original company logo; keep it in sync with `src/assets/logo.png`.

Deploy the frontend with `npm run deploy`, setting `WEBSITE_BUCKET`, `DISTRIBUTION_ID` and `AWS_REGION` to the existing hosting resources. The deployment script uploads nested index files as extensionless S3 page keys with HTML content types, handles XML/TXT content types, and invalidates CloudFront. Keep the existing production `VITE_API_URL` and other frontend build settings when building. The legacy batch uploader does not map prerendered page URLs.

Upload the frontend build before applying the infrastructure change that uses `/app.html` for CloudFront's 403/404 SPA fallback; the fallback must exist first. This change does not include the unrelated SES/contact API policy changes from the working checkout. Review the infrastructure diff against the actual deployed stack before applying it.

The checked-in GitHub Actions workflow currently targets `main`, while this repository's remote default is `master`; it also uses old deployment variable names and lacks a frontend build. Pushing this release branch does not automatically deploy it. Use the validated frontend deployment command above against the existing resources until the workflow is updated separately.

After deploying, inspect the four public URLs in Search Console and submit `https://www.enviro-centric.com/sitemap.xml`. Rankings and search-result presentation are controlled by Google.
