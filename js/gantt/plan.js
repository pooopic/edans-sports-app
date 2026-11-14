"use strict";
import { registerScreen, showScreen } from "../core/nav.js";
import { DAY_NAMES, DAY_SHORT, REST_DAY, RUN_DAYS, STRENGTH_DAYS } from "../core/constants.js";
import { addDays, fromIso, shortDate, todayIso, weekKeyOf } from "../core/dates.js";
import { mealById, mealProtein, newId } from "../core/model.js";
import { proteinMax, proteinMin, save, state, view } from "../core/state.js";
import { $, escapeHtml } from "../core/ui.js";
import { dayTemplate, planNodeFor, rwkById, templateById } from "../fitness/model.js";
import { ensureWeek } from "../nutrition/model.js";

/* ============================ מסך תכנון (גאנט) ============================ */

export const PLAN_WEEKS = 12;
export const PLAN_PAST_WEEKS = 4; // היסטוריה: מציגים גם שבועות שעברו — לצפייה ועריכה
export const PLAN_LANES = [
  { id: "strength", label: "💪 כוח" },
  { id: "run", label: "🏃 ריצה" },
  { id: "food", label: "🍽️ ארוחות" },
  { id: "milestone", label: "🎯 יעדים" },
  { id: "body", label: "⚖️ גוף" },
  { id: "insight", label: "📝 הסבר" },
];

/* תקציר יומי לשורת ההסבר בגאנט: מה קורה ביום ואיך זה מקדם את היעד */
export function dayGist(dateIso) {
  const wd = fromIso(dateIso).getDay();
  const runNode = state.plan.nodes.find((n) => n.lane === "run" && n.date === dateIso);
  const label = runNode ? (runNode.label || "") : "";
  const milestone = state.plan.nodes.find((n) => n.lane === "milestone" && n.date === dateIso);
  let g;
  if (/מירוץ/.test(label)) g = "🏁 יום מירוץ — הכל התכנס לכאן";
  else if (/מבחן/.test(label)) g = "מדידת התקדמות וכיול קצבים";
  else if (wd === REST_DAY) g = "מנוחה — כאן השרירים נבנים";
  else if (STRENGTH_DAYS.includes(wd)) g = "כוח: עוד צעד ליעד 7 מתח";
  else if (/אינטרוול/.test(label)) g = "VO2max ↑ — הדרך לסאב-50";
  else if (/טמפו/.test(label)) g = "להחזיק קצב מירוץ לאורך זמן";
  else if (/טייפר/.test(label)) g = "טייפר — מגיעים טריים למירוץ";
  else if (RUN_DAYS.includes(wd)) g = "בסיס אירובי Z2 + ליבה";
  else g = "";
  if (milestone && !/מירוץ|מבחן/.test(label)) g = "🎯 " + milestone.label + (g ? " · " + g : "");
  if (wd === 0) g += " · ⚖️ מדידה";
  const note = state.plan.notes && state.plan.notes[dateIso];
  return note ? "📝 " + g : g;
}

export function planNodesAt(lane, dateIso) {
  return state.plan.nodes
    .filter((n) => n.lane === lane && n.date === dateIso)
    .sort((a, b) => (a.time || "99:99").localeCompare(b.time || "99:99"));
}

