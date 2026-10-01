import { ImageResponse } from "next/og";
import { getStore } from "@/lib/store";
import { regionName, slugify } from "@/lib/util";

export const alt = "Pledge for your city's restaurants on Zood";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const dynamic = "force-dynamic";

export default async function Image({ params }: { params: Promise<{ city: string }> }) {
  const slug = slugify(decodeURIComponent((await params).city));
  const store = getStore();
  const [cities, reqs] = await Promise.all([store.listCities({ includeUnlisted: true }), store.listRequests({ kind: "restaurant", citySlug: slug, limit: 300 })]);
  const info = cities.find((c) => c.citySlug === slug);
  const name = info?.city ?? slug.replace(/-/g, " ");
  const pledges = reqs.reduce((n, r) => n + r.supportCount, 0);
  const sub = info ? regionName(info.country) : "";
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 64, color: "white", background: "linear-gradient(135deg, #e8531a 0%, #d6286a 60%, #9b2fae 100%)" }}>
        <div style={{ display: "flex", fontSize: 34, fontWeight: 700, letterSpacing: 2 }}>ZOOD  |  THE PINTEREST OF RESTAURANTS</div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 108, fontWeight: 800, lineHeight: 1.05 }}>{name}{sub ? `, ${sub}` : ""}</div>
          <div style={{ display: "flex", fontSize: 54, marginTop: 18, opacity: 0.95 }}>
            {pledges > 0 ? `${pledges} ${pledges === 1 ? "person has" : "people have"} pledged` : "Be the first to pledge"}
            {info ? `  ·  ${info.count} restaurants waiting` : ""}
          </div>
        </div>
        <div style={{ display: "flex", fontSize: 38, fontWeight: 700 }}>Pledge to order direct. No middleman.  zist.it.com</div>
      </div>
    ),
    { ...size },
  );
}
