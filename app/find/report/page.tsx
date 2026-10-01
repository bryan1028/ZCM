import type { Metadata } from "next";
import Link from "next/link";
import { currentUser } from "@/lib/session";
import { reportPrice } from "../../actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Report a price" };

export default async function Report({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const user = await currentUser();
  if (!user) {
    return (
      <section className="hero">
        <h1>Report a price</h1>
        <p>Sign in so your report carries your signature and others can trust it.</p>
        <p><Link className="btn" href="/login?next=/find/report">Sign in</Link> <Link className="btn ghost" href="/signup?next=/find/report">Create account</Link></p>
      </section>
    );
  }
  return (
    <section className="hero">
      <h1>Add a price 🐾</h1>
      <p>Saw a price at a store? Add it so others can compare. It will be signed <span className="sig">@{user.handle}</span>.</p>
      {error === "limit" && <div className="notice">You've reached today's limit. Please come back tomorrow.</div>}
      {error === "1" && <div className="notice">Please fill every required field with a valid price, 2-letter country code and 3-letter currency.</div>}
      <form className="stack" action={reportPrice}>
        <input type="text" name="website" tabIndex={-1} autoComplete="off" style={{ display: "none" }} aria-hidden />
        <label className="f">Product<input type="text" name="product" required placeholder="Whole milk" /></label>
        <label className="f">Brand (optional)<input type="text" name="brand" placeholder="Any brand" /></label>
        <label className="f">Size (optional)<input type="text" name="size" placeholder="1L, 500g, 12-pack" /></label>
        <label className="f">Barcode (optional)<input type="text" name="barcode" inputMode="numeric" /></label>
        <label className="f">Store<input type="text" name="store" required placeholder="Store name" /></label>
        <label className="f">City<input type="text" name="city" required placeholder="City" /></label>
        <label className="f">Country code (2 letters)<input type="text" name="country" required maxLength={2} placeholder="e.g. FR, US, KE" style={{ textTransform: "uppercase" }} /></label>
        <div className="row" style={{ display: "flex", gap: 10 }}>
          <label className="f" style={{ flex: 2 }}>Price<input type="text" name="price" inputMode="decimal" required placeholder="2.50" /></label>
          <label className="f" style={{ flex: 1 }}>Currency<input type="text" name="currency" required maxLength={3} placeholder="EUR" style={{ textTransform: "uppercase" }} /></label>
        </div>
        <button type="submit">Submit price</button>
      </form>
    </section>
  );
}
