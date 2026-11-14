"use strict";
import { REST_DAY } from "./constants.js";

/* ---------- תאריכים ---------- */
export function iso(d) {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, "0"), day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
export function fromIso(s) { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); }
export function weekKeyOf(d) { // ראשון של אותו שבוע
  const c = new Date(d);
  c.setDate(c.getDate() - c.getDay());
  return iso(c);
}
export function addDays(isoStr, n) { const d = fromIso(isoStr); d.setDate(d.getDate() + n); return iso(d); }
export function shortDate(isoStr) { const d = fromIso(isoStr); return `${d.getDate()}.${d.getMonth() + 1}`; }

export const todayIso = () => iso(new Date());

export function defaultWorkoutDate() {
  // היום, אלא אם שבת (מנוחה) — ואז מחר
  const t = new Date();
  return t.getDay() === REST_DAY ? addDays(iso(t), 1) : iso(t);
}
