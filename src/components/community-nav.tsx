"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BagIcon, BellIcon, ChartIcon, ChatIcon, HomeIcon, ListIcon, LogoutIcon, PlusIcon, ReceiptIcon, ShieldIcon, WrenchIcon } from "./icons";

type Props = {
  slug: string; communityName: string; username: string; isAdmin: boolean;
  unreadMessages: number; unreadNotifications: number; openOrders: number;
  signOut: () => Promise<void>;
};

const Count = ({ n }: { n: number }) => (n > 0 ? <span className="badge-dot">{n > 9 ? "9+" : n}</span> : null);

export default function CommunityNav(p: Props) {
  const path = usePathname();
  const base = `/c/${p.slug}`;
  const is = (href: string, exact = false) => (exact ? path === href : path === href || path.startsWith(href + "/"));
  const cur = (on: boolean) => (on ? ({ "aria-current": "page" } as const) : {});

  return (
    <>
      <header className="app-header">
        <div className="app-header-inner">
          <Link href={base} className="brand">
            <span className="brand-mark" aria-hidden>Z</span>
            <span className="brand-name">{p.communityName}</span>
          </Link>

          <nav className="desktop-nav" aria-label="Main">
            <Link href={base} {...cur(is(base, true))}><HomeIcon size={18} />Feed</Link>
            <Link href={`${base}/services`} {...cur(is(`${base}/services`))}><WrenchIcon size={18} />Services</Link>
            <Link href={`${base}/products`} {...cur(is(`${base}/products`))}><BagIcon size={18} />Products</Link>
            <Link href={`${base}/inbox`} {...cur(is(`${base}/inbox`))}><ChatIcon size={18} />Inbox{p.unreadMessages > 0 && <span className="badge danger">{p.unreadMessages}</span>}</Link>
            <Link href={`${base}/orders`} {...cur(is(`${base}/orders`))}><ReceiptIcon size={18} />Orders{p.openOrders > 0 && <span className="badge danger">{p.openOrders}</span>}</Link>
          </nav>

          <div className="header-actions">
            <Link href={`${base}/sell`} className="btn sm only-desktop" style={{ marginRight: 6 }}><PlusIcon size={16} />Sell</Link>
            <Link href={`${base}/notifications`} className="icon-btn" aria-label={`Notifications${p.unreadNotifications ? `, ${p.unreadNotifications} unread` : ""}`}>
              <BellIcon />{p.unreadNotifications > 0 && <span className="dot">{p.unreadNotifications > 9 ? "9+" : p.unreadNotifications}</span>}
            </Link>
            <details className="menu">
              <summary className="icon-btn" aria-label="Account menu"><span className="avatar">{p.username.slice(0, 1)}</span></summary>
              <div className="menu-panel">
                <div style={{ padding: "8px 12px 6px" }}><b>@{p.username}</b><div className="muted small">{p.communityName}</div></div>
                <div className="menu-sep" />
                <Link href={`${base}/mine`}><span className="row gap-sm" style={{ justifyContent: "flex-start" }}><ListIcon size={18} />My listings</span></Link>
                <Link href={`${base}/orders`}><span className="row gap-sm" style={{ justifyContent: "flex-start" }}><ReceiptIcon size={18} />Orders</span>{p.openOrders > 0 && <span className="badge danger">{p.openOrders}</span>}</Link>
                <Link href={`${base}/dashboard`}><span className="row gap-sm" style={{ justifyContent: "flex-start" }}><ChartIcon size={18} />Dashboard</span></Link>
                {p.isAdmin && <Link href={`${base}/admin`}><span className="row gap-sm" style={{ justifyContent: "flex-start" }}><ShieldIcon size={18} />Admin</span></Link>}
                <div className="menu-sep" />
                <form action={p.signOut} style={{ display: "block" }}>
                  <button type="submit"><span className="row gap-sm" style={{ justifyContent: "flex-start" }}><LogoutIcon size={18} />Sign out</span></button>
                </form>
              </div>
            </details>
          </div>
        </div>
      </header>

      <nav className="bottom-nav" aria-label="Main">
        <div className="bottom-nav-inner">
          <Link href={base} {...cur(is(base, true))}><HomeIcon />Home</Link>
          <Link href={`${base}/services`} {...cur(is(`${base}/services`))}><WrenchIcon />Services</Link>
          <Link href={`${base}/sell`} className="sell-fab" aria-label="Sell or offer something"><span className="fab"><PlusIcon size={26} /></span><small>Sell</small></Link>
          <Link href={`${base}/products`} {...cur(is(`${base}/products`))}><BagIcon />Products</Link>
          <Link href={`${base}/inbox`} {...cur(is(`${base}/inbox`))}><ChatIcon /><Count n={p.unreadMessages} />Inbox</Link>
        </div>
      </nav>
    </>
  );
}
