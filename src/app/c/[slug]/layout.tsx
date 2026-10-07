import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { KINDS } from "@/lib/catalog";

// The gate: nothing under /c/[slug] renders unless the user is a verified member.
// (RLS enforces the same rule in the database; this is just the friendly redirect.)
export default async function CommunityLayout({ children, params }: { children: React.ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: me } = await supabase.from("profiles").select("username").eq("id", user.id).maybeSingle();
  if (!me?.username) redirect(`/welcome?next=/c/${slug}`);
  const { data: community } = await supabase.from("communities").select("id, name").eq("slug", slug).maybeSingle();
  if (!community) notFound();
  const { data: m } = await supabase
    .from("memberships").select("status, role").eq("community_id", community.id).eq("user_id", user.id).maybeSingle();
  if (m?.status !== "verified") redirect("/");

  const { count: unread } = await supabase.from("messages").select("id", { count: "exact", head: true })
    .is("read_at", null).neq("sender_id", user.id);

  const { count: unreadNotifs } = await supabase.from("notifications").select("id", { count: "exact", head: true })
    .eq("user_id", user.id).eq("community_id", community.id).is("read_at", null);
  const { count: openOrders } = await supabase.from("reservations").select("id", { count: "exact", head: true })
    .eq("seller_user_id", user.id).eq("status", "requested");

  return (
    <>
      <div className="row">
        <h1>{community.name}</h1>
        <span>
          <Link href={`/c/${slug}/notifications`}>🔔{unreadNotifs ? ` ${unreadNotifs}` : ""}</Link> · <Link href={`/c/${slug}/inbox`}>Inbox{unread ? ` (${unread})` : ""}</Link> · <Link href={`/c/${slug}/orders`}>Orders{openOrders ? ` (${openOrders})` : ""}</Link> · <Link href={`/c/${slug}/mine`}>My listings</Link> · <Link href={`/c/${slug}/sell`}>Sell</Link>
          {m.role === "admin" && <> · <Link href={`/c/${slug}/admin`}>Admin</Link></>}
        </span>
      </div>
      <nav className="tabs">
        <Link href={`/c/${slug}`}>Feed</Link>
        {Object.entries(KINDS).map(([k, v]) => <Link key={k} href={`/c/${slug}/${k}`}>{v.label}</Link>)}
      </nav>
      {children}
    </>
  );
}
