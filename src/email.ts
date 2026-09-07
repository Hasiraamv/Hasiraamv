import type { Bindings } from "./types";

/**
 * Sends transactional email via Resend (https://resend.com). Free tier is
 * enough for password-reset volume; requires RESEND_API_KEY set as a
 * Worker secret and a verified FROM_EMAIL sender domain.
 */
export async function sendEmail(
  env: Bindings,
  { to, subject, html }: { to: string; subject: string; html: string }
): Promise<void> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: env.FROM_EMAIL, to, subject, html }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Resend request failed (${res.status}): ${body}`);
  }
}
