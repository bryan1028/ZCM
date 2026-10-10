import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import Page from "@/components/page";
import { getUser } from "@/lib/auth";

const STATUS: Record<string, { label: string; tone: string; note: string }> = {
  pending: { label: "Awaiting approval", tone: "accent", note: "An admin will confirm you live here. We'll notify you." },
  rejected: { label: "Not approved", tone: "danger", note: "Contact your community admin if you think this is a mistake." },
  suspended: { label: "Suspended", tone: "danger", note: "Contact your community admin." },
};

// Landing: send people to their community, or to the join flow.
export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await getUser(supabase);
  const { data: me } = await supabase.from("profiles").select("username").eq("id", user!.id).maybeSingle();
  if (!me?.username) redirect("/welcome");
  const { data: memberships } = await supabase
    .from("memberships")
    .select("status, communities(slug, name)")
    .eq("user_id", user!.id)   // admins can read everyone's rows; we only want our own
    .order("created_at");

  const verified = (memberships ?? []).filter((m) => m.status === "verified");
  if (verified.length === 1) redirect(`/c/${(verified[0].communities as unknown as { slug: string }).slug}`);

  return (
    <Page>
      <h1>Your communities</h1>
      <p className="muted" style={{ margin: "6px 0 16px" }}>Signed in as @{me.username}</p>
      <div className="list">
        {(memberships ?? []).map((m) => {
          const c = m.communities as unknown as { slug: string; name: string };
          const st = STATUS[m.status];
          const inner = (
            <>
              <span className="avatar avatar-lg" aria-hidden>{c.name.slice(0, 1)}</span>
              <div className="grow">
                <div className="title">{c.name}</div>
                <div className="muted small">{st ? st.note : "Verified resident"}</div>
              </div>
              {st ? <span className={`badge ${st.tone}`}>{st.label}</span> : <span className="badge brand">Open →</span>}
            </>
          );
          return st
            ? <div className="item" key={c.slug}>{inner}</div>
            : <Link className="item" href={`/c/${c.slug}`} key={c.slug}>{inner}</Link>;
        })}
        {(memberships ?? []).length === 0 && (
          <div className="empty"><div className="emoji" aria-hidden>🏡</div><h3>You haven&apos;t joined a community yet</h3><p className="muted">Request access to your estate to get started.</p></div>
        )}
      </div>
      <p style={{ marginTop: 16 }}><Link href="/join" className="btn secondary">Join a community</Link></p>
    </Page>
  );
}
