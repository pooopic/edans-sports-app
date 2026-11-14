"use strict";
/* עץ 3 — מסך פרויקטים ומטלות.
   סדר המסך משרת תעדוף: שוטף (מה מחכה) ← פעילים (עם הצעד הבא) ← מוקפאים (בכוונה לא עכשיו)
   ← הושלמו/ירדו (מקופל). */
import { registerScreen } from "../core/nav.js";
import { $, escapeHtml } from "../core/ui.js";
import { state } from "../core/state.js";
import { shortDate, todayIso } from "../core/dates.js";
import { gcalConnected } from "../core/gcal.js";
import { reminderEditor } from "../core/reminders.js";
import {
  ROUTINE_ID, activeLimit, STATUSES, activeProjects, allAreas, bulkAddProjects, deleteProject,
  deleteTask, dueLabel, isRoutine, openTasksSorted, projectById, repeatLabel, saveProject,
  saveTask, tasksOf, toggleTaskDone,
} from "./model.js";

/* ---------- שורת מטלה (משותפת למסך ולמודאל הפרויקט) ---------- */
function taskRow(task, onChange) {
  const row = document.createElement("div");
  row.className = "task-row" + (task.done ? " done" : "");
  const cb = document.createElement("input");
  cb.type = "checkbox";
  cb.checked = !!task.done;
  cb.title = task.repeat ? "בוצע — קפוץ למופע הבא" : "בוצע";
  cb.addEventListener("change", () => {
    toggleTaskDone(task); // מטלה חוזרת: התאריך מתקדם והיא נשארת ברשימה עם התאריך הבא
    onChange();
  });
  const body = document.createElement("div");
  body.className = "task-body";
  const due = dueLabel(task);
  const rep = repeatLabel(task.repeat);
  body.innerHTML = `<span class="task-title">${escapeHtml(task.title)}</span>` +
    (due.text && !task.done ? `<span class="task-due ${due.cls}">${due.text}${task.time ? " " + task.time : ""}</span>` : "") +
    (rep ? `<span class="task-rep">🔁 ${rep}</span>` : "");
  body.addEventListener("click", () => openTaskEditor(task.id, task.projectId, onChange));
  row.append(cb, body);
  return row;
}

/* ---------- המסך ---------- */
function renderProjects() {
  const active = activeProjects();
  $("#proj-subtitle").textContent = `${active.length} פעילים · ${state.projects.filter((p) => p.status === "frozen").length} מוקפאים`;
  const lim = $("#proj-limit");
  const limit = activeLimit();
  const over = limit && active.length > limit;
  lim.classList.toggle("hidden", !over);
  if (over) {
    lim.innerHTML = `⚠️ <b>${active.length} פרויקטים פעילים</b> — מעל המגבלה שהגדרת (${limit}).`;
  }
  renderRoutine();
  renderLists();
}

function renderRoutine() {
  const box = $("#proj-routine");
  box.innerHTML = "";
  const head = document.createElement("div");
  head.className = "card-head";
  head.innerHTML = "<h2>🔁 שוטף — בית ויום-יום</h2>";
  const add = document.createElement("button");
  add.className = "btn small";
  add.textContent = "+ מטלה";
  add.addEventListener("click", () => openTaskEditor(null, ROUTINE_ID, renderProjects));
  head.appendChild(add);
  box.appendChild(head);
  const open = openTasksSorted(tasksOf(ROUTINE_ID));
  if (!open.length) {
    box.insertAdjacentHTML("beforeend", '<p class="hint">אין מטלות שוטפות. למשל: השקיית עציצים כל 3 ימים, ניקיון כל שבוע, פילטר מזגן כל 3 חודשים.</p>');
  }
  for (const t of open) box.appendChild(taskRow(t, renderProjects));
}

