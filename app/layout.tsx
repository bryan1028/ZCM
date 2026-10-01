import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { AuthNav } from "./auth-nav";

const site = process.env.NEXT_PUBLIC_SITE_URL ?? "https://zist.it.com";

export const metadata: Metadata = {
  metadataBase: new URL(site),
  title: { default: "Zist — Restaurants that match what you actually eat", template: "%s · Zist" },
  description: "Find restaurants near you that match your diet and allergies, see their menus, and message them on WhatsApp.",
  openGraph: { siteName: "Zist", type: "website" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600&family=Playfair+Display:wght@700;800&display=swap" rel="stylesheet" />
      </head>
      <body>
        <header className="site">
          <div className="wrap">
            <Link href="/" className="logo">Zist</Link>
            <nav>
              <Link href="/">Food</Link>
              <Link href="/find">Prices</Link>
              <Link href="/deals">Deals</Link>
              <Link href="/requests">Requests</Link>
              <AuthNav />
              <Link href="/list">List your restaurant</Link>
            </nav>
          </div>
        </header>
        <main className="wrap">{children}</main>
        <footer className="site">
          <div className="wrap">
            Menu and allergen details are provided by restaurants and may be out of date. If you have a severe allergy, always confirm with the restaurant before ordering.
            <br />Some restaurant locations © OpenStreetMap contributors. Some prices from Open Food Facts contributors (Open Prices).
          </div>
        </footer>
      </body>
    </html>
  );
}
