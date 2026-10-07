import Link from "next/link";
import Page from "@/components/page";

export const metadata = { title: "Terms of Use" };
const contact = process.env.NEXT_PUBLIC_SUPPORT_EMAIL;

export default function Terms() {
  return (
    <Page>
      <h1>Terms of Use</h1>
      <p className="muted small">Last updated: October 2026</p>
      <div className="stack" style={{ lineHeight: 1.6 }}>
        <p>By requesting access or using Zist Community Marketplace you agree to these terms and to our <Link href="/privacy">Privacy Policy</Link>.</p>

        <h3>Who can use it</h3>
        <p>Adults (18+) who really live in the community they join. An admin verifies each member. Giving false residency details can lead to removal.</p>

        <h3>What this service is</h3>
        <p>A noticeboard that helps neighbours find services and goods. Deals are made <b>directly between neighbours</b>. We don&apos;t sell anything, we don&apos;t handle your money, and we are not a party to any deal. A payment-proof screenshot is only a record shared between buyer and seller. It is not a guarantee of payment or of quality. Please check goods and workers yourself and take sensible precautions, especially with services done at your home.</p>

        <h3>Your content and behaviour</h3>
        <ul>
          <li>Post only things you are allowed to sell or offer, described honestly, with real prices.</li>
          <li>No illegal, dangerous, counterfeit or adult items, no scams, spam, harassment or hate.</li>
          <li>Reviews must be your genuine experience. Don&apos;t review your own listings or trade reviews.</li>
          <li>You keep ownership of what you post, and give us permission to show it to the other members of your community.</li>
        </ul>

        <h3>Moderation</h3>
        <p>Admins can remove content and suspend or restrict accounts that break these rules or put others at risk. You can report content and members from inside the app.</p>

        <h3>No guarantees</h3>
        <p>The service is provided as it is, without promises that it will always be available or error-free. To the extent the law allows, we are not responsible for losses from deals between members or for content posted by members.</p>

        <h3>Leaving</h3>
        <p>You can delete your account any time from <Link href="/account">Your account</Link>. We may update these terms and will change the date above when we do. These terms are governed by the laws of Kenya.</p>
        <p>{contact ? <>Questions? Email <a href={`mailto:${contact}`}>{contact}</a> or ask your community admin.</> : <>Questions? Ask your community admin.</>}</p>
      </div>
    </Page>
  );
}
