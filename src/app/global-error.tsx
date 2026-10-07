"use client";

// Last-resort fallback if the root layout itself fails; it can't rely on the app's stylesheet.
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#f6f5f0", color: "#15221b", display: "grid", placeItems: "center", minHeight: "100vh" }}>
        <div style={{ textAlign: "center", padding: 24 }}>
          <h1 style={{ fontSize: 22 }}>Something went wrong</h1>
          <p style={{ color: "#5b6862" }}>Please try again in a moment.</p>
          <button onClick={reset} style={{ font: "inherit", fontWeight: 650, padding: "12px 20px", borderRadius: 12, border: 0, background: "#1d7a4c", color: "#fff", cursor: "pointer" }}>Try again</button>
        </div>
      </body>
    </html>
  );
}
