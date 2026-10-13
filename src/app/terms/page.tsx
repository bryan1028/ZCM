import Link from "next/link";
import Page from "@/components/page";

export const metadata = { title: "Terms of Use" };
export default function Terms() {
  return (
    <Page>
      <h1>Terms of Use</h1>
      <p className="muted small">Last updated: October 2026</p>
      <div className="stack" style={{ lineHeight: 1.6 }}>
        <p>These terms apply to Zist Community Marketplaces (&ldquo;Zist&rdquo;, &ldquo;we&rdquo;), which runs this app. By requesting access or using it you agree to these terms and to our <Link href="/privacy">Privacy Policy</Link>.</p>

        <h3>Who can use it</h3>
        <p>Adults (18+) who really live in the community they join. An admin verifies each member. Giving false residency details can lead to removal.</p>

        <h3>What this service is</h3>
        <p>A noticeboard that helps neighbours find services and goods. Deals are made <b>directly between neighbours</b>. We don&apos;t sell anything, we don&apos;t handle your money, and we are not a party to any deal. Please check goods and workers yourself and take sensible precautions, especially with services done at your home.</p>

        <h3>Services and products</h3>
        <ul>
          <li><b>Services</b> (a gardener, a cleaner, a handyman) are arranged by chat. Message the person, agree the details, and pay them directly once the work is done. Nothing is paid through the app, and you should not pay for a service before it has been done.</li>
          <li><b>Products</b> can be reserved in the app. The buyer pays the seller directly (for example by M-Pesa) and uploads a payment-proof screenshot, and the seller confirms they received it. That screenshot is only a record shared between buyer and seller. It is not a guarantee of payment or of quality.</li>
          <li>The listed price is the price. If a buyer and seller ever agree something different between themselves, that is up to them, and the seller confirms the payment they actually receive.</li>
        </ul>

        <h3>Your content and behaviour</h3>
        <ul>
          <li>Post only things you are allowed to sell or offer, described honestly, with real prices.</li>
          <li>No illegal, dangerous, counterfeit or adult items, no scams, spam, harassment or hate.</li>
          <li>Reviews must be your genuine experience. You can review a product after you have completed an order for it, and a service after you have been in touch with the seller and used it. Don&apos;t review your own listings or trade reviews.</li>
          <li>You keep ownership of what you post, and give us permission to show it to the other members of your community.</li>
        </ul>

        <h3>Moderation</h3>
        <p>Each community is looked after by its own admins, who verify residents and can remove content and suspend or restrict accounts that break these rules or put others at risk. You can report content and members from inside the app. Day to day, questions and disputes are handled by your community admin.</p>

        <h3>No guarantees</h3>
        <p>The service is provided as it is, without promises that it will always be available or error-free. To the extent the law allows, we are not responsible for losses from deals between members or for content posted by members.</p>

        <h3>Leaving</h3>
        <p>You can delete your account any time from <Link href="/account">Your account</Link>. We may update these terms and will change the date above when we do. These terms are governed by the laws of Kenya.</p>
        <p>Questions? Ask your community admin.</p>
      </div>
    </Page>
  );
}
