import Link from "next/link";
import Page from "@/components/page";

export const metadata = { title: "Privacy Policy" };
export default function Privacy() {
  return (
    <Page>
      <h1>Privacy Policy</h1>
      <p className="muted small">Last updated: October 2026</p>
      <div className="stack" style={{ lineHeight: 1.6 }}>
        <p>Zist Community Marketplaces (&ldquo;Zist&rdquo;, &ldquo;we&rdquo;) runs this app, a private marketplace for residents of a single estate, and is responsible for the personal data described here. This page explains what we collect, who can see it and the choices you have.</p>

        <h3>What we collect</h3>
        <ul>
          <li><b>Account:</b> your email address, the username you choose, and (optionally) your name.</li>
          <li><b>Residency:</b> your house or apartment number and any note you add so an admin can verify you live here.</li>
          <li><b>What you post:</b> listings, photos, videos, prices, reviews and WhatsApp number if you add one.</li>
          <li><b>Activity:</b> chats with neighbours, orders and the payment-proof screenshots you upload, notifications, and simple counts of how many neighbours viewed a listing.</li>
          <li><b>Device:</b> a push-notification address, only if you turn push notifications on.</li>
        </ul>

        <h3>Who can see what</h3>
        <ul>
          <li><b>Neighbours</b> (verified residents of your community) see your username, listings, photos and reviews. They never see your email, name or phone number, unless you put a WhatsApp number on a listing.</li>
          <li><b>Community admins</b> can see your name, username, unit number and verification note, and reports about content.</li>
          <li><b>Chats</b> are visible only to the two people in them. <b>Payment proof</b> is visible only to the buyer and the seller of that order.</li>
          <li>We do not sell your data and we do not show advertising.</li>
        </ul>

        <h3>Why we use it</h3>
        <p>To run the marketplace, confirm that members really live in the community, keep people safe (moderation, reports), send you notifications you asked for, and understand basic usage.</p>

        <h3>Services that help us run this, and where your data goes</h3>
        <p>Your data is processed on our behalf by these providers. They are all outside Kenya, so your data is transferred abroad when you use the app:</p>
        <ul>
          <li><b>Supabase</b> stores the database, sign-in and your files (photos, videos, payment proofs). These are held in the European Union (Frankfurt).</li>
          <li><b>Netlify</b> hosts the website. Pages and actions are processed on its servers, which are in the United States, so your requests and the data they carry pass through there on their way to the database.</li>
          <li><b>Resend</b> sends the sign-in code emails, so it sees your email address.</li>
          <li><b>Cloudflare</b> manages our web domain&apos;s DNS records. It does not see what you do in the app.</li>
          <li><b>Your phone&apos;s push service</b> (Apple, Google or Mozilla, depending on your device) delivers notifications, only if you turn push notifications on.</li>
        </ul>

        <h3>How long we keep it</h3>
        <p>For as long as you have an account. When you delete your account (from <Link href="/account">Your account</Link>) your profile, listings, photos, reviews, orders and messages are permanently removed straight away. If we ever turn on backups, copies would disappear within about 30 days.</p>

        <h3>Your choices and rights</h3>
        <ul>
          <li><b>Access and portability:</b> download your data from <Link href="/account">Your account</Link>.</li>
          <li><b>Correction:</b> you can edit your listings and profile details; ask an admin to fix anything else.</li>
          <li><b>Deletion:</b> delete your account yourself at any time.</li>
          <li>You can also ask questions, object to how we use your data, or complain to the Office of the Data Protection Commissioner (Kenya).</li>
        </ul>

        <h3>Security and children</h3>
        <p>Access to your data is restricted by strict database rules, connections are encrypted, and files are private to your community. No system is perfectly secure, so please use the app responsibly. This service is for adults (18+).</p>

        <h3>Changes and contact</h3>
        <p>We may update this policy and will change the date above when we do.{" "}
          Questions or complaints? Ask your community admin.</p>
        <p><Link href="/terms">Terms of Use →</Link></p>
      </div>
    </Page>
  );
}
