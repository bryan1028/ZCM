import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getStore } from "@/lib/store";
import { requireAdmin } from "@/lib/auth";
import { currencyFor, menuToText } from "@/lib/menu-text";
import { adminSaveMenu } from "../../../claim-actions";
import { RestaurantEditor } from "../../../editor";

export const metadata: Metadata = { title: "Admin: restaurant", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AdminRestaurant({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const sp = await searchParams;
  const r = await getStore().getRestaurant(id);
  if (!r) notFound();
  return (
    <section className="hero">
      <p className="meta"><Link href="/admin#claims">← back to inbox</Link> · <Link href={`/r/${r.id}`}>public page</Link></p>
      <h1>{r.name}</h1>
      <p className="meta">{r.city}, {r.country} · status {r.status} · plan {r.plan}{r.ownerUid ? " · has owner" : ""}. Use this to add a menu the owner sent you in the claim thread. It only shows on Zood once the restaurant is approved and has a menu.</p>
      {sp.saved && <div className="notice">Saved.</div>}
      <RestaurantEditor action={adminSaveMenu} r={r} menuText={menuToText(r.menu)} currency={r.menu[0]?.currency ?? currencyFor(r.country)} />
    </section>
  );
}
