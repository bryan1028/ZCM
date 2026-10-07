import Link from "next/link";

export default function Empty({ emoji, title, children, href, cta }: {
  emoji: string; title: string; children?: React.ReactNode; href?: string; cta?: string;
}) {
  return (
    <div className="empty">
      <div className="emoji" aria-hidden>{emoji}</div>
      <h3>{title}</h3>
      {children && <p className="muted" style={{ margin: "0 auto 14px", maxWidth: 360 }}>{children}</p>}
      {href && cta && <Link href={href} className="btn sm">{cta}</Link>}
    </div>
  );
}
