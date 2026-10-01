import type { MetadataRoute } from "next";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "https://zist.it.com";
  const cities = await getStore().listCities();
  return [
    { url: site },
    { url: `${site}/find` },
    { url: `${site}/deals` },
    { url: `${site}/requests` },
    { url: `${site}/privacy` },
    { url: `${site}/terms` },
    { url: `${site}/support` },
    ...cities.map((c) => ({ url: `${site}/c/${c.country.toLowerCase()}/${c.citySlug}` })),
  ];
}
