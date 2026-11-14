"use strict";
/* עץ 4 — הגאנט המאוחד. שתי תצוגות של אותם נתונים:
   · שבוע (ברירת מחדל, מסך הפתיחה): מה קורה השבוע מכל העצים. במחשב רשת 7 ימים,
     בטלפון רשימת ימים. גרירה בין ימים משנה תאריך במקור.
   · 16 שבועות: הגאנט הארוך (plan.js) + פסי פרויקטים ומטלות.
   הגאנט לא שומר נתונים משלו — כל פריט מצביע לרשומה בעץ שלו. */
import { DAY_NAMES, DAY_SHORT, REST_DAY, RUN_DAYS, STRENGTH_DAYS } from "../core/constants.js";
import { addDays, fromIso, shortDate, todayIso, weekKeyOf } from "../core/dates.js";
import { registerScreen, showScreen } from "../core/nav.js";
import { proteinMin, state, view } from "../core/state.js";
import { $, escapeHtml } from "../core/ui.js";
import { fetchPrimaryEvents, gcalConnect, gcalConnected, gcalNeedsAuth, primaryEventsCached } from "../core/gcal.js";
import { dayTemplate, planNodeFor } from "../fitness/model.js";
import { ROUTINE_ID, activeLimit, activeProjects, isRoutine } from "../projects/model.js";
import { openProjectEditor, openTaskEditor } from "../projects/projects.js";
import { projectBars, projectColor, taskChip, taskOccurrences } from "./items.js";
import {
  defaultProjectId, gantt, makeNodeDraggable, openDaySchedule, openPlanEditor, planNodesAt,
  renderPlan, updatePlanUndoBtn,
} from "./plan.js";

const MODE_KEY = "edan-gantt-mode"; // העדפה מקומית למכשיר
let mode = (() => { try { return localStorage.getItem(MODE_KEY) || "week"; } catch (e) { return "week"; } })();
let weekKey = weekKeyOf(new Date());
const wide = window.matchMedia("(min-width: 700px)");

/* ---------- נתוני יום ---------- */
const FITNESS_LANES = ["strength", "run", "milestone"];

function fitnessItems(dateIso) {
  const wd = fromIso(dateIso).getDay();
  const w = state.workouts[dateIso];
  const items = [];
  for (const lane of FITNESS_LANES) {
    for (const node of planNodesAt(lane, dateIso)) {
      const chip = document.createElement("span");
      chip.className = `gantt-node lane-${lane}` + (lane === "milestone" ? " milestone" : "") +
        (lane !== "milestone" && w && w.done ? " done-node" : "");
      chip.textContent = (node.time ? node.time + " " : "") + node.label;
      chip.title = node.label + " — גרור ליום אחר, הקש לעריכה";
      makeNodeDraggable(chip, node, true);
      items.push(chip);
    }
  }
  // יום אימון לפי המבנה הקבוע, בלי צומת בתכנון — פריט "רפאים" שפותח את יום האימון
  const hasTraining = planNodesAt("strength", dateIso).length || planNodesAt("run", dateIso).length;
  const isTrainingDay = STRENGTH_DAYS.includes(wd) || RUN_DAYS.includes(wd) || planNodeFor(dateIso);
  if (!hasTraining && isTrainingDay) {
    const tpl = dayTemplate(dateIso);
    const chip = document.createElement("span");
    chip.className = "gantt-node ghost-node" + (w && w.done ? " done-node" : "");
    chip.textContent = (STRENGTH_DAYS.includes(wd) ? "💪 " : "🏃 ") + (tpl ? tpl.name : "אימון");
    chip.title = "פתח את יום האימון";
    chip.addEventListener("click", (e) => { e.stopPropagation(); openWorkoutDay(dateIso); });
    items.push(chip);
  } else if (wd === REST_DAY && !items.length) {
    const rest = document.createElement("span");
    rest.className = "wk-muted";
    rest.textContent = "😴 מנוחה";
    items.push(rest);
  }
  if (w && w.done) {
    const done = document.createElement("span");
    done.className = "wk-done";
    done.textContent = "✓ בוצע";
    items.push(done);
  }
  return items;
}