function projectCard(p) {
  const card = document.createElement("div");
  card.className = "card proj-card status-" + p.status;
  const open = openTasksSorted(tasksOf(p.id));
  const late = open.filter((t) => t.date && t.date < todayIso()).length;
  const dates = [p.start ? shortDate(p.start) : "", p.end ? shortDate(p.end) : ""].filter(Boolean).join(" → ");
  card.innerHTML = `
    <div class="proj-head">
      <span class="proj-name">${escapeHtml(p.name)}</span>
      ${p.area ? `<span class="proj-area">${escapeHtml(p.area)}</span>` : ""}
      <span class="spacer"></span>
      ${dates ? `<span class="proj-dates">${dates}</span>` : ""}
    </div>
    ${p.status === "active" ? `<div class="proj-next ${p.nextStep ? "" : "missing"}">👉 ${p.nextStep ? escapeHtml(p.nextStep) : "אין צעד הבא — מה הפעולה הקטנה הבאה?"}</div>` : ""}
    ${open.length ? `<div class="proj-meta">${open.length} מטלות פתוחות${late ? ` · <span class="late">${late} באיחור</span>` : ""}</div>` : ""}`;
  card.addEventListener("click", () => openProjectEditor(p.id));
  return card;
}

function renderLists() {
  const wrap = $("#proj-lists");
  wrap.innerHTML = "";
  const groups = [
    ["active", "🟢 פעילים", ""],
    ["frozen", "🧊 מוקפאים — בכוונה לא עכשיו", ""],
    ["done", "✅ הושלמו", "collapsed"],
    ["dropped", "🗑️ ירדו", "collapsed"],
  ];
  const others = state.projects.filter((p) => !isRoutine(p));
  if (!others.length) {
    wrap.innerHTML = '<div class="card hint" style="margin:0;">עוד אין פרויקטים. "הוספה מהירה" מאפשרת להדביק את כל הרשימה בבת אחת.</div>';
    return;
  }
  for (const [status, title, mode] of groups) {
    const list = others.filter((p) => p.status === status);
    if (!list.length) continue;
    const sec = document.createElement(mode ? "details" : "div");
    sec.className = "proj-section";
    const h = document.createElement(mode ? "summary" : "div");
    h.className = "shop-cat";
    h.textContent = `${title} (${list.length})`;
    sec.appendChild(h);
    for (const p of list) sec.appendChild(projectCard(p));
    wrap.appendChild(sec);
  }
}

/* ---------- מודאל פרויקט ---------- */
let editingProjectId = null;
let projectOnSaved = null; // נקרא אחרי שמירה/מחיקה (למשל רענון הגאנט כשנפתח משם)

function fillStatusSelect(sel, value) {
  sel.innerHTML = "";
  for (const [v, s] of Object.entries(STATUSES)) {
    const o = document.createElement("option");
    o.value = v; o.textContent = `${s.icon} ${s.label}`;
    if (v === value) o.selected = true;
    sel.appendChild(o);
  }
}
function fillAreas() {
  $("#proj-areas").innerHTML = allAreas().map((a) => `<option value="${escapeHtml(a)}">`).join("");
}
function updateStatusWarn() {
  const status = $("#proj-status").value;
  const others = activeProjects().filter((p) => p.id !== editingProjectId).length;
  const warn = $("#proj-status-warn");
  const limit = activeLimit();
  const show = limit && status === "active" && others >= limit && !isRoutine(projectById(editingProjectId));
  warn.classList.toggle("hidden", !show);
  if (show) warn.textContent = `כבר יש ${others} פעילים. זה יהיה ה-${others + 1} — אולי להקפיא אחד אחר?`;
}

