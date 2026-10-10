import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CommunityNav from "@/components/community-nav";
import { getCommunity } from "@/lib/community";
import { getUser } from "@/lib/auth";

async function signOut() {
  "use server";
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

// The gate: nothing under /c/[slug] renders unless the user is a verified member.
// (RLS enforces the same rule in the database; this is just the friendly redirect.)
export default async function CommunityLayout({ children, params }: { children: React.ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: { user } } = await getUser(supabase);
  if (!user) redirect("/login");
  // Two rounds of parallel queries instead of six in a row: each round trip to the database costs real time.
  const [{ data: me }, community, { count: unreadMessages }, { count: openOrders }] = await Promise.all([
    supabase.from("profiles").select("username").eq("id", user.id).maybeSingle(),
    getCommunity(slug),
    supabase.from("messages").select("id", { count: "exact", head: true }).is("read_at", null).neq("sender_id", user.id),
    supabase.from("reservations").select("id", { count: "exact", head: true }).eq("seller_user_id", user.id).eq("status", "requested"),
  ]);
  if (!me?.username) redirect(`/welcome?next=/c/${slug}`);
  if (!community) notFound();
  const [{ data: m }, { count: unreadNotifications }] = await Promise.all([
    supabase.from("memberships").select("status, role").eq("community_id", community.id).eq("user_id", user.id).maybeSingle(),
    supabase.from("notifications").select("id", { count: "exact", head: true })
      .eq("user_id", user.id).eq("community_id", community.id).is("read_at", null),
  ]);
  if (m?.status !== "verified") redirect("/");

  return (
    <>
      <CommunityNav
        slug={slug} communityName={community.name} username={me.username} isAdmin={m.role === "admin"}
        unreadMessages={unreadMessages ?? 0} unreadNotifications={unreadNotifications ?? 0} openOrders={openOrders ?? 0}
        signOut={signOut}
      />
      <main>{children}</main>
    </>
  );
}
