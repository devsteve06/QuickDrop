export function round2(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

export function formatMoney(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "$0.00";
  return `$${amount.toFixed(2)}`;
}

export function pluralize(count, singular, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

/**
 * The API stores `created_at` as SQLite's `datetime('now')` — `YYYY-MM-DD HH:MM:SS`
 * in UTC, with no timezone marker. Parse it as UTC rather than as local time, and
 * degrade to the raw value if the platform cannot format it.
 */
export function formatOrderTime(value) {
  if (typeof value !== "string" || !value.trim()) return "";

  const iso = value.includes("T") ? value : `${value.replace(" ", "T")}Z`;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";

  try {
    return date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return date.toUTCString();
  }
}
