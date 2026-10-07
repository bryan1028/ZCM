import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { randomUUID } from "node:crypto";
import { pushSoon } from "@/lib/push";
import { createClient } from "@/lib/supabase/server";
import { formatPrice, type PRICE_UNITS } from "@/lib/catalog";
import { extFor, MAX_UPLOAD_BYTES, signedUrls } from "@/lib/images";
import { usernamesFor } from "@/lib/usernames";

async function act(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const back = String(formData.get("back"));
  const { error } = await supabase.rpc("transition_reservation", { rid: String(formData.get("id")), act: String(formData.get("act")) });
  pushSoon();
  redirect(error ? `${back}?error=${encodeURIComponent(error.message)}` : back);
}

async function uploadProof(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const back = String(formData.get("back")), rid = String(formData.get("id"));
  const bad = (m: string): never => redirect(`${back}?error=${encodeURIComponent(m)}`);
  const file = formData.get("proof");
  if (!(file instanceof File) || file.size === 0) return bad("Attach a screenshot of your payment");
  const ext = extFor(file);
  if (!ext) return bad("Proof must be a JPEG, PNG or WebP image");
  if (file.size > MAX_UPLOAD_BYTES) return bad("Image is larger than 5 MB");
  const path = `${rid}/${randomUUID()}.${ext}`;
  const up = await supabase.storage.from("zcm-payment-proofs").upload(path, file, { contentType: file.type });
  if (up.error) return bad(up.error.message);
  const { error } = await supabase.rpc("submit_payment", { rid, path, ref: String(formData.get("reference") ?? "") });
  if (error) { await supabase.storage.from("zcm-payment-proofs").remove([path]); return bad(error.message); }
  pushSoon();
  redirect(back);
}

const LABEL: Record<string, string> = {
  requested: "Waiting for seller", accepted: "Accepted — payment due", paid: "Payment proof sent",
  completed: "Completed", declined: "Declined", cancelled: "Cancelled", expired: "Expired",
};

export default async function Orders({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ error?: string }> }) {
  const { slug } = await params;
  const { error } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: community } = await supabase.from("communities").select("id, currency").eq("slug", slug).single();
  if (!community || !user) notFound();
  const back = `/c/${slug}/orders`;

  const { data: rows } = await supabase.from("reservations")
    .select("id, buyer_id, seller_user_id, quantity, unit_price_cents, note, status, expires_at, created_at, listings(id, title, price_unit), payments(id, proof_path, reference, status, created_at)")
    .eq("community_id", community.id).order("created_at", { ascending: false });
  const names = await usernamesFor(supabase, community.id, (rows ?? []).flatMap((r) => [r.buyer_id, r.seller_user_id]));
  const proofPaths = (rows ?? []).flatMap((r) => (r.payments as unknown as { proof_path: string }[]).map((p) => p.proof_path));
  const proofs = await signedUrls(supabase, "zcm-payment-proofs", proofPaths);

  const mineAsBuyer = (rows ?? []).filter((r) => r.buyer_id === user.id);
  const mineAsSeller = (rows ?? []).filter((r) => r.seller_user_id === user.id);

  const card = (r: NonNullable<typeof rows>[number], asSeller: boolean) => {
    const l = r.listings as unknown as { id: string; title: string; price_unit: string } | null;
    const pays = (r.payments as unknown as { id: string; proof_path: string; reference: string | null; status: string; created_at: string }[])
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
    const latest = pays[pays.length - 1];
    const total = r.unit_price_cents != null ? formatPrice(r.unit_price_cents * r.quantity, "fixed", community.currency) : "Negotiable";
    const hidden = (act: string) => (<><input type="hidden" name="id" value={r.id} /><input type="hidden" name="back" value={back} /><input type="hidden" name="act" value={act} /></>);
    return (
      <div className="card" key={r.id}>
        <div className="row">
          <div>
            <Link href={`/c/${slug}/l/${l?.id}`}><strong>{l?.title ?? "Listing"}</strong></Link> × {r.quantity}
            <div className="muted">{asSeller ? "Buyer" : "Seller"} @{names.get(asSeller ? r.buyer_id : r.seller_user_id) ?? "neighbour"} · {total}</div>
          </div>
          <span className="badge">{LABEL[r.status]}</span>
        </div>
        {r.note && <p className="muted">“{r.note}”</p>}
        {pays.length > 0 && latest && (
          <p className="muted">
            Proof{latest.reference ? ` (ref ${latest.reference})` : ""}: {latest.status}{" "}
            {proofs.get(latest.proof_path) && <a href={proofs.get(latest.proof_path)} target="_blank" rel="noreferrer">view screenshot</a>}
          </p>
        )}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {asSeller && r.status === "requested" && (<>
            <form action={act}>{hidden("accept")}<button>Accept</button></form>
            <form action={act}>{hidden("decline")}<button className="secondary">Decline</button></form>
          </>)}
          {asSeller && r.status === "paid" && (<>
            <form action={act}>{hidden("confirm")}<button>Confirm payment received</button></form>
            <form action={act}>{hidden("reject_proof")}<button className="secondary">Reject proof</button></form>
          </>)}
          {["requested", "accepted"].includes(r.status) && <form action={act}>{hidden("cancel")}<button className="secondary">Cancel</button></form>}
        </div>
        {!asSeller && r.status === "accepted" && (
          <form action={uploadProof} style={{ marginTop: 10 }}>
            <input type="hidden" name="id" value={r.id} /><input type="hidden" name="back" value={back} />
            <p className="muted">Pay the seller (e.g. M-Pesa), then upload a screenshot.</p>
            <label>Payment reference (optional)<input name="reference" maxLength={100} placeholder="e.g. M-Pesa code" /></label>
            <input type="file" name="proof" accept="image/jpeg,image/png,image/webp" required />
            <button>Send proof of payment</button>
          </form>
        )}
        {["requested", "accepted"].includes(r.status) && r.expires_at && (
          <p className="muted">Expires {new Date(r.expires_at).toLocaleString()}</p>
        )}
      </div>
    );
  };

  return (
    <>
      <h2>Orders</h2>
      {error && <p className="card">{error}</p>}
      <h3>Requests for my listings ({mineAsSeller.length})</h3>
      {mineAsSeller.length === 0 && <p className="muted">None yet.</p>}
      {mineAsSeller.map((r) => card(r, true))}
      <h3>My reservations ({mineAsBuyer.length})</h3>
      {mineAsBuyer.length === 0 && <p className="muted">You haven&apos;t reserved anything.</p>}
      {mineAsBuyer.map((r) => card(r, false))}
    </>
  );
}
