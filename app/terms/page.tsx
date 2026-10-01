import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Terms of service" };

export default function Terms() {
  return (
    <article className="legal">
      <h1>Terms of service</h1>
      <p className="meta">Effective 1 October 2026.</p>

      <h2>Using Zist</h2>
      <p>Zist helps you find restaurants and stores, compare prices, and contact restaurants. By using it you agree to these terms. Please use it lawfully and respectfully.</p>

      <h2>Allergen and menu information</h2>
      <p><b>Menu, diet and allergen details are supplied by restaurants and community members and may be wrong or out of date. Zist does not verify them.</b> If you have a food allergy or medical dietary need, always confirm with the restaurant before ordering. Do not rely on Zist alone.</p>

      <h2>Prices and deals</h2>
      <p>Prices and deals are reported by shoppers or added by us and can change at any time. Check the shelf tag or the store.</p>

      <h2>Messaging restaurants</h2>
      <p>The Message button opens WhatsApp so you can talk to a restaurant directly. That conversation, any order and any payment is between you and the restaurant. We are not a party to it and are not responsible for the restaurant's food, service or replies.</p>

      <h2>Your content</h2>
      <p>You are responsible for what you add (requests, prices, notes). Only add accurate information. Your username is shown publicly with it. You give us permission to display it on Zist. Do not post spam, abuse, other people's personal data, or anything unlawful. We may remove content or suspend accounts that break these rules.</p>

      <h2>Your account</h2>
      <p>Keep your password safe. You can delete your account at any time from your account page.</p>

      <h2>No guarantees</h2>
      <p>Zist is provided "as is" and "as available". To the extent the law allows, we are not liable for losses arising from your use of Zist or from reliance on information on it. Nothing here limits rights you have under the law that cannot be limited.</p>

      <h2>Changes and contact</h2>
      <p>We may update these terms and will post the new date. Questions: <Link href="/support">Support</Link>. See also our <Link href="/privacy">Privacy policy</Link>.</p>
    </article>
  );
}