function foodItems(dateIso) {
  const items = [];
  const week = state.weeks[weekKeyOf(fromIso(dateIso))]; // לא יוצרים שבוע תפריט רק מצפייה
  const day = week && week.days[fromIso(dateIso).getDay()];
  if (day) {
    const list = day.items || [];
    const eaten = Math.round(list.reduce((a, i) => a + (i.eaten && i.protein != null ? i.protein : 0), 0));
    const planned = day.protein || 0;
    const el = document.createElement("span");
    const past = dateIso < todayIso();
    const val = past || dateIso === todayIso() ? eaten : planned;
    el.className = "wk-food " + (planned >= proteinMin() ? "ok" : "short");
    el.textContent = dateIso <= todayIso() ? `${eaten}/${planned} ג׳` : `${planned} ג׳ מתוכנן`;
    el.title = `חלבון: נאכל ${eaten} · מתוכנן ${planned} · יעד ${proteinMin()}${val >= proteinMin() ? " ✓" : ""}`;
    items.push(el);
    if (day.fast) {
      const f = document.createElement("span");
      f.className = "fast-badge";
      f.textContent = "16:8";
      items.push(f);
    }
  }
  for (const node of planNodesAt("food", dateIso)) {
    const chip = document.createElement("span");
    chip.className = "gantt-node lane-food";
    chip.textContent = node.label;
    makeNodeDraggable(chip, node, true);
    items.push(chip);
  }
  return items;
}

/* שכבת היומן הראשי — אפור, קריאה בלבד. הקשה פותחת את האירוע בגוגל קלנדר */
let calEvents = null;
function calendarItems(dateIso) {
  return (calEvents || []).filter((e) => e.date === dateIso).map((e) => {
    const a = document.createElement("a");
    a.className = "gcal-chip";
    a.href = e.link || "#";
    a.target = "_blank";
    a.rel = "noopener";
    a.innerHTML = (e.time ? `<b>${e.time}</b> ` : "") + escapeHtml(e.title);
    a.title = e.title + " (יומן גוגל)";
    a.addEventListener("click", (ev) => ev.stopPropagation());
    return a;
  });
}

/* ---------- פעולות ---------- */
function openWorkoutDay(dateIso) { view.workoutDate = dateIso; showScreen("workout"); }
function openMenuWeek(dateIso) { view.weekKey = weekKeyOf(fromIso(dateIso)); showScreen("menu"); }
const rerender = () => gantt.rerender();
const CAL_LANE = { id: "calendar", label: "📅 יומן", items: calendarItems, onEmpty: () => {} };
const LANES = [
  { id: "fitness", label: "🏋️ כושר", items: fitnessItems, onEmpty: (d) => openPlanEditor(null, d, STRENGTH_DAYS.includes(fromIso(d).getDay()) ? "strength" : "run") },
  { id: "food", label: "🍽️ תזונה", items: foodItems, onEmpty: openMenuWeek },
  { id: "projects", label: "📁 פרויקטים", items: null, onEmpty: (d) => openTaskEditor(null, defaultProjectId(), rerender, d) },
  { id: "routine", label: "🔁 שוטף", items: null, onEmpty: (d) => openTaskEditor(null, ROUTINE_ID, rerender, d) },
];

