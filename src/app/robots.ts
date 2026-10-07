import type { MetadataRoute } from "next";

// A closed, resident-only marketplace: keep every page out of search engines.
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", disallow: "/" } };
}
