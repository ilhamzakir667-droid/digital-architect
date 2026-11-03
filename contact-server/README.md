# DIGRIX — contact form API (separate from the GitHub Pages website)

The live DIGRIX website is static and runs on GitHub Pages, which does **not** execute Node.js server code. This folder contains a separately deployable SMTP-backed contact receiver. It is **not deployed automatically** by GitHub Pages.

## Before activating

1. Deploy this service on an adequately secured server **in Russia** (or a vetted Russian data processor), under HTTPS, for example at `https://api.digrix.tech/contact`. Verify its storage, logging, and mail-routing locations. Review legal obligations under 152-FZ.
2. Install Node.js 20+, then run `npm install` inside this folder.
3. Set environment variables from `.env.example` **in the hosting panel**, not in git. Use an application-specific SMTP password; never publish it.
4. Set a verified sender mailbox, `MAIL_TO`, and `ALLOWED_ORIGINS=https://digrix.tech`.
5. Set up a reverse proxy with TLS and appropriate request limits, e.g. map `https://api.digrix.tech/contact` to this service's `POST /contact`. Configure process restarts and operational monitoring.
6. Update `privacy.html` and `pdn.html` to explain the **actual** automatic submission route, hosting/mail recipients, data retention, and any processor relationships; review with counsel. Their current text correctly describes **only** the old mailto behavior, not this optional backend.
7. Only after the endpoint is active and the documents are updated, set `data-endpoint="https://api.digrix.tech/contact"` on the existing form in `index.html`. The button and status message then switch to automatic submission, without changing the site's layout or CSS.
8. Test with dummy data from desktop and mobile, ensure the mailbox actually receives each request, and only then merge and publish the changes. Monitor for failed deliveries.

## Expected request

`POST /contact` with `Content-Type: application/json`, and a browser `Origin: https://digrix.tech`.

Body:

```json
{
  "name": "Тест",
  "contact": "@example_contact",
  "message": "Тестовая заявка, не клиент",
  "consent": true,
  "consentVersion": "2026-09-01",
  "consentAt": "2026-11-03T12:00:00.000Z",
  "website": ""
}
```

Success response: HTTP 202, `{"ok":true}`. HTTP 503 means email delivery failed. Do not falsely report success if SMTP did not accept the message. The API does not store submissions in a database. Check the behavior and retention policy of the chosen SMTP provider.

## Nonbreaking fallback

With empty `data-endpoint`, the **original** mailto flow remains, matching the current privacy documents. The optional backend introduces no CSS or visual redesign. Never place SMTP passwords or Telegram bot tokens in frontend JavaScript or HTML.

## Security notes

The API validates consent, field sizes, content type, origin, and a honeypot field. A small per-IP in-memory rate limit exists as basic abuse protection only. For production, add trusted-proxy aware rate limiting/WAF and monitoring appropriate to the host. Keep logs free of personal data. A `/health` endpoint is provided.

The current `data-endpoint` is intentionally blank. **Do not describe the form as automatically delivering leads until the server is deployed, configured and tested.**
