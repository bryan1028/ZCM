import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "About Zood and Zind", description: "Why we're building direct, transparent food and price discovery." };

export default function About() {
  return (
    <section style={{ padding: "28px 0 56px", maxWidth: 680 }}>
      <h1>Why we're doing this</h1>
      <h2>🍜 Zood: restaurants, directly</h2>
      <p>
        Zood was started by a foodie who got tired of scrolling, and of delivery apps squeezing the profits out of beloved restaurants.
        Our vision is an open world where you connect with restaurants directly, with no hidden markups, and they bring the food to you in a way that is
        sustainable and delivery-friendly, because their delivery people aren't just anonymous gig workers.
      </p>
      <p>
        We're early, and we only list restaurants with a real menu. If you run a restaurant we've found, you can claim it: we verify you, then you get a free trial to edit your profile and menu and start taking orders directly.
        Know a place that should be here? <Link href="/requests/new">Zummon it</Link>.
      </p>
      <h2>🦊 Zind: prices in the open</h2>
      <p>
        Our goal is price transparency. With dynamic and personalised pricing on the way, the best defence is a shared, public record of what things really cost,
        and where. Zind collects prices from open data and from people like you, so anyone can see who's cheapest.
      </p>
      <p><Link className="btn" href="/">Find food</Link> <Link className="btn ghost" href="/find">Find prices</Link> <Link className="btn ghost" href="/requests/new">Zummon a restaurant</Link></p>
    </section>
  );
}