export function renderPlan() {
  if (!state.plan) state.plan = { nodes: [] };
  const gantt = $("#gantt");
  gantt.innerHTML = "";
  const start = addDays(weekKeyOf(new Date()), -PLAN_PAST_WEEKS * 7);
  const totalDays = (PLAN_PAST_WEEKS + PLAN_WEEKS) * 7;
  const today = todayIso();
  const bodyByDate = {};
  for (const e of state.body || []) bodyByDate[e.date] = e;

  // שורת כותרת: יום ותאריך
  const head = document.createElement("div");
  head.className = "gantt-row";
  const headLabel = document.createElement("div");
  headLabel.className = "gantt-label";
  headLabel.textContent = "";
  head.appendChild(headLabel);
  for (let i = 0; i < totalDays; i++) {
    const dateIso = addDays(start, i);
    const wd = fromIso(dateIso).getDay();
    const cell = document.createElement("div");
    cell.className = "gantt-cell head" + (dateIso === today ? " today" : "") + (wd === 0 ? " weekstart" : "") + (dateIso < today ? " past" : "");
    cell.innerHTML = `<span>${DAY_SHORT[wd]}</span><span class="day-num">${shortDate(dateIso)}</span>`;
    if (state.plan.notes && state.plan.notes[dateIso]) {
      cell.innerHTML += '<span class="sched-note-mark">📝</span>';
      cell.title = state.plan.notes[dateIso];
    } else {
      cell.title = "סדר יום, הסבר והערות";
    }
    cell.addEventListener("click", () => openDaySchedule(dateIso));
    head.appendChild(cell);
  }
  gantt.appendChild(head);

  for (const lane of PLAN_LANES) {
    const row = document.createElement("div");
    row.className = "gantt-row";
    const label = document.createElement("div");
    label.className = "gantt-label";
    label.textContent = lane.label;
    row.appendChild(label);

    for (let i = 0; i < totalDays; i++) {
      const dateIso = addDays(start, i);
      const wd = fromIso(dateIso).getDay();
      const cell = document.createElement("div");
      cell.className = "gantt-cell" + (dateIso === today ? " today" : "") + (wd === 0 ? " weekstart" : "") + (dateIso < today ? " past" : "");

      if (lane.id === "body") {
        const e = bodyByDate[dateIso];
        if (e) {
          const v = document.createElement("span");
          v.className = "gantt-val";
          v.textContent = e.weight ? Math.round(e.weight) : "•";
          cell.appendChild(v);
        }
      } else if (lane.id === "insight") {
        cell.classList.add("insight");
        cell.textContent = dayGist(dateIso);
        cell.title = "לחיצה — סדר יום, הסבר מלא והערה אישית";
        cell.addEventListener("click", () => openDaySchedule(dateIso));
      } else {
        // שכבה אוטומטית: מה מתוכנן לפי היום בשבוע + מה בוצע בפועל.
        // נקודה אפורה רק כשאין צומת ביום — צומת מייצג את האימון בעצמו.
        const w = state.workouts[dateIso];
        const nodesHere = planNodesAt(lane.id, dateIso);
        const isLaneDay = lane.id === "strength" ? STRENGTH_DAYS.includes(wd)
          : lane.id === "run" ? RUN_DAYS.includes(wd) : false;
        if (lane.id === "run" && w && w.run && w.run.km > 0) {
          const v = document.createElement("span");
          v.className = "gantt-val";
          v.textContent = `${w.run.km}ק`;
          cell.appendChild(v);
        } else if (isLaneDay && !nodesHere.length) {
          const dot = document.createElement("span");
          dot.className = "gantt-dot" + (w && w.done ? " done" : "");
          cell.appendChild(dot);
        }
        cell.dataset.date = dateIso;
        cell.dataset.lane = lane.id;
        // צמתים משובצים — גרירה מזיזה, הקשה קצרה עורכת
        for (const node of nodesHere) {
          const chip = document.createElement("span");
          chip.className = "gantt-node lane-" + lane.id + (lane.id === "milestone" ? " milestone" : "") +
            (w && w.done ? " done-node" : "");
          if (node.time) {
            const t = document.createElement("span");
            t.className = "node-time";
            t.textContent = node.time + " ";
            chip.appendChild(t);
          }
          chip.appendChild(document.createTextNode(node.label));
          chip.title = (node.time ? node.time + " · " : "") + node.label + " — גרור להזזה, הקש לעריכה";
          makeNodeDraggable(chip, node);
          cell.appendChild(chip);
        }
        cell.addEventListener("click", () => openPlanEditor(null, dateIso, lane.id));
      }
      row.appendChild(cell);
    }
    gantt.appendChild(row);
  }

  drawPlanEdges(gantt);
  updatePlanUndoBtn();

  // גלילה כך שהיום צמוד לקצה הימני (RTL) — העבר נגלל החוצה ימינה, העתיד נפרש שמאלה
  const wrap = gantt.parentElement;
  const todayCell = gantt.querySelector(".gantt-cell.head.today");
  if (todayCell) {
    const wr = wrap.getBoundingClientRect();
    const tr = todayCell.getBoundingClientRect();
    const label = gantt.querySelector(".gantt-label");
    const lw = label ? label.getBoundingClientRect().width : 0; // התווית דביקה בימין ומכסה את הקצה
    wrap.scrollLeft += tr.right - (wr.right - lw - 6);
  } else {
    wrap.scrollLeft = wrap.scrollWidth;
  }
}