/* ---------- פוקוס: הפרויקטים הפעילים והצעד הבא של כל אחד ---------- */
function renderFocus(occ) {
  const box = $("#wk-focus");
  box.innerHTML = "";
  const active = activeProjects();
  const today = todayIso();
  const late = occ.filter((o) => o.overdue).length;
  const tasksCount = occ.filter((o) => !o.projected && !o.done).length;
  const head = document.createElement("div");
  head.className = "wk-focus-head";
  head.innerHTML = `<b>🎯 פוקוס</b> <span class="hint" style="margin:0;">${active.length} פעילים · ${tasksCount} מטלות השבוע${late ? ` · <span class="late">${late} באיחור</span>` : ""}</span>`;
  box.appendChild(head);
  if (gcalNeedsAuth()) {
    const b = document.createElement("button");
    b.className = "btn small wk-reauth";
    b.textContent = "📅 החיבור ליומן גוגל פג — התחבר מחדש";
    b.addEventListener("click", async () => { await gcalConnect(); renderWeek(); });
    box.appendChild(b);
  }
  if (activeLimit() && active.length > activeLimit()) {
    box.insertAdjacentHTML("beforeend", `<div class="wk-warn">⚠️ ${active.length} פעילים — מעל המגבלה שהגדרת (${activeLimit()}).</div>`);
  }
  if (!active.length) {
    box.insertAdjacentHTML("beforeend", '<div class="hint" style="margin:4px 0 0;">אין פרויקטים פעילים. סמן פרויקטים כ"פעיל" בעץ 📁 פרויקטים.</div>');
    return;
  }
  const list = document.createElement("div");
  list.className = "wk-focus-list";
  for (const p of active) {
    const b = document.createElement("button");
    b.className = "wk-focus-item";
    b.style.setProperty("--pc", projectColor(p));
    const due = p.end ? ` · יעד ${shortDate(p.end)}${p.end < today ? " ⚠️" : ""}` : "";
    b.innerHTML = `<span class="wk-focus-name">${escapeHtml(p.name)}${due}</span>` +
      `<span class="wk-focus-next ${p.nextStep ? "" : "missing"}">👉 ${p.nextStep ? escapeHtml(p.nextStep) : "אין צעד הבא"}</span>`;
    b.addEventListener("click", () => openProjectEditor(p.id, rerender));
    list.appendChild(b);
  }
  box.appendChild(list);
}

/* ---------- תצוגת שבוע ---------- */
function renderWeek() {
  const from = weekKey, to = addDays(weekKey, 6);
  const today = todayIso();
  $("#wk-label").textContent = `${shortDate(from)} – ${shortDate(to)}` + (from === weekKeyOf(new Date()) ? " · השבוע" : "");
  const occ = taskOccurrences(from, to);
  renderFocus(occ.filter((o) => !isRoutine(o.proj)));
  const occAt = (date, routine) => occ.filter((o) => o.date === date && isRoutine(o.proj) === routine)
    .sort((a, b) => (b.overdue ? 1 : 0) - (a.overdue ? 1 : 0));
  const itemsFor = (lane, date) => lane.items ? lane.items(date) : occAt(date, lane.id === "routine").map(taskChip);
  const days = Array.from({ length: 7 }, (_, i) => addDays(from, i));
  // יומן גוגל: מציגים מהמטמון מיד, ומושכים ברקע; כשמגיע — מרנדרים שוב (אם עדיין באותו שבוע)
  const lanes = gcalConnected() ? [CAL_LANE, ...LANES] : LANES;
  calEvents = primaryEventsCached(from, to);
  if (gcalConnected() && !gcalNeedsAuth()) {
    fetchPrimaryEvents(from, to).then((ev) => {
      if (ev && ev !== calEvents && weekKey === from && mode === "week") { calEvents = ev; renderWeek(); }
    });
  }
  const host = $("#wk-grid");
  host.innerHTML = "";
  host.className = wide.matches ? "wk-grid" : "wk-agenda";
  if (wide.matches) renderGrid(host, lanes, days, today, itemsFor, projectBars(from, to));
  else renderAgenda(host, lanes, days, today, itemsFor);
}

function dayHead(date, today) {
  const wd = fromIso(date).getDay();
  const h = document.createElement("div");
  h.className = "wk-head" + (date === today ? " today" : "") + (date < today ? " past" : "");
  const note = state.plan && state.plan.notes && state.plan.notes[date] ? " 📝" : "";
  h.innerHTML = `<span class="wk-dayname">${wide.matches ? DAY_SHORT[wd] : DAY_NAMES[wd]}</span><span class="wk-date">${shortDate(date)}${note}</span>`;
  h.title = "סדר יום, הסבר והערות";
  h.addEventListener("click", () => openDaySchedule(date));
  return h;
}
function dropCell(date, lane, cls) {
  const c = document.createElement("div");
  c.className = cls + " drop-zone";
  c.dataset.date = date;
  c.addEventListener("click", () => lane.onEmpty(date));
  return c;
}

