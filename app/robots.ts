import type { MetadataRoute } from "next";
export default function robots(): MetadataRoute.Robots {
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "https://zist.it.com";
  return { rules: { userAgent: "*", allow: "/", disallow: ["/go/", "/admin", "/api/"] }, sitemap: `${site}/sitemap.xml` };
}
