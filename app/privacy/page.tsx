import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Privacy policy", description: "What Zist collects, why, who we share it with, and how to delete it." };

export default function Privacy() {
  return (
    <article className="legal">
      <h1>Privacy policy</h1>
      <p className="meta">Effective 1 October 2026. Zist ("we") runs zist.it.com and the Zist app in ChatGPT.</p>

      <h2>What we collect</h2>
      <ul>
        <li><b>Account details</b> if you sign up: email, username (your public signature), and your password, which is handled by Google Firebase Authentication. We never see or store your password in readable form.</li>
        <li><b>Profile preferences</b> you choose to add: city and country, diets (for example vegan or halal), and allergies. Diet and allergy information can be sensitive. It is optional, used to personalise your experience, and never shared with restaurants or sold.</li>
        <li><b>Things you add</b>: places you request or back, prices you report, and people you follow. These show publicly with your username.</li>
        <li><b>Message taps</b>: when you tap "Message" we record the restaurant, the time, where you came from (website or ChatGPT), your username if you are signed in, and a random visitor ID in a cookie. We do not see your WhatsApp conversation. Restaurants receive your message directly from you on WhatsApp, which shows them your phone number.</li>
        <li><b>Messages to support</b>: your email and what you write.</li>
        <li><b>Email opt-in</b>: whether you agreed to launch emails. It is off unless you tick it.</li>
      </ul>

      <h2>The Zist app in ChatGPT</h2>
      <p>When you use Zist inside ChatGPT, ChatGPT sends our server only what a search needs: a city or country, diet filters, and a cuisine, dish or product name. We use these only to return results and <b>do not store or log them</b> in our database or application logs (our hosting provider keeps standard request logs, which do not include the search text). We do not receive your conversation, your name or your location beyond the city you mention. Your use of ChatGPT is governed by OpenAI's own policies.</p>

      <h2>Cookies</h2>
      <p>We use only essential cookies: a sign-in session cookie, a random visitor ID and a short per-restaurant cookie that stop repeat taps being counted twice, and a daily counter that limits spam reports. We do not use advertising or analytics cookies. Pages load fonts from Google Fonts, which means Google receives your IP address.</p>

      <h2>How we use it</h2>
      <p>To run the service (search, accounts, requests, price comparison), to count how many people ask to reach each restaurant so we can show restaurants the demand, to prevent abuse, and, only if you opted in, to email you when Zist launches in your area or about places you asked for. Every email has an unsubscribe link.</p>

      <h2>Who we share it with</h2>
      <ul>
        <li><b>Service providers</b> that process data for us: Google (Firebase Authentication and Firestore database) and Netlify (hosting). If we send announcements we will use an email provider for that purpose only.</li>
        <li><b>Restaurants and stores</b> see aggregate counts such as how many people asked to reach them, not who you are, unless you message them yourself.</li>
        <li>We do not sell personal data.</li>
      </ul>

      <h2>Keeping and deleting your data</h2>
      <p>We keep your account until you delete it. Sign in and choose <b>Delete my account</b> on your account page: this removes your login, profile, username and follows, and strips your identity from your message taps, price reports, requests and backings (the requests, prices and counts stay, signed as "former member"). You can also ask us at <Link href="/support">Support</Link>. Copies held by our providers (for example in backups or standard server logs) may persist for a limited time before they are overwritten.</p>

      <h2>Your choices</h2>
      <p>You can edit or remove your diet, allergy and city details, and change your email opt-in, on your account page at any time. Depending on where you live you may have rights to access, correct or delete your data or to object to how we use it. Use <Link href="/support">Support</Link> to exercise them.</p>

      <h2>Children</h2>
      <p>Zist is not directed to children under 16 and we do not knowingly collect their data.</p>

      <h2>Changes and contact</h2>
      <p>We will post changes here and update the date above. Questions: <Link href="/support">Support</Link>.</p>
    </article>
  );
}
