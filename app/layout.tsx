import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { AuthNav } from "./auth-nav";

const site = process.env.NEXT_PUBLIC_SITE_URL ?? "https://zist.it.com";

export const metadata: Metadata = {
  metadataBase: new URL(site),
  title: { default: "Zist — Zood finds the food, Zind finds the price", template: "%s · Zist" },
  description: "Zood finds the dish you're craving and messages the restaurant for you. Zind finds what anything costs at every store. Anywhere in the world.",
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
              <span className="pillnav"><Link href="/" className="zood">🍜 Zood</Link><Link href="/find" className="zind">🔎 Zind</Link></span>
              <Link href="/deals">Deals</Link>
              <Link href="/requests">Zummon</Link>
              <AuthNav />
            </nav>
          </div>
        </header>
        <main className="wrap">{children}</main>
        <footer className="site">
          <div className="wrap">
            Menu and allergen details are provided by restaurants and may be out of date. If you have a severe allergy, always confirm with the restaurant before ordering.
            <br />Zood and Zind are made by Zist. <br /><Link href="/about">About</Link><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link><Link href="/support">Support</Link><br />Some restaurant listings from Overture Maps (© Overture Maps Foundation and its data sources, CDLA-Permissive-2.0) and © OpenStreetMap contributors. Some prices from Open Food Facts contributors (Open Prices).
          </div>
        </footer>
      </body>
    </html>
  );
}
