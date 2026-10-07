import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

// Landing: send people to their community, or to the join flow.
export default async function Home() {
  const supabase = await createClient();
  const { data: memberships } = await supabase
    .from("memberships")
    .select("status, communities(slug, name)")
    .order("created_at");

  const verified = (memberships ?? []).filter((m) => m.status === "verified");
  if (verified.length === 1) redirect(`/c/${(verified[0].communities as unknown as { slug: string }).slug}/services`);

  return (
    <>
      <h1>Your communities</h1>
      {(memberships ?? []).map((m) => {
        const c = m.communities as unknown as { slug: string; name: string };
        return (
          <div className="card row" key={c.slug}>
            <strong>{c.name}</strong>
            {m.status === "verified" ? <Link href={`/c/${c.slug}/services`}>Open</Link> : <span className="badge">{m.status}</span>}
          </div>
        );
      })}
      <p><Link href="/join">Join a community →</Link></p>
    </>
  );
}
