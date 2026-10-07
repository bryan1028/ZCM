import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { randomUUID } from "node:crypto";
import { pushSoon } from "@/lib/push";
import { createClient } from "@/lib/supabase/server";
import { formatPrice, type PRICE_UNITS } from "@/lib/catalog";
import ImageInput from "@/components/image-input";
import { extFor, MAX_UPLOAD_BYTES, signedUrls } from "@/lib/images";
import Empty from "@/components/empty";
import { getCommunity } from "@/lib/community";
import { fmtDateTime } from "@/lib/time";
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

export default async function Orders({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ error?: string; tab?: string }> }) {
  const { slug } = await params;
  const { error, tab } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const community = await getCommunity(slug);
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

  const STEPS = ["Requested", "Accepted", "Paid", "Done"];
  const stepOf: Record<string, number> = { requested: 0, accepted: 1, paid: 2, completed: 3 };
  const TONE: Record<string, string> = { requested: "accent", accepted: "info", paid: "info", completed: "brand", declined: "danger", cancelled: "", expired: "" };
  const hint = (status: string, asSeller: boolean, other: string) => {
    if (asSeller) return ({ requested: "Accept or decline this request.", accepted: `Waiting for @${other} to send payment proof.`, paid: "Check the screenshot, then confirm you were paid.", completed: "All done 🎉" } as Record<string, string>)[status];
    return ({ requested: `Waiting for @${other} to accept.`, accepted: "Pay the seller, then upload your proof below.", paid: `Waiting for @${other} to confirm your payment.`, completed: "Complete! Don't forget to leave a review." } as Record<string, string>)[status];
  };

  const card = (r: NonNullable<typeof rows>[number], asSeller: boolean) => {
    const l = r.listings as unknown as { id: string; title: string; price_unit: string } | null;
    const pays = (r.payments as unknown as { id: string; proof_path: string; reference: string | null; status: string; created_at: string }[])
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
    const latest = pays[pays.length - 1];
    const other = names.get(asSeller ? r.buyer_id : r.seller_user_id) ?? "neighbour";
    const total = r.unit_price_cents != null ? formatPrice(r.unit_price_cents * r.quantity, "fixed", community.currency) : "Negotiable";
    const hidden = (act: string) => (<><input type="hidden" name="id" value={r.id} /><input type="hidden" name="back" value={back} /><input type="hidden" name="act" value={act} /></>);
    const step = stepOf[r.status];
    const open = ["requested", "accepted"].includes(r.status);
    return (
      <div className="card stack" key={r.id}>
        <div className="row row-start">
          <div className="grow">
            <Link href={`/c/${slug}/l/${l?.id}`} style={{ fontWeight: 650, color: "var(--ink)" }}>{l?.title ?? "Listing"}</Link>
            <div className="muted small">{r.quantity} × · {total} · {asSeller ? "buyer" : "seller"} @{other}</div>
          </div>
          <span className={`badge ${TONE[r.status] ?? ""}`}>{asSeller && r.status === "requested" ? "New request" : asSeller && r.status === "accepted" ? "Awaiting payment" : asSeller && r.status === "paid" ? "Check payment" : LABEL[r.status]}</span>
        </div>

        {step !== undefined && (
          <ol className="steps" aria-label="Progress">
            {STEPS.map((name, n) => <li key={name} className={n < step ? "done" : n === step ? "current" : ""}><i aria-hidden>{n < step ? "✓" : n + 1}</i><span>{name}</span></li>)}
          </ol>
        )}
        {hint(r.status, asSeller, other) && <div className={`alert ${r.status === "completed" ? "ok" : "info"}`}>{hint(r.status, asSeller, other)}</div>}
        {r.note && <p className="muted" style={{ margin: 0 }}>“{r.note}”</p>}
        {pays.length > 0 && latest && (
          <p className="muted small" style={{ margin: 0 }}>
            Proof{latest.reference ? ` · ref ${latest.reference}` : ""} · {latest.status}{" "}
            {proofs.get(latest.proof_path) && <a href={proofs.get(latest.proof_path)} target="_blank" rel="noreferrer">View screenshot</a>}
          </p>
        )}

        <div className="inline-form">
          {asSeller && r.status === "requested" && (<>
            <form action={act}>{hidden("accept")}<button className="sm">Accept</button></form>
            <form action={act}>{hidden("decline")}<button className="secondary sm">Decline</button></form>
          </>)}
          {asSeller && r.status === "paid" && (<>
            <form action={act}>{hidden("confirm")}<button className="sm">Confirm payment received</button></form>
            <form action={act}>{hidden("reject_proof")}<button className="secondary sm">Reject proof</button></form>
          </>)}
          {open && <form action={act}>{hidden("cancel")}<button className="ghost sm">Cancel</button></form>}
          {!asSeller && r.status === "completed" && <Link href={`/c/${slug}/l/${l?.id}`} className="btn secondary sm">Leave a review</Link>}
        </div>

        {!asSeller && r.status === "accepted" && (
          <form action={uploadProof} className="stack card flat" style={{ background: "var(--surface-2)" }}>
            <input type="hidden" name="id" value={r.id} /><input type="hidden" name="back" value={back} />
            <b>Send proof of payment</b>
            <span className="muted small">Pay the seller (e.g. M-Pesa), then upload a screenshot. The app never handles your money.</span>
            <label>Payment reference <span className="hint">(optional)</span><input name="reference" maxLength={100} placeholder="e.g. M-Pesa code" /></label>
            <ImageInput name="proof" required />
            <button>Send proof</button>
          </form>
        )}
        {open && r.expires_at && <p className="muted small" style={{ margin: 0 }}>Expires {fmtDateTime(r.expires_at, community.timezone)}</p>}
      </div>
    );
  };

  const openSelling = mineAsSeller.filter((r) => ["requested", "paid"].includes(r.status)).length;
  const active = tab === "buying" || tab === "selling" ? tab : openSelling > 0 || mineAsBuyer.length === 0 ? "selling" : "buying";
  const shown = active === "selling" ? mineAsSeller : mineAsBuyer;

  return (
    <>
      <div className="page-head"><div><h1>Orders</h1><p className="muted">Reservations and bookings, in one place.</p></div></div>
      {error && <div className="alert error" role="alert" style={{ marginBottom: 12 }}>{error}</div>}
      <div className="segmented" style={{ marginBottom: 16 }}>
        <Link href={`${back}?tab=selling`} {...(active === "selling" ? { "aria-current": "page" as const } : {})}>Requests to me{openSelling > 0 && <span className="badge danger" style={{ marginLeft: 6 }}>{openSelling}</span>}</Link>
        <Link href={`${back}?tab=buying`} {...(active === "buying" ? { "aria-current": "page" as const } : {})}>My orders ({mineAsBuyer.length})</Link>
      </div>
      {shown.length === 0 ? (
        active === "selling"
          ? <Empty emoji="📬" title="No requests yet" href={`/c/${slug}/mine`} cta="View my listings">When a neighbour reserves or books something of yours, it shows up here.</Empty>
          : <Empty emoji="🛒" title="You haven't reserved anything" href={`/c/${slug}/products`} cta="Browse products">Find something you like and tap Reserve.</Empty>
      ) : <div className="list">{shown.map((r) => card(r, active === "selling"))}</div>}
    </>
  );
}
