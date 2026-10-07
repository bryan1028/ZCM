// Dates are shown in the community's own timezone (default Africa/Nairobi), never the server's (UTC on Netlify).
const LOCALE = "en-GB";
const TZ_FALLBACK = "Africa/Nairobi";

const fmt = (iso: string | Date, tz: string, o: Intl.DateTimeFormatOptions) =>
  new Date(iso).toLocaleString(LOCALE, { timeZone: tz || TZ_FALLBACK, ...o });

/** "7 Oct" */
export const fmtDay = (iso: string | Date, tz: string) => fmt(iso, tz, { day: "numeric", month: "short" });
/** "Wed, 7 Oct" */
export const fmtWeekday = (iso: string | Date, tz: string) => fmt(iso, tz, { weekday: "short", day: "numeric", month: "short" });
/** "4:31 pm" */
export const fmtTime = (iso: string | Date, tz: string) => fmt(iso, tz, { hour: "numeric", minute: "2-digit", hour12: true });
/** "7 Oct, 4:31 pm" */
export const fmtDateTime = (iso: string | Date, tz: string) => `${fmtDay(iso, tz)}, ${fmtTime(iso, tz)}`;
/** is the instant on the same calendar day as now, in that timezone? */
export const isToday = (iso: string | Date, tz: string) => fmt(iso, tz, { dateStyle: "short" }) === fmt(new Date(), tz, { dateStyle: "short" });
