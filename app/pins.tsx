import Link from "next/link";
import { PINS } from "@/lib/pins";
import { flag } from "@/lib/ticker";

/** Pinterest-style board of iconic dishes by place. Each tile opens a search for that dish in that city. */
export function PinBoard() {
  return (
    <div className="pinboard" role="list" aria-label="Dishes around the world">
      {PINS.map((p) => (
        <Link key={p.key} role="listitem" className={`pin ${p.img ? p.shape : "noimg"}`} style={{ ["--pin" as string]: p.color }} href={`/?q=${encodeURIComponent(p.q)}&city=${encodeURIComponent(p.city)}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {p.img ? <img src={p.img} alt={p.alt} loading="lazy" width={600} height={p.shape === "tall" ? 800 : p.shape === "sq" ? 600 : 450} /> : <span aria-hidden>{p.emoji}</span>}
          <span className="cap"><b>{p.dish}</b><span>📍 {p.place}</span></span>
        </Link>
      ))}
    </div>
  );
}

/** A moving row of dishes from different places, for the top of the page. Content is repeated once for a seamless loop; the copy is hidden from assistive tech. */
export function PinStrip() {
  return (
    <div className="strip" aria-label="Dishes from around the world">
      <div className="strip-track">
        {[0, 1].map((k) => PINS.map((p) => (
          <Link key={`${k}${p.key}`} className="pin" style={{ ["--pin" as string]: p.color }} aria-hidden={k === 1} tabIndex={k === 1 ? -1 : undefined} href={`/?q=${encodeURIComponent(p.q)}&city=${encodeURIComponent(p.city)}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {p.img ? <img src={p.img} alt={k === 0 ? p.alt : ""} loading={k === 0 ? "eager" : "lazy"} width={200} height={260} /> : <span aria-hidden>{p.emoji}</span>}
            <span className="cap"><b>{p.dish}</b><span>📍 {p.place}</span></span>
          </Link>
        )))}
      </div>
    </div>
  );
}

/** Everyday groceries as photo cards with the typical price in a few countries. */
export function StapleStrip({ items }: { items: import("@/lib/ticker").TickerItem[] }) {
  return (
    <div className="strip" aria-label="Everyday groceries around the world">
      <div className="strip-track slow">
        {[0, 1].map((k) => items.map((t) => (
          <Link key={`${k}${t.label}`} className="staple" aria-hidden={k === 1} tabIndex={k === 1 ? -1 : undefined} href={`/find?q=${encodeURIComponent(t.label.toLowerCase())}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={t.img} alt={k === 0 ? t.label : ""} loading={k === 0 ? "eager" : "lazy"} width={240} height={180} />
            <span className="sbody">
              <b>{t.emoji} {t.label}</b>
              {t.countries.slice(0, 3).map((c) => <span key={c.country}>{flag(c.country)} {c.text}</span>)}
            </span>
          </Link>
        )))}
      </div>
    </div>
  );
}
