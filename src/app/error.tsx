"use client";
import { useEffect } from "react";
import Page from "@/components/page";

// Shown when something unexpected fails while rendering a page. Never shows technical details to residents.
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <Page>
      <div className="empty">
        <div className="emoji" aria-hidden>😕</div>
        <h3>Something went wrong</h3>
        <p className="muted" style={{ margin: "0 auto 14px", maxWidth: 360 }}>It&apos;s on our side. Please try again in a moment.</p>
        <button onClick={reset} className="sm">Try again</button>
        {error.digest && <p className="muted small" style={{ marginTop: 14 }}>Reference: {error.digest}</p>}
      </div>
    </Page>
  );
}
