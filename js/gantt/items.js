"use strict";
/* פריטי הגאנט שמגיעים מעץ הפרויקטים — משותף לתצוגת השבוע ולגאנט הארוך.
   הגאנט לא מחזיק נתונים: כל פריט מצביע על הרשומה המקורית, וכל עריכה נכתבת אליה. */
import { addDays, todayIso } from "../core/dates.js";
import { escapeHtml } from "../core/ui.js";
import { state } from "../core/state.js";
import { isRoutine, projectById, toggleTaskDone } from "../projects/model.js";
import { openTaskEditor } from "../projects/projects.js";
import { gantt, makeTaskDraggable } from "./plan.js";

const PALETTE = ["#38b6ff", "#b38cff", "#ff9f5a", "#4cd08a", "#ff6fa8", "#e8c35a", "#5ad1c9"];
export function projectColor(p) {
  let h = 0;
  for (const c of p.id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

/* פרויקטים פעילים עם טווח תאריכים שחופף ל-[from, to] */
export function projectBars(from, to) {
  return (state.projects || [])
    .filter((p) => p.status === "active" && !isRoutine(p) && (p.start || p.end))
    .map((p) => ({ p, start: p.start || p.end, end: p.end || p.start }))
    .filter((b) => b.start <= to && b.end >= from)
    .sort((a, b) => a.start.localeCompare(b.start));
}

/* מופעי מטלות בטווח. מטלה חוזרת: המופע האמיתי (task.date) + מופעים עתידיים מוקרנים
   (projected — חלשים, לא נגררים). מטלה באיחור מוצגת גם ביום של היום (overdue). */
export function taskOccurrences(from, to) {
  const today = todayIso();
  const out = [];
  for (const t of state.tasks || []) {
    const proj = projectById(t.projectId);
    if (!proj || proj.status === "dropped") continue;
    if (!t.date) continue;
    if (t.done) {
      if (t.date >= from && t.date <= to) out.push({ task: t, proj, date: t.date, done: true });
      continue;
    }
    if (t.date < today && today >= from && today <= to) {
      out.push({ task: t, proj, date: today, overdue: true });
    } else if (t.date >= from && t.date <= to) {
      out.push({ task: t, proj, date: t.date });
    }
    if (t.repeat) {
      // מופעים אחרי המופע האמיתי; מה שבין תאריך באיחור להיום לא מוקרן (לא נערם)
      let d = t.date, guard = 0;
      while (guard++ < 1000) {
        d = stepFrom(d, t.repeat);
        if (d > to) break;
        if (d > today && d >= from) out.push({ task: t, proj, date: d, projected: true });
      }
    }
  }
  return out;
}
function stepFrom(iso, repeat) {
  const n = Math.max(1, repeat.every || 1);
  if (repeat.unit === "day") return addDays(iso, n);
  if (repeat.unit === "week") return addDays(iso, 7 * n);
  const [y, m, d] = iso.split("-").map(Number);
  const last = new Date(y, m - 1 + n + 1, 0).getDate(); // 31 בחודש → היום האחרון בחודש קצר
  const dt = new Date(y, m - 1 + n, Math.min(d, last));
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

/* צ'יפ של מטלה: ✓ בתוך הצ'יפ מסמן בוצע, הקשה על השאר פותחת עריכה, גרירה משנה תאריך */
export function taskChip(occ) {
  const { task, proj } = occ;
  const chip = document.createElement("span");
  chip.className = "gantt-node task-node" +
    (occ.done ? " done-node" : "") + (occ.overdue ? " overdue" : "") + (occ.projected ? " projected" : "");
  chip.style.setProperty("--pc", isRoutine(proj) ? "#93a1af" : projectColor(proj));
  const check = occ.projected ? "" : `<span class="chip-check" title="בוצע">${occ.done ? "✓" : "○"}</span>`;
  const projName = isRoutine(proj) ? "" : `<span class="chip-proj">${escapeHtml(proj.name)}</span>`;
  chip.innerHTML = `${check}<span class="chip-text">${task.time ? `<b>${task.time}</b> ` : ""}${escapeHtml(task.title)}</span>${projName}`;
  chip.title = `${task.title}${isRoutine(proj) ? " · שוטף" : " · " + proj.name}${occ.overdue ? " · באיחור (מ-" + task.date + ")" : ""}`;
  const onTap = (target) => {
    if (target.closest && target.closest(".chip-check")) { toggleTaskDone(task); gantt.rerender(); return; }
    openTaskEditor(task.id, task.projectId, () => gantt.rerender());
  };
  if (occ.projected || occ.done) {
    chip.addEventListener("click", (e) => { e.stopPropagation(); onTap(e.target); });
  } else {
    makeTaskDraggable(chip, task, onTap);
  }
  return chip;
}
