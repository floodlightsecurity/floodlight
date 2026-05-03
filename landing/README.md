# Floodlight — Landing Page

The marketing front door for Floodlight. Single static HTML page plus one serverless function for the sign-up form.

Lives at: **https://floodlightsecurity.co**

## What's here

```
landing/
├── public/
│   └── index.html       # the entire landing page (CSS, JS, copy, all inline)
├── api/
│   └── lead.js          # Vercel serverless function — /api/lead
├── vercel.json          # deployment config (security headers, output dir)
└── README.md            # this file
```

## Local preview

You can view the page locally without any build step:

```bash
cd landing/public
python3 -m http.server 8080
# Open http://localhost:8080
```

The form will fail when submitted locally (no `/api/lead` available), but every other interaction works.

To test the form end-to-end locally, install Vercel CLI and run:

```bash
npm install -g vercel
cd landing
vercel dev
# Open http://localhost:3000
```

## Deployment — first time

### 1. Resend setup (5 minutes)

1. Sign up at [resend.com](https://resend.com) — free tier covers 100 emails/day, 3,000/month
2. Add and verify the `floodlightsecurity.co` domain in Resend
3. Verifying requires adding 3 DNS records (SPF, DKIM, return-path) at your domain registrar
4. Once verified, create an API key from `https://resend.com/api-keys` — copy it, you'll need it in step 3

### 2. Deploy to Vercel

1. Push this repo to GitHub (already done if you're following along)
2. Go to [vercel.com](https://vercel.com), sign in with GitHub
3. Click "Add New Project" → import the `floodlight` repo
4. **Important:** in the import wizard, set the **Root Directory** to `landing` so Vercel builds from this folder, not the repo root
5. Framework preset: **Other**
6. Build command: leave blank
7. Output directory: `public`
8. Click Deploy. The first deploy will fail because env vars are missing — fix that next.

### 3. Set environment variables

In the Vercel dashboard for the project: **Settings → Environment Variables** — add three:

| Name              | Value                                                  |
|-------------------|--------------------------------------------------------|
| `RESEND_API_KEY`  | The API key from Resend (starts with `re_…`)           |
| `LEAD_TO_EMAIL`   | Your inbox, e.g. `david@floodlightsecurity.co`         |
| `LEAD_FROM_EMAIL` | A verified sender on Resend, e.g. `leads@floodlightsecurity.co` |

Apply to **Production, Preview, Development** for all three.

Then redeploy: in Vercel, **Deployments → ⋯ → Redeploy** on the most recent build.

### 4. Connect your domain

1. In Vercel: **Settings → Domains** → add `floodlightsecurity.co` and `www.floodlightsecurity.co`
2. Vercel will tell you which DNS records to set at your domain registrar (Cloudflare, Namecheap, etc.)
3. Add them, wait 5–60 minutes for propagation
4. Vercel auto-issues an SSL cert; the site goes live as soon as DNS resolves

### 5. Test the form

1. Visit `https://floodlightsecurity.co/#audit`
2. Fill in the form with real values (use a non-Gmail email)
3. Submit
4. Check the inbox you set as `LEAD_TO_EMAIL` — the lead email should arrive within 30 seconds

If something fails: in Vercel, go to **Deployments → [latest] → Functions** to see the runtime logs.

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
> ...

Reply-to is set to the lead's email, so hitting reply in your inbox writes back to them directly.

## Anti-spam notes

The form has three layers of basic protection:

- **Client-side validation** — required fields, email format check
- **Server-side validation** — re-checks everything; rejects malformed payloads with HTTP 400
- **Honeypot field** — the API checks for a hidden `website` field; if present and non-empty, the request is silently treated as success but no email is sent (bots fill in every field they see)

If real spam becomes a problem, the next layers to add are: Cloudflare Turnstile (free, invisible CAPTCHA), per-IP rate limiting via Vercel KV, or Cloudflare Workers in front of `/api/lead`.

## Changing the design

The whole landing page is one file: `public/index.html`. Open it in a code editor and search for what you want to change. Specific things:

- **Brand colour** — search for `--amber: #BA7517`
- **Display font** — search for `--font-display: "Newsreader"`
- **Body font** — search for `--font-body: "IBM Plex Sans"`
- **Hero copy** — search for `<h1` to find the main headline
- **Form fields** — search for `<form id="audit-form"`

Save, push, deployed.