/* קווי חיבור בין צמתים עוקבים באותו מסלול — כמו בתרשים זרימה:
   רואים מה מוביל למה (אינטרוולים ← טמפו ← מבחן). מצויר כ-SVG מעל הרשת. */
export function drawPlanEdges(gantt) {
  const old = gantt.querySelector(".plan-edges");
  if (old) old.remove();
  const firstRow = gantt.querySelector(".gantt-row");
  if (!firstRow) return;
  const NS = "http://www.w3.org/2000/svg";
  const gr = gantt.getBoundingClientRect();
  const rowR = firstRow.getBoundingClientRect(); // השורות רחבות מה-wrap — הרוחב האמיתי נמדד מהשורה
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("class", "plan-edges");
  svg.setAttribute("width", rowR.width);
  svg.setAttribute("height", gr.height);
  svg.style.right = "0";
  const colors = { run: "#38b6ff", strength: "#f2635c", food: "#4cd08a", milestone: "#e8c35a" };
  const ox = rowR.left, oy = gr.top;
  const diamond = (x, y, color) => {
    const d = document.createElementNS(NS, "path");
    d.setAttribute("d", `M ${x} ${y - 3.5} L ${x + 3.5} ${y} L ${x} ${y + 3.5} L ${x - 3.5} ${y} Z`);
    d.setAttribute("fill", "#0e1116");
    d.setAttribute("stroke", color);
    d.setAttribute("stroke-width", "1.5");
    svg.appendChild(d);
  };
  for (const lane of ["strength", "run", "food", "milestone"]) {
    const chips = [...gantt.querySelectorAll(`.gantt-cell[data-lane="${lane}"] .gantt-node`)]
      .sort((a, b) => a.closest(".gantt-cell").dataset.date.localeCompare(b.closest(".gantt-cell").dataset.date));
    for (let i = 0; i + 1 < chips.length; i++) {
      const r1 = chips[i].getBoundingClientRect(), r2 = chips[i + 1].getBoundingClientRect();
      // RTL: המוקדם מימין — מחברים את הצלע השמאלית שלו לצלע הימנית של הבא
      const x1 = r1.left - ox, y1 = r1.top - oy + r1.height / 2;
      const x2 = r2.right - ox, y2 = r2.top - oy + r2.height / 2;
      const line = document.createElementNS(NS, "line");
      line.setAttribute("x1", x1); line.setAttribute("y1", y1);
      line.setAttribute("x2", x2); line.setAttribute("y2", y2);
      line.setAttribute("stroke", colors[lane] || "#666");
      line.setAttribute("stroke-width", "2");
      line.setAttribute("opacity", "0.75");
      svg.appendChild(line);
      diamond(x1, y1, colors[lane]);
      diamond(x2, y2, colors[lane]);
    }
  }
  gantt.appendChild(svg);
}