export function openProjectEditor(id, onSaved) {
  editingProjectId = id;
  projectOnSaved = onSaved || null;
  const p = id ? projectById(id) : null;
  const routine = isRoutine(p);
  $("#proj-modal-title").textContent = p ? p.name : "פרויקט חדש";
  $("#proj-name").value = p ? p.name : "";
  $("#proj-area").value = p ? p.area || "" : "";
  fillStatusSelect($("#proj-status"), p ? p.status : "active");
  $("#proj-start").value = p && p.start ? p.start : "";
  $("#proj-end").value = p && p.end ? p.end : "";
  $("#proj-next").value = p ? p.nextStep || "" : "";
  $("#proj-notes").value = p ? p.notes || "" : "";
  for (const sel of ["#proj-name", "#proj-area", "#proj-status"]) $(sel).disabled = routine;
  $("#proj-delete").classList.toggle("hidden", !p || routine);
  $("#proj-tasks-wrap").classList.toggle("hidden", !p);
  fillAreas();
  updateStatusWarn();
  renderProjectTasks();
  $("#proj-modal").classList.remove("hidden");
}
function renderProjectTasks() {
  const wrap = $("#proj-tasks");
  wrap.innerHTML = "";
  if (!editingProjectId) return;
  const all = tasksOf(editingProjectId);
  const open = openTasksSorted(all);
  const done = all.filter((t) => t.done);
  const refresh = () => { renderProjectTasks(); renderProjects(); if (projectOnSaved) projectOnSaved(); };
  for (const t of open) wrap.appendChild(taskRow(t, refresh));
  if (done.length) {
    const d = document.createElement("details");
    d.innerHTML = `<summary class="hint">בוצעו (${done.length})</summary>`;
    for (const t of done) d.appendChild(taskRow(t, refresh));
    wrap.appendChild(d);
  }
  if (!all.length) wrap.innerHTML = '<p class="hint">אין מטלות עדיין.</p>';
}

$("#proj-status").addEventListener("change", updateStatusWarn);
$("#proj-add").addEventListener("click", () => openProjectEditor(null));
$("#proj-cancel").addEventListener("click", () => $("#proj-modal").classList.add("hidden"));
$("#proj-task-add").addEventListener("click", () => openTaskEditor(null, editingProjectId, () => { renderProjectTasks(); renderProjects(); if (projectOnSaved) projectOnSaved(); }));
$("#proj-delete").addEventListener("click", () => {
  const p = projectById(editingProjectId);
  const n = tasksOf(editingProjectId).length;
  if (!confirm(`למחוק את "${p.name}"${n ? ` ואת ${n} המטלות שלו` : ""}? (אפשר גם לסמן "ירד" ולשמור היסטוריה)`)) return;
  deleteProject(editingProjectId);
  $("#proj-modal").classList.add("hidden");
  renderProjects();
  if (projectOnSaved) projectOnSaved();
});
$("#proj-save").addEventListener("click", () => {
  const name = $("#proj-name").value.trim();
  if (!name) { alert("חסר שם לפרויקט."); return; }
  const start = $("#proj-start").value || undefined;
  const end = $("#proj-end").value || undefined;
  if (start && end && end < start) { alert("תאריך הסיום לפני ההתחלה."); return; }
  saveProject({
    id: editingProjectId || undefined,
    name,
    area: $("#proj-area").value.trim(),
    status: $("#proj-status").value,
    start, end,
    nextStep: $("#proj-next").value.trim(),
    notes: $("#proj-notes").value.trim() || undefined,
  });
  $("#proj-modal").classList.add("hidden");
  renderProjects();
  if (projectOnSaved) projectOnSaved();
});

/* ---------- מודאל מטלה ---------- */
let editingTaskId = null;
let taskRem = null; // עורך ההתראות של המטלה הפתוחה
let taskOnSaved = null;

