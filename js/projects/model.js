"use strict";
/* עץ 3 — מודל נתונים של פרויקטים ומטלות.
   state.projects: [{ id, name, area, status, start, end, nextStep, notes, createdAt }]
   state.tasks:    [{ id, projectId, title, date, time, duration, done, doneAt, repeat, lastDone }]
   time: "HH:MM" או ריק (= כל היום) · duration: דקות (רק כשיש שעה)
   repeat: null או { every: N, unit: "day" | "week" | "month" } — מטלה חוזרת היא רשומה אחת
   שהתאריך שלה מתקדם בכל סימון "בוצע" (לא נוצרים עותקים).
   הגאנט (שלב 3) קורא מכאן ועורך דרך הפונקציות האלה — מקור אמת אחד. */
import { addDays, fromIso, iso, todayIso } from "../core/dates.js";
import { newId } from "../core/model.js";
import { save, state } from "../core/state.js";

export const ROUTINE_ID = "proj-routine"; // "שוטף": תחזוקת בית ויום-יום — לא נספר במגבלת הפעילים
/* מגבלת פעילים — אופציונלית (הגדרות). 0 = בלי מגבלה (ברירת מחדל). אזהרה בלבד, לא חסימה */
export const activeLimit = () => (state.settings && state.settings.activeLimit) || 0;

export const STATUSES = {
  active: { label: "פעיל", icon: "🟢" },
  frozen: { label: "מוקפא", icon: "🧊" },
  done: { label: "הושלם", icon: "✅" },
  dropped: { label: "ירד", icon: "🗑️" },
};
export const DEFAULT_AREAS = ["אפליקציות", "בית", "רכישות", "חיים", "יצירה", "לימודים", "עבודה"];
export const REPEAT_UNITS = { day: "ימים", week: "שבועות", month: "חודשים" };

/* מבטיח שהמבנה קיים — נקרא מהמיגרציות בטעינה */
export function ensureProjects() {
  let changed = false;
  if (!Array.isArray(state.projects)) { state.projects = []; changed = true; }
  if (!Array.isArray(state.tasks)) { state.tasks = []; changed = true; }
  if (!state.projects.some((p) => p.id === ROUTINE_ID)) {
    state.projects.unshift({ id: ROUTINE_ID, name: "שוטף", area: "שוטף", status: "active", nextStep: "", createdAt: todayIso() });
    changed = true;
  }
  if (changed) save();
}

export const projectById = (id) => state.projects.find((p) => p.id === id);
export const tasksOf = (projectId) => state.tasks.filter((t) => t.projectId === projectId);
export const isRoutine = (p) => p && p.id === ROUTINE_ID;

export function activeProjects() {
  return state.projects.filter((p) => p.status === "active" && !isRoutine(p));
}
export function allAreas() {
  const used = state.projects.map((p) => p.area).filter((a) => a && a !== "שוטף");
  return [...new Set([...DEFAULT_AREAS, ...used])];
}

export function saveProject(data) {
  const existing = data.id && projectById(data.id);
  if (existing) Object.assign(existing, data);
  else state.projects.push({ ...data, id: newId("proj"), createdAt: todayIso() });
  save();
}
export function deleteProject(id) {
  if (id === ROUTINE_ID) return;
  state.projects = state.projects.filter((p) => p.id !== id);
  state.tasks = state.tasks.filter((t) => t.projectId !== id);
  save();
}
/* הוספה מהירה: שורה = פרויקט. מחזיר כמה נוספו (שמות קיימים מדולגים) */
export function bulkAddProjects(lines, area, status) {
  const names = new Set(state.projects.map((p) => p.name.trim()));
  let added = 0;
  for (const raw of lines) {
    const name = raw.replace(/^[-•*\d.)\s]+/, "").trim();
    if (!name || names.has(name)) continue;
    names.add(name);
    state.projects.push({ id: newId("proj"), name, area, status, nextStep: "", createdAt: todayIso() });
    added++;
  }
  if (added) save();
  return added;
}

export function saveTask(data) {
  const existing = data.id && state.tasks.find((t) => t.id === data.id);
  if (existing) Object.assign(existing, data);
  else state.tasks.push({ done: false, ...data, id: newId("tk") });
  save();
}
export function deleteTask(id) {
  state.tasks = state.tasks.filter((t) => t.id !== id);
  save();
}

function stepDate(dateIso, repeat) {
  const n = Math.max(1, repeat.every || 1);
  if (repeat.unit === "day") return addDays(dateIso, n);
  if (repeat.unit === "week") return addDays(dateIso, 7 * n);
  const d = fromIso(dateIso);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, last)); // 31 בחודש → היום האחרון בחודש קצר
  return iso(d);
}
/* המופע הבא אחרי היום (מטלה שפוספסה כמה פעמים לא נערמת — קופצים להבא) */
export function nextOccurrence(task) {
  const today = todayIso();
  let d = task.date || today;
  do d = stepDate(d, task.repeat); while (d <= today);
  return d;
}

/* סימון בוצע. מטלה חוזרת: התאריך מתקדם, והיא נשארת פתוחה. מחזיר את התאריך הבא (או null) */
export function toggleTaskDone(task) {
  if (task.repeat && !task.done) {
    task.lastDone = todayIso();
    task.date = nextOccurrence(task);
    save();
    return task.date;
  }
  task.done = !task.done;
  task.doneAt = task.done ? todayIso() : undefined;
  save();
  return null;
}

/* מטלות פתוחות, ממוינות: באיחור ← היום ← לפי תאריך ← בלי תאריך */
export function openTasksSorted(list) {
  const key = (t) => (t.date || "9999") + (t.time || "99:99");
  return list.filter((t) => !t.done).sort((a, b) => key(a).localeCompare(key(b)));
}
export function dueLabel(task) {
  if (!task.date) return { text: "", cls: "" };
  const today = todayIso();
  if (task.date < today) return { text: "באיחור", cls: "late" };
  if (task.date === today) return { text: "היום", cls: "today" };
  if (task.date === addDays(today, 1)) return { text: "מחר", cls: "soon" };
  const d = fromIso(task.date);
  return { text: `${d.getDate()}.${d.getMonth() + 1}`, cls: task.date <= addDays(today, 7) ? "soon" : "" };
}
export function repeatLabel(repeat) {
  if (!repeat) return "";
  const n = repeat.every || 1;
  if (n === 1) return { day: "כל יום", week: "כל שבוע", month: "כל חודש" }[repeat.unit];
  return `כל ${n} ${REPEAT_UNITS[repeat.unit]}`;
}
