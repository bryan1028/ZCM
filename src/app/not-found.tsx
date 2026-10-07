import Link from "next/link";
import Page from "@/components/page";

export default function NotFound() {
  return (
    <Page>
      <div className="empty">
        <div className="emoji" aria-hidden>🧭</div>
        <h3>We couldn&apos;t find that page</h3>
        <p className="muted" style={{ margin: "0 auto 14px", maxWidth: 360 }}>The link may be old, or the listing may have been removed.</p>
        <Link href="/" className="btn sm">Back to home</Link>
      </div>
    </Page>
  );
}
