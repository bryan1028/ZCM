import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CommunityNav from "@/components/community-nav";

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
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: me } = await supabase.from("profiles").select("username").eq("id", user.id).maybeSingle();
  if (!me?.username) redirect(`/welcome?next=/c/${slug}`);
  const { data: community } = await supabase.from("communities").select("id, name").eq("slug", slug).maybeSingle();
  if (!community) notFound();
  const { data: m } = await supabase
    .from("memberships").select("status, role").eq("community_id", community.id).eq("user_id", user.id).maybeSingle();
  if (m?.status !== "verified") redirect("/");

  const [{ count: unreadMessages }, { count: unreadNotifications }, { count: openOrders }] = await Promise.all([
    supabase.from("messages").select("id", { count: "exact", head: true }).is("read_at", null).neq("sender_id", user.id),
    supabase.from("notifications").select("id", { count: "exact", head: true })
      .eq("user_id", user.id).eq("community_id", community.id).is("read_at", null),
    supabase.from("reservations").select("id", { count: "exact", head: true })
      .eq("seller_user_id", user.id).eq("status", "requested"),
  ]);

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
