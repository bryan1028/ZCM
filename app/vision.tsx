import Link from "next/link";

/** The "why we exist" blurb. Shown when someone taps "I want to order here" and on /about. */
export function VisionStory({ product }: { product: "zood" | "zind" }) {
  return product === "zood" ? (
    <div className="notice">
      <b>Why Zood exists.</b> Zood was started by a foodie who got tired of endless scrolling, and of delivery apps squeezing the profits out of the restaurants we love.
      We're building an open way to reach restaurants directly, with no hidden markups, so they can bring the food to you in a way that's sustainable and
      delivery-friendly, because the people delivering are part of the restaurant, not anonymous gig workers. Every request like yours is a vote for that.{" "}
      <Link href="/about">Read more</Link>
    </div>
  ) : (
    <div className="notice">
      <b>Why Zind exists.</b> Prices should be visible to everyone. As pricing gets more personalised and algorithmic, the only defence is transparency:
      what an item costs, where, and who's cheapest, in the open and shared by people like you. <Link href="/about">Read more</Link>
    </div>
  );
}
