import { ImageResponse } from "next/og";
import { getStore } from "@/lib/store";
import { regionName } from "@/lib/util";
import { wantedKey } from "@/lib/wanted";

export const alt = "Restaurant on Zood";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const dynamic = "force-dynamic";

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const store = getStore();
  const r = await store.getRestaurant(id);
  const unclaimed = r?.status === "unclaimed";
  const n = r && unclaimed ? ((await store.listRequests({ kind: "restaurant", citySlug: r.citySlug, limit: 300 })).find((x) => x.id === wantedKey(r))?.supportCount ?? 0) : 0;
  const line = !r ? "Zood" : unclaimed ? (n > 0 ? `${n} ${n === 1 ? "person wants" : "people want"} this on Zood` : "Pledge to order from here on Zood") : "Order directly. No middleman.";
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 64, color: "white", background: "linear-gradient(135deg, #e8531a 0%, #d6286a 60%, #9b2fae 100%)" }}>
        <div style={{ display: "flex", fontSize: 34, fontWeight: 700, letterSpacing: 2 }}>ZOOD  |  THE PINTEREST OF RESTAURANTS</div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: r && r.name.length > 28 ? 80 : 100, fontWeight: 800, lineHeight: 1.05 }}>{r?.name ?? "Zood"}</div>
          {r && <div style={{ display: "flex", fontSize: 44, marginTop: 14, opacity: 0.95 }}>{r.city}, {regionName(r.country)}</div>}
          <div style={{ display: "flex", fontSize: 52, marginTop: 26, fontWeight: 700 }}>{line}</div>
        </div>
        <div style={{ display: "flex", fontSize: 38, fontWeight: 700 }}>zist.it.com</div>
      </div>
    ),
    { ...size },
  );
}
