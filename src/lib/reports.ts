export const REPORT_CATEGORIES = [
  "Scam or fraud", "Rude, abusive or threatening", "Fake or misleading listing",
  "Unsafe, illegal or prohibited item", "Spam", "Something else",
] as const;
export const MIN_REPORT_REASON = 15;

/** A report has to be deliberate: pick a category and explain what happened, so an admin has something real to review. */
export function checkReport(formData: FormData): { ok: true; category: string; reason: string } | { ok: false; error: string } {
  const category = String(formData.get("category") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  if (!(REPORT_CATEGORIES as readonly string[]).includes(category)) return { ok: false, error: "Please choose what the problem is" };
  if (reason.length < MIN_REPORT_REASON) return { ok: false, error: `Please explain what happened (at least ${MIN_REPORT_REASON} characters) so an admin can review it` };
  return { ok: true, category, reason };
}
