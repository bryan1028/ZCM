import { MIN_REPORT_REASON, REPORT_CATEGORIES } from "@/lib/reports";

// The two fields every report needs. Server-side checks (lib/reports.ts) and the database enforce the same rules.
export default function ReportFields({ prompt = "What happened?" }: { prompt?: string }) {
  return (
    <>
      <label>What kind of problem is it?
        <select name="category" required defaultValue="">
          <option value="" disabled>Choose one…</option>
          {REPORT_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
        </select>
      </label>
      <label>{prompt}
        <textarea name="reason" rows={3} required minLength={MIN_REPORT_REASON} maxLength={1000} placeholder="Describe what happened, with dates or details if you can." />
        <span className="hint">Admins act on clear reports. Please only report real problems.</span>
      </label>
    </>
  );
}
