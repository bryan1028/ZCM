import type { SVGProps } from "react";

// Small inline icon set (24px, stroke-based) so we don't ship an icon library.
type P = SVGProps<SVGSVGElement> & { size?: number };
const base = (size = 22): SVGProps<SVGSVGElement> => ({
  width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor",
  strokeWidth: 1.9, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true,
});

export const HomeIcon = ({ size, ...p }: P) => <svg {...base(size)} {...p}><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V20h14V9.5" /><path d="M10 20v-6h4v6" /></svg>;
export const WrenchIcon = ({ size, ...p }: P) => <svg {...base(size)} {...p}><path d="M14.7 6.3a4 4 0 0 0-5.4 5.2L3 17.8V21h3.2l6.3-6.3a4 4 0 0 0 5.2-5.4l-2.6 2.6-2.6-.7-.7-2.6z" /></svg>;
export const BagIcon = ({ size, ...p }: P) => <svg {...base(size)} {...p}><path d="M5 8h14l-1 12H6L5 8z" /><path d="M9 8V6a3 3 0 0 1 6 0v2" /></svg>;
export const ChatIcon = ({ size, ...p }: P) => <svg {...base(size)} {...p}><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.6A8 8 0 1 1 21 12z" /></svg>;
export const PlusIcon = ({ size, ...p }: P) => <svg {...base(size)} {...p}><path d="M12 5v14M5 12h14" /></svg>;
export const BellIcon = ({ size, ...p }: P) => <svg {...base(size)} {...p}><path d="M6 9a6 6 0 1 1 12 0c0 6 2 7 2 7H4s2-1 2-7z" /><path d="M10 20a2 2 0 0 0 4 0" /></svg>;
export const SearchIcon = ({ size, ...p }: P) => <svg {...base(size)} {...p}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>;
export const ReceiptIcon = ({ size, ...p }: P) => <svg {...base(size)} {...p}><path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" /><path d="M9 8h6M9 12h6" /></svg>;
export const ListIcon = ({ size, ...p }: P) => <svg {...base(size)} {...p}><path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" /></svg>;
export const ChartIcon = ({ size, ...p }: P) => <svg {...base(size)} {...p}><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></svg>;
export const ShieldIcon = ({ size, ...p }: P) => <svg {...base(size)} {...p}><path d="M12 3 4 6v6c0 4.5 3.2 7.8 8 9 4.8-1.2 8-4.5 8-9V6l-8-3z" /><path d="m9 12 2 2 4-4" /></svg>;
export const LogoutIcon = ({ size, ...p }: P) => <svg {...base(size)} {...p}><path d="M9 4H5v16h4" /><path d="M16 8l4 4-4 4M20 12H9" /></svg>;
export const SendIcon = ({ size, ...p }: P) => <svg {...base(size)} {...p}><path d="M22 2 11 13" /><path d="M22 2 15 22l-4-9-9-4 20-7z" /></svg>;
export const CheckIcon = ({ size, ...p }: P) => <svg {...base(size)} {...p}><path d="m5 12 5 5 9-10" /></svg>;
export const StarIcon = ({ size, ...p }: P) => <svg {...base(size)} {...p} fill="currentColor" strokeWidth={0}><path d="m12 2.8 2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.7l-5.9 3.1 1.2-6.5L2.5 9.7l6.6-.9z" /></svg>;
export const ChevronLeftIcon = ({ size, ...p }: P) => <svg {...base(size)} {...p}><path d="m15 5-7 7 7 7" /></svg>;
