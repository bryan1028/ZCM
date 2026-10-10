"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type MediaItem = { type: "image" | "video"; src: string };

// Swipeable photo/video carousel (scroll-snap, so it feels native on phones; arrows + keyboard on desktop).
// Videos pause when you move off them. Every slide fills the same frame, so mixed media never breaks the layout.
export default function MediaCarousel({ items, alt }: { items: MediaItem[]; alt: string }) {
  const track = useRef<HTMLDivElement>(null);
  const raf = useRef(0);
  const [index, setIndex] = useState(0);
  const count = items.length;

  const goTo = useCallback((n: number) => {
    const el = track.current;
    if (!el) return;
    const next = Math.max(0, Math.min(count - 1, n));
    el.scrollTo({ left: next * el.clientWidth, behavior: "smooth" });
  }, [count]);

  const onScroll = () => {
    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(() => {
      const el = track.current;
      if (el && el.clientWidth) setIndex(Math.round(el.scrollLeft / el.clientWidth));
    });
  };

  // only the visible slide may play
  useEffect(() => {
    track.current?.querySelectorAll("video").forEach((v) => {
      const slide = Number((v.closest("[data-slide]") as HTMLElement | null)?.dataset.slide);
      if (slide !== index) v.pause();
    });
  }, [index]);
  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight") { e.preventDefault(); goTo(index + 1); }
    if (e.key === "ArrowLeft") { e.preventDefault(); goTo(index - 1); }
  };

  return (
    <div className="carousel-wrap" role="region" aria-roledescription="carousel" aria-label={`Photos and videos of ${alt}`} onKeyDown={onKey}>
    <div className="carousel" tabIndex={0}>
      <div className="carousel-track" ref={track} onScroll={onScroll}>
        {items.map((m, n) => (
          <div className="carousel-slide" data-slide={n} key={m.src} aria-roledescription="slide" aria-label={`${n + 1} of ${count}`}>
            {m.type === "image"
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={m.src} alt={alt} loading={n === 0 ? "eager" : "lazy"} draggable={false} />
              : <video src={m.src} controls playsInline preload="metadata" />}
          </div>
        ))}
      </div>

      {count > 1 && (
        <>
          <span className="carousel-count" aria-hidden>{index + 1}/{count}</span>
          <button type="button" className="car-btn car-prev" onClick={() => goTo(index - 1)} disabled={index === 0} aria-label="Previous">‹</button>
          <button type="button" className="car-btn car-next" onClick={() => goTo(index + 1)} disabled={index === count - 1} aria-label="Next">›</button>
        </>
      )}
    </div>
    {count > 1 && (
      <div className="carousel-dots">
        {items.map((m, n) => (
          <button type="button" key={m.src} className="car-dot" aria-label={`Show ${m.type} ${n + 1}`} aria-current={n === index} onClick={() => goTo(n)} />
        ))}
      </div>
    )}
    </div>
  );
}
