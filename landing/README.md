# Floodlight — Landing Page

The marketing front door for Floodlight. Single static HTML page plus one Cloudflare Pages Function for the sign-up form.

Lives at: **https://floodlightsecurity.co**

## What's here

```
landing/
├── public/
│   ├── index.html       # the entire landing page (CSS, JS, copy, all inline)
│   └── _headers         # security headers (Cloudflare Pages convention)
├── functions/
│   └── api/
│       └── lead.js      # Pages Function — auto-routed to /api/lead
└── README.md            # this file
```

## Local preview

You can view the static page locally without any build step:

```bash
cd landing/public
python3 -m http.server 8080
# Open http://localhost:8080
```

The form will fail when submitted locally (no `/api/lead` available), but every other interaction works.

To test the form end-to-end locally, install Wrangler (Cloudflare CLI) and run:

```bash
npm install -g wrangler
cd landing
wrangler pages dev public --compatibility-date=2024-01-01
# Open http://localhost:8788
```

When running with `wrangler pages dev`, Functions in the `functions/` folder are loaded automatically and routed by file path. `functions/api/lead.js` becomes `POST /api/lead`.

For the form to actually send email locally, set the env vars in a `.dev.vars` file (gitignored):

```
RESEND_API_KEY=re_...
LEAD_TO_EMAIL=david@floodlightsecurity.co
LEAD_FROM_EMAIL=leads@floodlightsecurity.co
```

## Deployment — first time

### 1. Resend setup (5 minutes)

1. Sign up at [resend.com](https://resend.com) — free tier covers 100 emails/day, 3,000/month
2. Add and verify the `floodlightsecurity.co` domain in Resend
3. Verifying requires adding 3 DNS records (SPF, DKIM, return-path) at your domain registrar (Cloudflare)
4. Once verified, create an API key from `https://resend.com/api-keys` — copy it, you'll need it later

### 2. Deploy to Cloudflare Pages

1. Push this repo to GitHub (already done if you're following along)
2. Sign in to [dash.cloudflare.com](https://dash.cloudflare.com) — same account that holds the domain
3. In the left nav: **Workers & Pages** → **Create** → **Pages** → **Connect to Git**
4. Authorise GitHub access, select the `floodlight` repository
5. Configure the build:

   | Setting              | Value                |
   |----------------------|----------------------|
   | Project name         | `floodlight-landing` (or anything — this becomes the staging URL) |
   | Production branch    | `main`               |
   | Framework preset     | **None**             |
   | Build command        | *(leave blank)*      |
   | Build output directory | `landing/public`   |
   | Root directory       | `/` (leave default)  |

6. Click **Save and Deploy**. The first build will succeed but the form will fail because env vars aren't set yet — fix that next.

### 3. Set environment variables

In the Pages project: **Settings → Environment variables → Production** — add three variables. Click **Encrypt** on each (especially the API key).

| Name              | Value                                                  |
|-------------------|--------------------------------------------------------|
| `RESEND_API_KEY`  | The API key from Resend (starts with `re_…`)           |
| `LEAD_TO_EMAIL`   | Your inbox, e.g. `david@floodlightsecurity.co`         |
| `LEAD_FROM_EMAIL` | A verified sender on Resend, e.g. `leads@floodlightsecurity.co` |

Add the same three to **Preview** as well so PR previews work.

Then redeploy: **Deployments → ⋯ on the latest build → Retry deployment**.

### 4. Connect your domain

1. Still in the Pages project: **Custom domains** → **Set up a custom domain**
2. Enter `floodlightsecurity.co` → Continue
3. Cloudflare will detect that the domain is on the same Cloudflare account and configure DNS automatically
4. Repeat for `www.floodlightsecurity.co` if you want both
5. SSL provisions instantly (Cloudflare-managed). Site goes live within a couple of minutes.

### 5. Test the form

1. Visit `https://floodlightsecurity.co/#audit`
2. Fill in the form with real values (use a non-Gmail email)
3. Submit
4. Check the inbox you set as `LEAD_TO_EMAIL` — the lead email should arrive within 30 seconds

If something fails: in the Pages project, **Deployments → [latest] → View Function logs** shows runtime output from the Worker.

## Why Cloudflare Pages (not Vercel)?

Cloudflare Pages' free tier explicitly permits commercial use. Vercel's Hobby tier does not — it's restricted to non-commercial projects, and Floodlight is a commercial product. Pages also keeps domain, DNS, hosting, SSL, and the form handler all on one Cloudflare account, which means one less DNS handoff to break.

The Cloudflare Workers Free plan caps at 100k requests/day — well above what a B2B security marketing page generates. If we ever hit that ceiling, it's a good problem and the upgrade is £5/month.

## Updating the page

After the initial deploy, every `git push` to `main` automatically rebuilds and redeploys. Edit `public/index.html`, commit, push — within ~30 seconds it's live. Preview deploys are auto-created for every branch and PR.

## Form lead format

When a sign-up happens, the email looks like:

> **Subject:** New audit lead — Acme Capital Ltd (50–199)
>
> Name: Sarah Chen
> Email: sarah@acmecapital.co.uk
> Company: Acme Capital Ltd
> Headcount: 50-199
> Submitted: 2026-05-03T14:22:18Z
> Country: GB
> ...

Reply-to is set to the lead's email, so hitting reply in your inbox writes back to them directly. Cloudflare's `CF-IPCountry` header is included so you can quickly spot leads worth prioritising (UK leads first, etc.).

## Anti-spam notes

The form has three layers of basic protection:

- **Client-side validation** — required fields, email format check
- **Server-side validation** — re-checks everything; rejects malformed payloads with HTTP 400
- **Honeypot field** — the API checks for a hidden `website` field; if present and non-empty, the request is silently treated as success but no email is sent (bots fill in every field they see)

If real spam becomes a problem, the next layers to add are: Cloudflare Turnstile (free, invisible CAPTCHA — Cloudflare's own product, drops in cleanly), per-IP rate limiting via Cloudflare's Rate Limiting Rules, or a Workers KV-backed deduplication.

## Changing the design

The whole landing page is one file: `public/index.html`. Open it in a code editor and search for what you want to change. Specific things:

- **Brand colour** — search for `--amber: #BA7517`
- **Display font** — search for `--font-display: "Newsreader"`
- **Body font** — search for `--font-body: "IBM Plex Sans"`
- **Hero copy** — search for `<h1` to find the main headline
- **Form fields** — search for `<form id="audit-form"`

Save, push, deployed.