function renderGrid(host, lanes, days, today, itemsFor, bars) {
  let row = 1;
  const place = (el, r, col, span) => {
    el.style.gridRow = String(r);
    el.style.gridColumn = span ? `${col} / span ${span}` : String(col);
    host.appendChild(el);
  };
  place(document.createElement("div"), row, 1);
  days.forEach((d, i) => place(dayHead(d, today), row, i + 2));
  row++;
  for (const lane of lanes) {
    const laneBars = lane.id === "projects" ? bars : [];
    const label = document.createElement("div");
    label.className = "wk-label";
    label.textContent = lane.label;
    label.style.gridRow = `${row} / span ${1 + laneBars.length}`;
    label.style.gridColumn = "1";
    host.appendChild(label);
    // פסי פרויקטים — שורה לכל פרויקט, נחתכים לגבולות השבוע
    for (const b of laneBars) {
      const s = Math.max(0, days.indexOf(b.start) >= 0 ? days.indexOf(b.start) : 0);
      const e = days.indexOf(b.end) >= 0 ? days.indexOf(b.end) : 6;
      const bar = document.createElement("button");
      bar.className = "wk-bar" + (b.start < days[0] ? " cont-start" : "") + (b.end > days[6] ? " cont-end" : "");
      bar.style.setProperty("--pc", projectColor(b.p));
      bar.textContent = b.p.name + (b.p.nextStep ? ` · 👉 ${b.p.nextStep}` : "");
      bar.title = `${b.p.name}: ${b.start} → ${b.end}`;
      bar.addEventListener("click", () => openProjectEditor(b.p.id, rerender));
      place(bar, row, s + 2, e - s + 1);
      row++;
    }
    days.forEach((d, i) => {
      const cell = dropCell(d, lane, "wk-cell" + (d === today ? " today" : "") + (d < today ? " past" : ""));
      for (const it of itemsFor(lane, d)) cell.appendChild(it);
      place(cell, row, i + 2);
    });
    row++;
  }
}

function renderAgenda(host, lanes, days, today, itemsFor) {
  for (const d of days) {
    const card = document.createElement("div");
    card.className = "card wk-day" + (d === today ? " today" : "") + (d < today ? " past" : "");
    card.appendChild(dayHead(d, today));
    for (const lane of lanes) {
      const items = itemsFor(lane, d);
      if (lane.id === "calendar" && !items.length) continue; // בטלפון: שורת יומן רק כשיש בה משהו
      const line = dropCell(d, lane, "wk-line");
      const lbl = document.createElement("span");
      lbl.className = "wk-line-label";
      lbl.textContent = lane.label.split(" ")[0];
      lbl.title = lane.label;
      line.appendChild(lbl);
      const body = document.createElement("div");
      body.className = "wk-line-items";
      if (items.length) for (const it of items) body.appendChild(it);
      else body.innerHTML = '<span class="wk-add">+</span>';
      line.appendChild(body);
      card.appendChild(line);
    }
    host.appendChild(card);
  }
  // בטלפון: גלילה ליום של היום בפתיחה
  const t = host.querySelector(".wk-day.today");
  if (t && weekKey === weekKeyOf(new Date())) setTimeout(() => t.scrollIntoView({ block: "start", behavior: "smooth" }), 50);
}

/* ---------- מעטפת: מצב, ניווט, רישום ---------- */
function renderGantt() {
  $$mode();
  updatePlanUndoBtn();
  if (mode === "week") renderWeek();
  else renderPlan();
}
function $$mode() {
  $("#gantt-mode-week").classList.toggle("active", mode === "week");
  $("#gantt-mode-long").classList.toggle("active", mode === "long");
  $("#wk-view").classList.toggle("hidden", mode !== "week");
  $("#wk-nav").classList.toggle("hidden", mode !== "week");
  $("#long-view").classList.toggle("hidden", mode !== "long");
}
function setMode(m) {
  mode = m;
  try { localStorage.setItem(MODE_KEY, m); } catch (e) {}
  renderGantt();
}
$("#gantt-mode-week").addEventListener("click", () => setMode("week"));
$("#gantt-mode-long").addEventListener("click", () => setMode("long"));
$("#wk-prev").addEventListener("click", () => { weekKey = addDays(weekKey, -7); renderWeek(); });
$("#wk-next").addEventListener("click", () => { weekKey = addDays(weekKey, 7); renderWeek(); });
$("#wk-today").addEventListener("click", () => { weekKey = weekKeyOf(new Date()); renderWeek(); });
wide.addEventListener("change", () => { if (!$("#screen-plan").classList.contains("hidden") && mode === "week") renderWeek(); });

gantt.rerender = renderGantt;
registerScreen("plan", renderGantt);
