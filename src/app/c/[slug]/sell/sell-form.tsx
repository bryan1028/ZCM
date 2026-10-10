"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { CATEGORIES, PRICE_UNITS } from "@/lib/catalog";
import { saveListing, type SellState } from "./actions";

const UNIT_LABEL: Record<string, string> = { fixed: "Fixed price", per_hour: "Per hour", per_job: "Per job", negotiable: "Negotiable" };

function Publish() {
  const { pending } = useFormStatus();
  return <button className="cta" disabled={pending} aria-busy={pending}>{pending ? "Publishing…" : "Publish listing"}</button>;
}

export default function SellForm({ slug, hasSeller, action = saveListing }: { slug: string; hasSeller: boolean; action?: (prev: SellState, fd: FormData) => Promise<SellState> }) {
  const [state, act] = useActionState<SellState, FormData>(action, { values: {} });
  const v = state.values;
  const formRef = useRef<HTMLFormElement>(null);
  const errRef = useRef<HTMLDivElement>(null);

  // bring the problem into view and put the cursor on the field that needs fixing
  useEffect(() => {
    if (!state.error) return;
    errRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
    if (state.field) formRef.current?.querySelector<HTMLElement>(`[name="${state.field}"]`)?.focus({ preventScroll: true });
  }, [state]);

  const fe = (name: string) => state.field === name && state.error ? <span className="field-error" role="alert">{state.error}</span> : null;
  const bad = (name: string) => (state.field === name && state.error ? true : undefined);
  const accountType = v.account_type === "business" ? "business" : "individual";
  const kind = v.kind === "product" ? "product" : "service";
  const unit = v.price_unit && v.price_unit in PRICE_UNITS ? v.price_unit : "fixed";

  return (
    <form ref={formRef} action={act} noValidate className="stack sell-form">
      <input type="hidden" name="slug" value={slug} />

      {!hasSeller && (
        <section className="card stack">
          <h3 style={{ margin: 0 }}>About you</h3>
          <p className="muted small" style={{ margin: 0 }}>You only set this up once.</p>
          <div className="choices">
            <label className="choice"><input type="radio" name="account_type" value="individual" defaultChecked={accountType === "individual"} /><span className="box"><b>👤 Individual</b><small>Selling as yourself</small></span></label>
            <label className="choice"><input type="radio" name="account_type" value="business" defaultChecked={accountType === "business"} /><span className="box"><b>🏪 Business</b><small>A shop, crew or company</small></span></label>
          </div>
          <label>Your name <span className="hint">(shown to neighbours)</span>
            <input name="display_name" defaultValue={v.display_name} placeholder="e.g. Wanjiku M." autoComplete="name" aria-invalid={bad("display_name")} />
            {fe("display_name")}
          </label>
          <label className="biz-only">Business name
            <input name="business_name" defaultValue={v.business_name} placeholder="e.g. Otieno Gardens & Landscaping" aria-invalid={bad("business_name")} />
            {fe("business_name")}
          </label>
          <label>WhatsApp number <span className="hint">(optional)</span><input name="whatsapp" defaultValue={v.whatsapp} inputMode="tel" placeholder="2547…" /></label>
        </section>
      )}

      <section className="card stack">
        <h3 style={{ margin: 0 }}>What are you offering?</h3>
        <div className="choices">
          <label className="choice"><input type="radio" name="kind" value="service" defaultChecked={kind === "service"} /><span className="box"><b>🛠️ A service</b><small>Work you do for people</small></span></label>
          <label className="choice"><input type="radio" name="kind" value="product" defaultChecked={kind === "product"} /><span className="box"><b>🛍️ A product</b><small>Something you make or sell</small></span></label>
        </div>
        <label className="for-service">Category
          <select name="category_service" defaultValue={v.category_service || CATEGORIES.service[0]} aria-invalid={bad("category_service")}>{CATEGORIES.service.map((c) => <option key={c}>{c}</option>)}</select>
          {fe("category_service")}
        </label>
        <label className="for-product">Category
          <select name="category_product" defaultValue={v.category_product || CATEGORIES.product[0]} aria-invalid={bad("category_product")}>{CATEGORIES.product.map((c) => <option key={c}>{c}</option>)}</select>
          {fe("category_product")}
        </label>
        <label>Title
          <input name="title" defaultValue={v.title} maxLength={120} placeholder="e.g. Weekly lawn care & hedge trimming" aria-invalid={bad("title")} />
          {fe("title")}
        </label>
        <label>Description <span className="hint">(optional)</span><textarea name="description" defaultValue={v.description} rows={4} placeholder="What's included, how it works, when you're available…" /></label>
      </section>

      <section className="card stack">
        <h3 style={{ margin: 0 }}>Price</h3>
        <div className="choices four">
          {Object.keys(PRICE_UNITS).map((u) => (
            <label className="choice" key={u}><input type="radio" name="price_unit" value={u} defaultChecked={u === unit} /><span className="box"><b>{UNIT_LABEL[u]}</b></span></label>
          ))}
        </div>
        <label className="price-field">Amount (KES)
          <input name="price" defaultValue={v.price} inputMode="decimal" autoComplete="off" placeholder="e.g. 1500" aria-invalid={bad("price")} />
          {fe("price")}
        </label>
        <label className="for-product">Stock <span className="hint">(optional)</span>
          <input name="stock" defaultValue={v.stock} inputMode="numeric" autoComplete="off" placeholder="How many do you have?" aria-invalid={bad("stock")} />
          {fe("stock")}
        </label>
      </section>

      {state.error && (
        <div ref={errRef} className="alert error pop-in" role="alert"><strong>Not published yet.</strong> {state.error}</div>
      )}
      <Publish />
    </form>
  );
}
