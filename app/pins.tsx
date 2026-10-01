import Link from "next/link";
import { PINS } from "@/lib/pins";

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