export function openTaskEditor(taskId, projectId, onSaved, defaultDate) {
  editingTaskId = taskId;
  taskOnSaved = onSaved;
  const t = taskId ? state.tasks.find((x) => x.id === taskId) : null;
  $("#task-modal-title").textContent = t ? "עריכת מטלה" : "מטלה חדשה";
  $("#task-title").value = t ? t.title : "";
  $("#task-date").value = t && t.date ? t.date : defaultDate || "";
  $("#task-time").value = t && t.time ? t.time : "";
  $("#task-dur").value = t && t.duration ? t.duration : 60;
  // התראות — רק כשמחוברים ליומן; תלוי אם יש שעה (אירוע עם שעה / של כל היום)
  $("#task-rem-wrap").classList.toggle("hidden", !gcalConnected());
  taskRem = reminderEditor($("#task-rem"), t ? (t.reminders === undefined ? null : t.reminders) : null, { isTimed: () => !!$("#task-time").value });
  const sel = $("#task-project");
  sel.innerHTML = "";
  for (const p of state.projects.filter((x) => x.status !== "dropped" || x.id === projectId)) {
    const o = document.createElement("option");
    o.value = p.id;
    o.textContent = isRoutine(p) ? "🔁 שוטף" : p.name;
    if (p.id === (t ? t.projectId : projectId)) o.selected = true;
    sel.appendChild(o);
  }
  const rep = t && t.repeat;
  $("#task-repeat-on").checked = !!rep;
  $("#task-repeat-every").value = rep ? rep.every : 1;
  $("#task-repeat-unit").value = rep ? rep.unit : "week";
  syncRepeatBox();
  $("#task-delete").classList.toggle("hidden", !t);
  $("#task-modal").classList.remove("hidden");
  $("#task-title").focus();
}
function syncRepeatBox() {
  const on = $("#task-repeat-on").checked;
  $("#task-repeat-box").classList.toggle("hidden", !on);
  $("#task-repeat-hint").classList.toggle("hidden", !on);
}
$("#task-repeat-on").addEventListener("change", syncRepeatBox);
$("#task-time").addEventListener("change", () => { if (taskRem) taskRem.rerender(); });
$("#task-cancel").addEventListener("click", () => $("#task-modal").classList.add("hidden"));
$("#task-delete").addEventListener("click", () => {
  if (!confirm("למחוק את המטלה?")) return;
  deleteTask(editingTaskId);
  $("#task-modal").classList.add("hidden");
  if (taskOnSaved) taskOnSaved();
});
$("#task-save").addEventListener("click", () => {
  const title = $("#task-title").value.trim();
  if (!title) { alert("מה המטלה?"); return; }
  const repeatOn = $("#task-repeat-on").checked;
  let date = $("#task-date").value || undefined;
  if (repeatOn && !date) date = todayIso(); // מטלה חוזרת צריכה נקודת התחלה
  saveTask({
    id: editingTaskId || undefined,
    projectId: $("#task-project").value,
    title,
    date,
    time: date && $("#task-time").value ? $("#task-time").value : undefined, // בלי שעה = כל היום
    duration: date && $("#task-time").value ? Math.max(5, parseInt($("#task-dur").value, 10) || 60) : undefined,
    reminders: taskRem && gcalConnected() ? taskRem.get() : (editingTaskId ? (state.tasks.find((x) => x.id === editingTaskId) || {}).reminders : null),
    repeat: repeatOn
      ? { every: Math.max(1, parseInt($("#task-repeat-every").value, 10) || 1), unit: $("#task-repeat-unit").value }
      : null,
  });
  $("#task-modal").classList.add("hidden");
  if (taskOnSaved) taskOnSaved();
});

/* ---------- הוספה מהירה ---------- */
$("#proj-bulk").addEventListener("click", () => {
  $("#bulk-text").value = "";
  $("#bulk-area").value = "";
  fillStatusSelect($("#bulk-status"), "frozen");
  fillAreas();
  $("#bulk-modal").classList.remove("hidden");
});
$("#bulk-cancel").addEventListener("click", () => $("#bulk-modal").classList.add("hidden"));
$("#bulk-save").addEventListener("click", () => {
  const lines = $("#bulk-text").value.split("\n");
  const n = bulkAddProjects(lines, $("#bulk-area").value.trim(), $("#bulk-status").value);
  $("#bulk-modal").classList.add("hidden");
  renderProjects();
  if (!n) alert("לא נוסף כלום — השורות ריקות או שהשמות כבר קיימים.");
});

for (const id of ["#proj-modal", "#task-modal", "#bulk-modal"]) {
  $(id).addEventListener("click", (e) => { if (e.target === $(id)) $(id).classList.add("hidden"); });
}

registerScreen("projects", renderProjects);
