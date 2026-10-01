/**
 * Email opted-in users that Zist is live. DRY RUN unless --send is passed. Needs Firebase credentials.
 *
 *   npx tsx scripts/send-launch-email.ts                       # dry run: counts + a preview, sends nothing
 *   RESEND_API_KEY=... MAILING_ADDRESS="Zist, 1 Example St, Nairobi, Kenya" \
 *     npx tsx scripts/send-launch-email.ts --send --from "Zist <hello@zist.it.com>" --city nairobi [--limit 20]
 *
 * Safeguards: only users with optIn=true; one signed unsubscribe link per recipient (also sent as List-Unsubscribe);
 * a postal address is REQUIRED for --send (CAN-SPAM and similar laws); --city restricts to one city; always run a
 * dry run and then --limit 1 to your own address first. Sending uses Resend (your domain already has its DNS records).
 */
import { getStore } from "../lib/store";
import { unsubUrl } from "../lib/unsub";

const args = process.argv.slice(2);
const arg = (n: string) => (args.includes(n) ? args[args.indexOf(n) + 1] : undefined);
const send = args.includes("--send");
const city = arg("--city")?.toLowerCase();
const limit = Number(arg("--limit") ?? 0) || undefined;
const from = arg("--from");
const address = process.env.MAILING_ADDRESS;
const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://zist.it.com";

const subject = "Zist is live in your city";
const body = (handle: string, unsub: string) => `Hi ${handle},

You asked to hear when Zist launches. It's live: find restaurants that match your diet, compare grocery prices, see what the community wants added, and message restaurants on WhatsApp.

${SITE}

You're receiving this because you ticked "email me when Zist launches" when you signed up.
Unsubscribe: ${unsub}

${address ?? "[mailing address]"}
`;

(async () => {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT) throw new Error("Set FIREBASE_SERVICE_ACCOUNT.");
  let ps = (await getStore().listProfiles(50000)).filter((p) => p.optIn && p.email);
  if (city) ps = ps.filter((p) => (p.city ?? "").toLowerCase() === city);
  if (limit) ps = ps.slice(0, limit);
  console.log(`${ps.length} opted-in recipient(s)${city ? ` in ${city}` : ""}${limit ? ` (limited to ${limit})` : ""}.`);
  console.log("\n--- preview ---\n" + `Subject: ${subject}\n\n` + body("example_user", "<signed unsubscribe link>"));
  if (!send) return console.log("DRY RUN: nothing was sent. Add --send to send.");
  if (!process.env.RESEND_API_KEY || !from || !address) throw new Error("--send needs RESEND_API_KEY, --from and MAILING_ADDRESS.");

  let sent = 0, failed = 0;
  for (const p of ps) {
    const unsub = unsubUrl(p.uid);
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [p.email], subject, text: body(p.username || "there", unsub), headers: { "List-Unsubscribe": `<${unsub}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" } }),
    });
    if (res.ok) sent++; else { failed++; console.error("failed:", res.status, (await res.text()).slice(0, 120)); }
    await new Promise((r) => setTimeout(r, 250)); // stay under rate limits
  }
  console.log(`sent ${sent}, failed ${failed}`);
})().catch((e) => { console.error(e.message); process.exit(1); });
