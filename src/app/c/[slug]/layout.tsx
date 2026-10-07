import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { KINDS } from "@/lib/catalog";

// The gate: nothing under /c/[slug] renders unless the user is a verified member.
// (RLS enforces the same rule in the database; this is just the friendly redirect.)
export default async function CommunityLayout({ children, params }: { children: React.ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: community } = await supabase.from("communities").select("id, name").eq("slug", slug).maybeSingle();
  if (!community) notFound();
  const { data: m } = await supabase
    .from("memberships").select("status, role").eq("community_id", community.id).maybeSingle();
  if (m?.status !== "verified") redirect("/");

  return (
    <>
      <div className="row">
        <h1>{community.name}</h1>
        <span>
          <Link href={`/c/${slug}/sell`}>Sell / offer</Link>
          {m.role === "admin" && <> · <Link href={`/c/${slug}/admin`}>Admin</Link></>}
        </span>
      </div>
      <nav className="tabs">
        {Object.entries(KINDS).map(([k, v]) => <Link key={k} href={`/c/${slug}/${k}`}>{v.label}</Link>)}
      </nav>
      {children}
    </>
  );
}