/* ביטול (Undo) לשינויים בתכנון: לפני כל שינוי נשמר צילום מקומי של הצמתים */
export const PLAN_UNDO_KEY = "edan-plan-undo";
export function planUndoStack() {
  try { return JSON.parse(localStorage.getItem(PLAN_UNDO_KEY)) || []; } catch (e) { return []; }
}
export function pushPlanUndo() {
  try {
    const stack = planUndoStack();
    stack.push(JSON.stringify(state.plan.nodes));
    while (stack.length > 15) stack.shift();
    localStorage.setItem(PLAN_UNDO_KEY, JSON.stringify(stack));
  } catch (e) {}
  updatePlanUndoBtn();
}
export function updatePlanUndoBtn() {
  const btn = $("#plan-undo");
  if (btn) btn.disabled = planUndoStack().length === 0;
}
$("#plan-undo").addEventListener("click", () => {
  const stack = planUndoStack();
  if (!stack.length) return;
  state.plan.nodes = JSON.parse(stack.pop());
  try { localStorage.setItem(PLAN_UNDO_KEY, JSON.stringify(stack)); } catch (e) {}
  save();
  renderPlan();
  updatePlanUndoBtn();
});

document.addEventListener("keydown", (e) => {
  // Ctrl+Z במסך התכנון (כשלא מקלידים בשדה) — ביטול השינוי האחרון
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" &&
      !$("#screen-plan").classList.contains("hidden") &&
      !/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) {
    e.preventDefault();
    $("#plan-undo").click();
  }
});

/* גרירת צומת בין תאים. עכבר: תזוזה מעל 8px = גרירה, אחרת עריכה.
   מגע (טלפון): גרירה רק אחרי לחיצה ארוכה (350ms, עם רטט) — מגע קצר תוך כדי
   גלילה לא מזיז יותר צמתים בטעות; הקשה קצרה עדיין פותחת עריכה. */
export function makeNodeDraggable(chip, node) {
  chip.addEventListener("click", (e) => e.stopPropagation());
  chip.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    e.stopPropagation();
    chip.setPointerCapture(e.pointerId);
    const isTouch = e.pointerType === "touch";
    const startX = e.clientX, startY = e.clientY;
    let dragging = false, dragArmed = !isTouch, targetCell = null, moved = false;
    let holdTimer = null;
    if (isTouch) {
      holdTimer = setTimeout(() => {
        if (moved) return; // האצבע כבר זזה — זו הייתה גלילה/החלקה, לא אחיזה
        dragArmed = true;
        dragging = true;
        chip.classList.add("dragging-node");
        if (navigator.vibrate) navigator.vibrate(30);
      }, 350);
    }
    const move = (ev) => {
      const dist = Math.hypot(ev.clientX - startX, ev.clientY - startY);
      if (dist > 10) moved = true;
      if (!dragging && dragArmed && dist > 8) {
        dragging = true;
        chip.classList.add("dragging-node");
      }
      if (!dragging) return;
      const el = document.elementFromPoint(ev.clientX, ev.clientY);
      const cell = el && el.closest ? el.closest(".gantt-cell[data-date]") : null;
      if (targetCell && targetCell !== cell) targetCell.classList.remove("drop-target");
      targetCell = cell;
      if (cell) cell.classList.add("drop-target");
    };
    const finish = () => {
      clearTimeout(holdTimer);
      chip.removeEventListener("pointermove", move);
      chip.classList.remove("dragging-node");
      if (targetCell) targetCell.classList.remove("drop-target");
      if (dragging && targetCell && (targetCell.dataset.date !== node.date || targetCell.dataset.lane !== node.lane)) {
        pushPlanUndo();
        node.date = targetCell.dataset.date;
        node.lane = targetCell.dataset.lane;
        save();
        renderPlan();
      } else if (!dragging && !moved) {
        openPlanEditor(node.id, node.date, node.lane);
      } else if (dragging) {
        renderPlan(); // גרירה שלא ננחתה על תא — חוזרים למקום
      }
    };
    chip.addEventListener("pointermove", move);
    chip.addEventListener("pointerup", finish, { once: true });
    chip.addEventListener("pointercancel", finish, { once: true });
  });
}

