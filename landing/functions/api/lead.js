/**
 * Floodlight — lead capture endpoint (Cloudflare Pages Function)
 *
 * Receives audit sign-up form submissions from the landing page, validates
 * the payload, and emails it to the team inbox via Resend.
 *
 * File location matters: this file's path `functions/api/lead.js` makes
 * Cloudflare Pages route it as `POST /api/lead` automatically.
 *
 * Required environment variables (set in the Cloudflare Pages project):
 *   RESEND_API_KEY  — from https://resend.com/api-keys
 *   LEAD_TO_EMAIL   — the inbox to forward leads to (e.g. hello@floodlightsecurity.co)
 *   LEAD_FROM_EMAIL — must be a verified sender on Resend (e.g. leads@floodlightsecurity.co)
 */

const ALLOWED_ORIGINS = [
  "https://floodlightsecurity.co",
  "https://www.floodlightsecurity.co",
  "http://localhost:3000",
  "http://localhost:8080",
  "http://localhost:8788",
];

const HEADCOUNT_VALID = new Set([
  "1-49", "50-199", "200-499", "500-999", "1000+",
]);

const FREEMAIL_DOMAINS = new Set([
  "gmail.com", "yahoo.com", "hotmail.com", "outlook.com",
  "icloud.com", "aol.com", "live.com", "ymail.com",
  "protonmail.com", "proton.me", "mail.com", "gmx.com",
  "yandex.com", "yandex.ru", "qq.com", "163.com",
]);

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

function sanitiseString(s, maxLen = 200) {
  if (typeof s !== "string") return "";
  return s.trim().slice(0, maxLen);
}

function validEmail(s) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) && s.length <= 254;
}

function freemailDomain(email) {
  const at = email.lastIndexOf("@");
  if (at === -1) return false;
  return FREEMAIL_DOMAINS.has(email.slice(at + 1).toLowerCase());
}

/**
 * Standard CORS headers for the response. Cloudflare Pages doesn't set
 * these automatically, so we add them on every response (including errors).
 */
function corsHeaders(origin) {
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin",
  };
}

function jsonResponse(status, body, origin) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders(origin),
    },
  });
}

// Cloudflare Pages: handle preflight
export async function onRequestOptions({ request }) {
  const origin = request.headers.get("Origin") || "";
  return new Response(null, {
    status: 204,
    headers: corsHeaders(origin),
  });
}

// Cloudflare Pages: handle the POST form submission
export async function onRequestPost({ request, env }) {
  const origin = request.headers.get("Origin") || "";

  // Parse JSON body
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse(400, { error: "Invalid JSON" }, origin);
  }

  if (!body || typeof body !== "object") {
    return jsonResponse(400, { error: "Invalid payload" }, origin);
  }

  // Honeypot — bot fills every field
  if (body.website) {
    return jsonResponse(200, { ok: true }, origin);
  }

  const name = sanitiseString(body.name, 100);
  const email = sanitiseString(body.email, 254).toLowerCase();
  const company = sanitiseString(body.company, 200);
  const headcount = sanitiseString(body.headcount, 16);

  const errors = [];
  if (!name || name.length < 2) errors.push("name");
  if (!email || !validEmail(email)) errors.push("email");
  if (!company || company.length < 2) errors.push("company");
  if (!HEADCOUNT_VALID.has(headcount)) errors.push("headcount");

  if (errors.length > 0) {
    return jsonResponse(400, { error: "Invalid fields", fields: errors }, origin);
  }

  const isFreemail = freemailDomain(email);

  // Cloudflare Pages: env vars are on `env`, not process.env
  const apiKey = env.RESEND_API_KEY;
  const toEmail = env.LEAD_TO_EMAIL;
  const fromEmail = env.LEAD_FROM_EMAIL;
  if (!apiKey || !toEmail || !fromEmail) {
    console.error("Missing env vars: RESEND_API_KEY / LEAD_TO_EMAIL / LEAD_FROM_EMAIL");
    return jsonResponse(500, { error: "Server misconfigured" }, origin);
  }

  const submittedAt = new Date().toISOString();
  const userAgent = request.headers.get("User-Agent") || "unknown";
  const ip = request.headers.get("CF-Connecting-IP")
    || request.headers.get("X-Forwarded-For")
    || "unknown";
  const country = request.headers.get("CF-IPCountry") || "unknown";

  const subject = `New audit lead — ${company} (${headcount})`;
  const textBody = [
    `New Floodlight free-audit sign-up.`,
    ``,
    `Name:       ${name}`,
    `Email:      ${email}${isFreemail ? "  ⚠ freemail domain" : ""}`,
    `Company:    ${company}`,
    `Headcount:  ${headcount}`,
    ``,
    `Submitted:  ${submittedAt}`,
    `Country:    ${country}`,
    `IP:         ${ip}`,
    `User-Agent: ${userAgent}`,
  ].join("\n");

  const htmlBody = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; padding: 16px;">
      <h2 style="font-size: 18px; margin: 0 0 16px;">New Floodlight free-audit sign-up</h2>
      <table style="border-collapse: collapse; width: 100%; font-size: 14px;">
        <tr><td style="padding: 6px 12px 6px 0; color: #888;">Name</td><td style="padding: 6px 0;"><strong>${escapeHtml(name)}</strong></td></tr>
        <tr><td style="padding: 6px 12px 6px 0; color: #888;">Email</td><td style="padding: 6px 0;"><a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a>${isFreemail ? ' <span style="color:#A32D2D;">⚠ freemail</span>' : ""}</td></tr>
        <tr><td style="padding: 6px 12px 6px 0; color: #888;">Company</td><td style="padding: 6px 0;"><strong>${escapeHtml(company)}</strong></td></tr>
        <tr><td style="padding: 6px 12px 6px 0; color: #888;">Headcount</td><td style="padding: 6px 0;">${escapeHtml(headcount)}</td></tr>
      </table>
      <hr style="border: none; border-top: 1px solid #eee; margin: 18px 0;" />
      <p style="font-size: 12px; color: #888; line-height: 1.5;">
        Submitted ${submittedAt}<br>
        Country: ${escapeHtml(country)}<br>
        IP: ${escapeHtml(ip)}<br>
        UA: ${escapeHtml(userAgent)}
      </p>
    </div>
  `;

  try {
    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [toEmail],
        reply_to: email,
        subject,
        text: textBody,
        html: htmlBody,
      }),
    });

    if (!resendRes.ok) {
      const detail = await resendRes.text().catch(() => "");
      console.error("Resend rejected:", resendRes.status, detail);
      return jsonResponse(502, { error: "Email delivery failed" }, origin);
    }

    return jsonResponse(200, { ok: true }, origin);
  } catch (err) {
    console.error("Resend error:", err && err.message);
    return jsonResponse(502, { error: "Email delivery failed" }, origin);
  }
}
