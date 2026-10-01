import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { currentUser } from "@/lib/session";
import { getStore } from "@/lib/store";
import { regionName } from "@/lib/util";
import { followAction } from "../../social-actions";

export const dynamic = "force-dynamic";
type P = Promise<{ handle: string }>;

export async function generateMetadata({ params }: { params: P }): Promise<Metadata> {
  const { handle } = await params;
  return { title: `@${handle}`, robots: { index: false } };
}

/** Public profile: only the username, join date and what they've added. No diet, allergies, email or city. */
export default async function Profile({ params }: { params: P }) {
  const handle = (await params).handle.toLowerCase();
  const store = getStore();
  const uid = /^[a-z0-9_]{3,20}$/.test(handle) ? await store.findUidByUsername(handle) : null;
  if (!uid) notFound();
  const [me, profile, reqs, followers] = await Promise.all([currentUser(), store.getProfile(uid), store.requestsBy(uid), store.followerCount(uid)]);
  if (!profile) notFound();
  const open = reqs.filter((r) => r.status !== "hidden").sort((a, b) => b.supportCount - a.supportCount);
  const isMe = me?.uid === uid;
  const following = me && !isMe ? await store.isFollowing(me.uid, uid) : false;

  return (
    <section className="hero">
      <h1>@{handle}</h1>
      <p className="meta">Member since {new Date(profile.createdAt).toLocaleDateString("en", { month: "long", year: "numeric" })} · {followers} follower{followers === 1 ? "" : "s"} · {open.length} request{open.length === 1 ? "" : "s"}</p>
      {!isMe && (
        <form action={followAction}>
          <input type="hidden" name="handle" value={handle} /><input type="hidden" name="op" value={following ? "unfollow" : "follow"} />
          <button type="submit" className={following ? "btn ghost" : undefined}>{following ? "Following ✓" : me ? "Follow" : "Sign in to follow"}</button>
        </form>
      )}
      <h2 style={{ marginTop: 28 }}>Places requested</h2>
      {open.length === 0 && <p className="meta">Nothing yet.</p>}
      <div className="grid">
        {open.map((r) => (
          <article className="card" key={r.id}>
            <span className="tag gray">{r.kind === "store" ? "Store" : "Restaurant"}</span>
            <h3>{r.name}</h3>
            <div className="meta">{r.city}, {regionName(r.country)} · {r.supportCount} want this</div>
          </article>
        ))}
      </div>
    </section>
  );
}