/* ---- סדר יום: לחיצה על תאריך בכותרת הגאנט מציגה את היום עם שעות ---- */
export function addMinutes(hhmm, delta) {
  const [h, m] = (hhmm || "07:00").split(":").map(Number);
  const t = ((h * 60 + m + delta) % 1440 + 1440) % 1440;
  return String(Math.floor(t / 60)).padStart(2, "0") + ":" + String(t % 60).padStart(2, "0");
}
/* הסבר אוטומטי ליום: מה הוא מקדם ולמה — נגזר מהמבנה, מהתכנון ומהתפריט */
export function dayInsight(dateIso) {
  const wd = fromIso(dateIso).getDay();
  const parts = [];
  const runNode = state.plan.nodes.find((n) => n.lane === "run" && n.date === dateIso);
  const label = runNode ? runNode.label : "";
  if (wd === REST_DAY && !planNodeFor(dateIso)) {
    parts.push("😴 מנוחה מלאה — כאן השרירים נבנים בפועל; שינה טובה שווה אימון.");
  } else if (STRENGTH_DAYS.includes(wd)) {
    const tpl = dayTemplate(dateIso);
    parts.push(`💪 ${tpl ? tpl.name : "כוח"}: מתח + משקולות — מקדם את יעד המתח (7 חזרות מלאות). חוק המשתנה האחד: מוסיפים רק דבר אחד לעומת האימון הקודם.`);
  } else if (RUN_DAYS.includes(wd)) {
    if (/אינטרוול/.test(label)) parts.push("🏃 אינטרוולים: מעלים VO2max ומהירות — הצעד המרכזי בדרך ל-10K מהיר. קשה, קצר, שווה.");
    else if (/טמפו/.test(label)) parts.push("🏃 טמפו: מלמד את הגוף להחזיק קצב מירוץ לאורך זמן — הגשר בין בסיס למהירות.");
    else if (/מבחן|10K|5K/i.test(label)) parts.push("🎯 יום מבחן: מודדים התקדמות ומכיילים מחדש את אזורי הקצב.");
    else parts.push("🏃 ריצה קלה Z2 + ליבה: בונה בסיס אירובי בלי שחיקה; הליבה מייצבת את הריצה ואת הגב.");
  }
  if (wd === 0) parts.push("⚖️ ראשון = מדידה שבועית לפני האימון — מגמה חשובה יותר מכל מדידה בודדת.");
  const wk = weekKeyOf(fromIso(dateIso));
  // שבוע עתידי שטרם נפתח בתפריט — נוצר מהתבנית (כמו בניווט בתפריט); עבר לא נוצר רטרואקטיבית
  const week = wk >= weekKeyOf(new Date()) ? ensureWeek(wk) : state.weeks[wk];
  const day = week && week.days[wd];
  if (day) {
    parts.push(`🍽️ תזונה: מתוכננים ~${day.protein || 0} ג׳ חלבון (יעד ${proteinMin()}–${proteinMax()})${day.fast ? " · צום 16:8" : ""}.`);
  }
  return parts;
}

