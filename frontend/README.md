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
