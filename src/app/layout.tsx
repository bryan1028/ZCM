import "./globals.css";

export const metadata = { title: "Zist Community Marketplace", description: "A closed marketplace for your estate" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head><meta name="theme-color" content="#2f7d4f" /><meta name="viewport" content="width=device-width, initial-scale=1" /></head>
      <body><main>{children}</main></body>
    </html>
  );
}