export let schedDate = null;
export function openDaySchedule(dateIso) {
  schedDate = dateIso;
  const wd = fromIso(dateIso).getDay();
  $("#sched-title").textContent = `יום ${DAY_NAMES[wd]} · ${shortDate(dateIso)}`;
  const wt = state.settings.workoutTime || "07:00";
  const dur = state.settings.workoutDur || 45;
  const timed = [];
  const untimed = [];

  // מדידות — לפי תזכורות היומן (לפני האימון של ראשון)
  if (wd === 0) {
    if (parseInt(dateIso.slice(8), 10) <= 7) timed.push({ t: addMinutes(wt, -15), text: "📸 תמונות התקדמות (חודשי)" });
    timed.push({ t: addMinutes(wt, -10), text: "⚖️ מדידה שבועית — משקל, מותן, דופק, לחץ דם" });
  }

  // האימון של היום (שבת = מנוחה, אלא אם שובץ אימון בתכנון)
  const planNode = planNodeFor(dateIso);
  if (wd !== REST_DAY || planNode) {
    const tpl = dayTemplate(dateIso);
    const icon = STRENGTH_DAYS.includes(wd) ? "💪" : "🏃";
    timed.push({ t: wt, end: addMinutes(wt, dur), text: `${icon} אימון: ${tpl ? tpl.name : ""}` });
  } else {
    untimed.push({ text: "😴 שבת — מנוחה מלאה" });
  }

  // צמתים מהתכנון של אותו יום
  for (const n of (state.plan ? state.plan.nodes : []).filter((n) => n.date === dateIso)) {
    if (n.templateId && planNode && n.id === planNode.id) continue; // כבר מיוצג כאימון של היום
    const icon = { food: "🍽️", milestone: "🎯", run: "🏃", strength: "💪" }[n.lane] || "📌";
    (n.time ? timed : untimed).push({ t: n.time, text: `${icon} ${n.label}` });
  }

  // הארוחות מהתפריט של אותו יום (בלי שעות — לפי סדר היום בתפריט)
  const week = state.weeks[weekKeyOf(fromIso(dateIso))];
  const day = week && week.days[wd];
  for (const it of (day && day.items) || []) {
    if (it.fromPlan) continue; // כבר מופיע כצומת תכנון
    untimed.push({ text: `🍽️ ${it.label}${it.text ? ": " + it.text : ""}${it.protein != null ? ` (${it.protein} ג׳)` : ""}` });
  }

  timed.sort((a, b) => a.t.localeCompare(b.t));
  const listEl = $("#sched-list");
  listEl.innerHTML = "";
  const addRow = (timeText, text, noTime) => {
    const row = document.createElement("div");
    row.className = "sched-row";
    row.innerHTML = `<span class="sched-time${noTime ? " none" : ""}">${timeText}</span><span>${escapeHtml(text)}</span>`;
    listEl.appendChild(row);
  };
  for (const r of timed) addRow(r.end ? `${r.t}–${r.end}` : r.t, r.text);
  for (const r of untimed) addRow("—", r.text, true);
  if (!timed.length && !untimed.length) listEl.innerHTML = '<p class="hint">אין כלום ביום הזה.</p>';
  $("#sched-insight").innerHTML = dayInsight(dateIso).map((p) => `<div style="margin:4px 0;">${escapeHtml(p)}</div>`).join("");
  $("#sched-note").value = (state.plan.notes && state.plan.notes[dateIso]) || "";
  $("#sched-modal").classList.remove("hidden");
}
$("#sched-note").addEventListener("change", () => {
  if (!schedDate) return;
  if (!state.plan.notes) state.plan.notes = {};
  const v = $("#sched-note").value.trim();
  if (v) state.plan.notes[schedDate] = v;
  else delete state.plan.notes[schedDate];
  save();
  renderPlan(); // מעדכן את סימון ה-📝 בכותרת היום
});
$("#sched-cancel").addEventListener("click", () => $("#sched-modal").classList.add("hidden"));
$("#sched-open-day").addEventListener("click", () => {
  if (!schedDate) return;
  $("#sched-modal").classList.add("hidden");
  view.workoutDate = schedDate;
  showScreen("workout");
  window.scrollTo({ top: 0 });
});

