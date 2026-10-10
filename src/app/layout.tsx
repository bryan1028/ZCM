import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Zist Community Marketplace", template: "%s · Zist" },
  description: "A closed marketplace for your estate: trusted services and local goods from verified neighbours.",
  applicationName: "Zist",
  robots: { index: false, follow: false },   // closed community: never list in search engines
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fff3e3" },
    { media: "(prefers-color-scheme: dark)", color: "#1f140d" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
