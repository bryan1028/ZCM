import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

const DAYS = 30;

export default async function Dashboard({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: seller } = await supabase.from("sellers").select("id, account_type, plan, communities!inner(slug)")
    .eq("communities.slug", slug).eq("user_id", user!.id).maybeSingle();
  if (!seller) return <div className="card">Start selling to unlock your dashboard. <Link href={`/c/${slug}/sell`}>Create a listing</Link></div>;

  const { data: limits } = await supabase.from("plan_limits").select("*").eq("account_type", seller.account_type).eq("plan", seller.plan).single();
  const full = !!limits?.can_see_analytics;

  const since = new Date(Date.now() - DAYS * 86400000).toISOString().slice(0, 10);
  const { data: listings } = await supabase.from("listings").select("id, title, status").eq("seller_id", seller.id).neq("status", "removed");
  const ids = (listings ?? []).map((l) => l.id);
  const [{ data: views }, { data: orders }, { data: rating }] = await Promise.all([
    ids.length ? supabase.from("listing_views").select("listing_id, viewer_id, day").in("listing_id", ids).gte("day", since) : Promise.resolve({ data: [] }),
    ids.length ? supabase.from("reservations").select("listing_id, status, quantity, unit_price_cents").in("listing_id", ids) : Promise.resolve({ data: [] }),
    supabase.from("seller_ratings").select("avg_rating, review_count").eq("seller_id", seller.id).maybeSingle(),
  ]);

  const totalViews = (views ?? []).length;
  const uniqueViewers = new Set((views ?? []).map((v) => v.viewer_id)).size;
  const count = (st: string[]) => (orders ?? []).filter((o) => st.includes(o.status)).length;
  const requests = (orders ?? []).length, completed = count(["completed"]);
  const revenue = (orders ?? []).filter((o) => o.status === "completed")
    .reduce((sum, o) => sum + (o.unit_price_cents ?? 0) * o.quantity, 0);

  const header = (
    <div className="row"><h2>Dashboard</h2><span className="badge">{seller.account_type} · {seller.plan}</span></div>
  );
  const tile = (label: string, value: string | number) => (
    <div className="card" style={{ flex: 1, minWidth: 120, textAlign: "center" }}>
      <div style={{ fontSize: 26, fontWeight: 700 }}>{value}</div><div className="muted">{label}</div>
    </div>
  );

  if (!full) {
    return (
      <>
        {header}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {tile(`views (${DAYS}d)`, totalViews)}{tile("requests", requests)}
        </div>
        <div className="card">
          <strong>Unlock the full dashboard with Business Pro</strong>
          <ul className="muted">
            <li>Daily views chart and unique neighbours reached</li>
            <li>Request → paid → completed funnel and conversion</li>
            <li>Top listings and sales recorded</li>
            <li>Feature your listings at the top of the feed</li>
            <li>Unlimited listings and more photos</li>
          </ul>
          <p className="muted">Ask your community admin to upgrade your account.</p>
        </div>
      </>
    );
  }

  const perDay = new Map<string, number>();
  for (let i = DAYS - 1; i >= 0; i--) perDay.set(new Date(Date.now() - i * 86400000).toISOString().slice(0, 10), 0);
  (views ?? []).forEach((v) => perDay.set(v.day, (perDay.get(v.day) ?? 0) + 1));
  const series = [...perDay.entries()];
  const max = Math.max(1, ...series.map(([, n]) => n));

  const per = new Map<string, { views: number; requests: number; done: number }>();
  (listings ?? []).forEach((l) => per.set(l.id, { views: 0, requests: 0, done: 0 }));
  (views ?? []).forEach((v) => { per.get(v.listing_id)!.views++; });
  (orders ?? []).forEach((o) => { const p = per.get(o.listing_id)!; p.requests++; if (o.status === "completed") p.done++; });
  const top = (listings ?? []).map((l) => ({ ...l, ...per.get(l.id)! })).sort((a, b) => b.views - a.views).slice(0, 8);

  const funnel: [string, number][] = [
    ["Requested", requests], ["Accepted or later", count(["accepted", "paid", "completed"])],
    ["Payment proof sent", count(["paid", "completed"])], ["Completed", completed],
  ];

  return (
    <>
      {header}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {tile(`views (${DAYS}d)`, totalViews)}{tile("neighbours reached", uniqueViewers)}
        {tile("completed orders", completed)}{tile("sales recorded (KES)", (revenue / 100).toLocaleString())}
        {tile("rating", rating ? `★ ${rating.avg_rating} (${rating.review_count})` : "—")}
      </div>

      <div className="card">
        <strong>Views per day</strong>
        <svg viewBox={`0 0 ${DAYS * 10} 80`} width="100%" role="img" aria-label="Views per day over the last 30 days" style={{ marginTop: 8 }}>
          {series.map(([day, n], i) => (
            <rect key={day} x={i * 10 + 1} width={8} y={70 - (n / max) * 66} height={Math.max(1, (n / max) * 66)} rx={1}
              fill="var(--accent)" opacity={n ? 1 : 0.25}><title>{day}: {n}</title></rect>
          ))}
          <line x1="0" x2={DAYS * 10} y1="71" y2="71" stroke="var(--line)" />
        </svg>
        <div className="row muted"><span>{series[0][0]}</span><span>peak {max}/day</span><span>{series[series.length - 1][0]}</span></div>
      </div>

      <div className="card">
        <strong>From interest to sale</strong>
        {funnel.map(([label, n]) => (
          <div key={label} style={{ marginTop: 8 }}>
            <div className="row"><span>{label}</span><strong>{n}</strong></div>
            <div style={{ background: "var(--line)", borderRadius: 4, height: 8 }}>
              <div style={{ background: "var(--accent)", width: `${requests ? (n / requests) * 100 : 0}%`, height: 8, borderRadius: 4 }} />
            </div>
          </div>
        ))}
        {totalViews > 0 && <p className="muted">{((requests / totalViews) * 100).toFixed(1)}% of views turned into a request.</p>}
      </div>

      <div className="card">
        <strong>Top listings</strong>
        {top.map((l) => (
          <div className="row" key={l.id} style={{ marginTop: 6 }}>
            <Link href={`/c/${slug}/l/${l.id}`}>{l.title}</Link>
            <span className="muted">{l.views} views · {l.requests} requests · {l.done} sold</span>
          </div>
        ))}
      </div>
    </>
  );
}