export let editingPlanNodeId = null;
/* מסלול ארוחות בוחר ארוחה מהמאגר; שאר המסלולים — אימון מהמאגר */
export function fillPlanSourceSelect(lane, node) {
  const sel = $("#plan-template");
  sel.innerHTML = '<option value="">—</option>';
  const isFood = lane === "food", isRun = lane === "run";
  $("#plan-source-label").textContent = isFood
    ? "ארוחה מהמאגר — תתווסף אוטומטית לתפריט השבועי של אותו יום"
    : isRun
      ? "אימון ריצה מהבנאי (לא חובה — יוצג בלוג של אותו יום)"
      : "אימון מהמאגר (לא חובה — ייפתח בלוג באותו יום)";
  const src = isFood ? state.meals : isRun ? (state.runWorkouts || []) : state.workoutTemplates;
  for (const t of src) {
    const opt = document.createElement("option");
    opt.value = t.id;
    opt.textContent = isFood ? `${t.name} (${mealProtein(t)} ג׳ חלבון)` : t.name;
    if (node && (node.templateId === t.id || node.mealId === t.id || node.runWorkoutId === t.id)) opt.selected = true;
    sel.appendChild(opt);
  }
}
export function openPlanEditor(nodeId, dateIso, lane) {
  editingPlanNodeId = nodeId;
  const node = nodeId ? state.plan.nodes.find((n) => n.id === nodeId) : null;
  $("#plan-modal-title").textContent = node ? "עריכת צומת" : "שיבוץ בתכנון";
  $("#plan-date").value = node ? node.date : dateIso;
  $("#plan-lane").value = node ? node.lane : lane;
  fillPlanSourceSelect(node ? node.lane : lane, node);
  $("#plan-label").value = node ? node.label : "";
  $("#plan-time").value = node && node.time ? node.time : "";
  $("#plan-delete").classList.toggle("hidden", !node);
  $("#plan-modal").classList.remove("hidden");
}
$("#plan-lane").addEventListener("change", () => {
  const node = editingPlanNodeId ? state.plan.nodes.find((n) => n.id === editingPlanNodeId) : null;
  fillPlanSourceSelect($("#plan-lane").value, node);
});
$("#plan-template").addEventListener("change", () => {
  const id = $("#plan-template").value;
  const lane = $("#plan-lane").value;
  const src = lane === "food" ? mealById(id) : lane === "run" ? rwkById(id) : templateById(id);
  if (src && !$("#plan-label").value.trim()) $("#plan-label").value = src.name;
});
$("#plan-cancel").addEventListener("click", () => $("#plan-modal").classList.add("hidden"));
$("#plan-open-day").addEventListener("click", () => {
  const date = $("#plan-date").value;
  if (!date) { alert("חסר תאריך."); return; }
  $("#plan-modal").classList.add("hidden");
  view.workoutDate = date;
  showScreen("workout"); // מעבר למסך האימון של אותו יום — כולל ימים שכבר עברו
  window.scrollTo({ top: 0 });
});
$("#plan-delete").addEventListener("click", () => {
  if (!confirm("להסיר את הצומת מהתכנון?")) return;
  pushPlanUndo();
  state.plan.nodes = state.plan.nodes.filter((n) => n.id !== editingPlanNodeId);
  save();
  $("#plan-modal").classList.add("hidden");
  renderPlan();
});
$("#plan-save").addEventListener("click", () => {
  const label = $("#plan-label").value.trim();
  const date = $("#plan-date").value;
  if (!label || !date) { alert("חסרים תווית או תאריך."); return; }
  const lane = $("#plan-lane").value;
  const srcId = $("#plan-template").value || undefined;
  const data = {
    date,
    lane,
    templateId: lane === "food" || lane === "run" ? undefined : srcId,
    mealId: lane === "food" ? srcId : undefined,
    runWorkoutId: lane === "run" ? srcId : undefined,
    time: $("#plan-time").value || undefined,
    label,
  };
  pushPlanUndo();
  if (editingPlanNodeId) {
    Object.assign(state.plan.nodes.find((n) => n.id === editingPlanNodeId), data);
  } else {
    state.plan.nodes.push({ id: newId("pl"), ...data });
  }
  save();
  $("#plan-modal").classList.add("hidden");
  renderPlan();
});

registerScreen("plan", renderPlan);
