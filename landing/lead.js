/**
 * Floodlight — lead capture endpoint
 *
 * Receives audit sign-up form submissions from the landing page, validates
 * the payload, and emails it to the team inbox via Resend.
 *
 * Required environment variables (set in Vercel dashboard):
 *   RESEND_API_KEY  — from https://resend.com/api-keys
 *   LEAD_TO_EMAIL   — the inbox to forward leads to (e.g. hello@floodlightsecurity.co)
 *   LEAD_FROM_EMAIL — must be a verified sender on Resend (e.g. leads@floodlightsecurity.co)
 *
 * To deploy on Vercel, place this file at api/lead.js in the project root.
 */

const ALLOWED_ORIGINS = [
  "https://floodlightsecurity.co",
  "https://www.floodlightsecurity.co",
  "http://localhost:3000",
  "http://localhost:8080",
];

const HEADCOUNT_VALID = new Set([
  "1-49", "50-199", "200-499", "500-999", "1000+",
]);

// Block obvious freemail domains for "work email" — we want B2B leads
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

export default async function handler(req, res) {
  // CORS
  const origin = req.headers.origin || "";
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Parse body. Vercel auto-parses JSON when Content-Type is application/json.
  const body = typeof req.body === "object" && req.body !== null ? req.body : {};

  // Honeypot — a hidden field on the form (added later if spam becomes a problem).
  // For now, just check it's not present and non-empty.
  if (body.website) {
    // Bot — pretend success to avoid signal
    return res.status(200).json({ ok: true });
  }

  const name = sanitiseString(body.name, 100);
  const email = sanitiseString(body.email, 254).toLowerCase();
  const company = sanitiseString(body.company, 200);
  const headcount = sanitiseString(body.headcount, 16);

  // Validation
  const errors = [];
  if (!name || name.length < 2) errors.push("name");
  if (!email || !validEmail(email)) errors.push("email");
  if (!company || company.length < 2) errors.push("company");
  if (!HEADCOUNT_VALID.has(headcount)) errors.push("headcount");

  if (errors.length > 0) {
    return res.status(400).json({ error: "Invalid fields", fields: errors });
  }

  // Soft-warn freemail (still accept — sometimes founders use personal emails)
  const isFreemail = freemailDomain(email);

  // Check env config
  const apiKey = process.env.RESEND_API_KEY;
  const toEmail = process.env.LEAD_TO_EMAIL;
  const fromEmail = process.env.LEAD_FROM_EMAIL;
  if (!apiKey || !toEmail || !fromEmail) {
    console.error("Missing RESEND_API_KEY / LEAD_TO_EMAIL / LEAD_FROM_EMAIL");
    return res.status(500).json({ error: "Server misconfigured" });
  }

  const submittedAt = new Date().toISOString();
  const userAgent = req.headers["user-agent"] || "unknown";
  const ip = req.headers["x-forwarded-for"] || req.headers["x-real-ip"] || "unknown";

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
      return res.status(502).json({ error: "Email delivery failed" });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("Resend error:", err);
    return res.status(502).json({ error: "Email delivery failed" });
  }
}
