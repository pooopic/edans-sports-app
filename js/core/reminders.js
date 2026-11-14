"use strict";
/* התראות לאירועים ביומן — כמו בגוגל קלנדר.
   ערך של פריט (מטלה / צומת אימון): null = ברירת המחדל מההגדרות · [] = בלי · [דקות, ...] = מותאם.
   דקות = כמה לפני תחילת האירוע. באירוע "כל היום" ההתחלה היא 00:00, לכן "יום לפני ב-20:00" = 240.
   גוגל מקבל עד 5 התראות, עד 4 שבועות (40320 דקות) לפני. */
import { state } from "./state.js";

const MAX = 5, MAX_MIN = 40320;
export const DEFAULT_REMINDERS = { timed: [30], allDay: [] };

export function defaultReminders(timed) {
  const d = (state.settings && state.settings.gcalReminders) || DEFAULT_REMINDERS;
  return (timed ? d.timed : d.allDay) || [];
}
export function resolveReminders(value, timed) {
  const list = value == null ? defaultReminders(timed) : value;
  return [...new Set(list.filter((m) => m >= 0 && m <= MAX_MIN))].slice(0, MAX);
}

const UNITS = [["minutes", "דקות", 1], ["hours", "שעות", 60], ["days", "ימים", 1440], ["weeks", "שבועות", 10080]];
function splitTimed(min) {
  for (const [u, , f] of [...UNITS].reverse()) if (min && min % f === 0) return { n: min / f, unit: u };
  return { n: min, unit: "minutes" };
}
const hhmm = (m) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
function splitAllDay(min) { // → N ימים לפני, בשעה HH:MM
  const n = Math.max(1, Math.ceil(min / 1440));
  return { n, time: hhmm(n * 1440 - min) };
}
export function describeReminders(list, timed) {
  if (!list.length) return "בלי התראה";
  return list.map((m) => {
    if (!timed) { const { n, time } = splitAllDay(m); return `${n === 1 ? "יום" : n + " ימים"} לפני ב-${time}`; }
    const { n, unit } = splitTimed(m);
    if (m === 0) return "בזמן האירוע";
    return `${n} ${UNITS.find((u) => u[0] === unit)[1]} לפני`;
  }).join(" · ");
}

/* עורך התראות. allowDefault=false במסך ההגדרות (שם עורכים את ברירת המחדל עצמה).
   isTimed: פונקציה — המטלה יכולה לעבור בין "כל היום" לשעה בזמן העריכה. */
export function reminderEditor(container, value, { isTimed, allowDefault = true }) {
  let mode = value == null && allowDefault ? "default" : value && value.length ? "custom" : "none";
  let list = value && value.length ? [...value] : [];

  function render() {
    const timed = isTimed();
    container.innerHTML = "";
    container.className = "rem-editor";
    const sel = document.createElement("select");
    const opts = [];
    if (allowDefault) opts.push(["default", `ברירת מחדל (${describeReminders(defaultReminders(timed), timed)})`]);
    opts.push(["none", "בלי התראה"], ["custom", "מותאם אישית"]);
    for (const [v, t] of opts) {
      const o = document.createElement("option");
      o.value = v; o.textContent = t; o.selected = v === mode;
      sel.appendChild(o);
    }
    sel.addEventListener("change", () => {
      mode = sel.value;
      if (mode === "custom" && !list.length) list = [...(defaultReminders(timed).length ? defaultReminders(timed) : [timed ? 30 : 240])];
      render();
    });
    container.appendChild(sel);
    if (mode !== "custom") return;
    list.forEach((min, i) => {
      const row = document.createElement("div");
      row.className = "row gap rem-row";
      const num = document.createElement("input");
      num.type = "number"; num.min = timed ? 0 : 1; num.inputMode = "numeric";
      const del = document.createElement("button");
      del.className = "del-set"; del.textContent = "✕"; del.type = "button";
      del.addEventListener("click", () => { list.splice(i, 1); render(); });
      if (timed) {
        const { n, unit } = splitTimed(min);
        num.value = n;
        const u = document.createElement("select");
        for (const [v, t] of UNITS) { const o = document.createElement("option"); o.value = v; o.textContent = t; o.selected = v === unit; u.appendChild(o); }
        const upd = () => { list[i] = Math.max(0, parseInt(num.value, 10) || 0) * UNITS.find((x) => x[0] === u.value)[2]; };
        num.addEventListener("input", upd); u.addEventListener("change", upd);
        row.append(num, u, Object.assign(document.createElement("span"), { textContent: "לפני", className: "hint" }), del);
      } else {
        const { n, time } = splitAllDay(min);
        num.value = n;
        const t = document.createElement("input");
        t.type = "time"; t.value = time;
        const upd = () => {
          const days = Math.max(1, parseInt(num.value, 10) || 1);
          const [h, m] = (t.value || "09:00").split(":").map(Number);
          list[i] = days * 1440 - (h * 60 + m);
        };
        num.addEventListener("input", upd); t.addEventListener("input", upd);
        row.append(num, Object.assign(document.createElement("span"), { textContent: "ימים לפני, בשעה", className: "hint" }), t, del);
      }
      container.appendChild(row);
    });
    if (list.length < MAX) {
      const add = document.createElement("button");
      add.type = "button"; add.className = "btn small ghost"; add.textContent = "+ התראה";
      add.addEventListener("click", () => { list.push(timed ? 10 : 240); render(); });
      container.appendChild(add);
    }
  }
  render();
  return {
    rerender: render,
    get() {
      if (mode === "default") return null;
      if (mode === "none") return [];
      return [...new Set(list.filter((m) => m >= 0 && m <= MAX_MIN))].slice(0, MAX);
    },
  };
}
