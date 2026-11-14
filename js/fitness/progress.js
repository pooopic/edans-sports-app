"use strict";
import { registerScreen } from "../core/nav.js";
import { LEGACY_EXERCISES, PULLUP_TYPES, WORKOUT_DAYS } from "../core/constants.js";
import { iso, shortDate, todayIso, weekKeyOf } from "../core/dates.js";
import { newId } from "../core/model.js";
import { proteinMax, proteinMin, save, state } from "../core/state.js";
import { $, $$ } from "../core/ui.js";
import { exLibById } from "./model.js";

/* ============================ מסך התקדמות ============================ */

/* ---------- מדדי גוף: משקל + מותן ---------- */
if (!state.body) state.body = []; // [{date, weight, waist}]

export function renderBody() {
  const entries = [...state.body].sort((a, b) => (a.date < b.date ? -1 : 1));
  const last = entries[entries.length - 1];
  if (!last) {
    $("#body-last").textContent = "עוד אין מדידות — שקילה פעם בשבוע, באותה שעה, מספיקה.";
  } else {
    const parts = [];
    if (last.weight) parts.push(`${last.weight} ק״ג`);
    if (last.waist) parts.push(`מותן ${last.waist}`);
    if (last.hr) parts.push(`דופק ${last.hr}`);
    if (last.sys && last.dia) parts.push(`ל״ד ${last.sys}/${last.dia}`);
    if (last.spo2) parts.push(`SpO₂ ${last.spo2}%`);
    $("#body-last").textContent = `מדידה אחרונה: ${shortDate(last.date)} — ${parts.join(", ")}`;
  }
  drawBodyChart();
}

export function drawBodyChart() {
  const metric = $("#body-metric").value || "weight";
  const points = [...state.body]
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .filter((e) => e[metric] > 0)
    .map((e) => ({ label: shortDate(e.date), val: e[metric] }))
    .slice(-12);
  drawLineChart($("#chart-body"), points, "");
}

$("#body-save").addEventListener("click", () => {
  const fields = {
    weight: parseFloat($("#body-weight").value) || 0,
    waist: parseFloat($("#body-waist").value) || 0,
    hr: parseFloat($("#body-hr").value) || 0,
    sys: parseFloat($("#body-sys").value) || 0,
    dia: parseFloat($("#body-dia").value) || 0,
    spo2: parseFloat($("#body-spo2").value) || 0,
  };
  if (!Object.values(fields).some((v) => v > 0)) { alert("הזן לפחות מדד אחד."); return; }
  if ((fields.sys && !fields.dia) || (!fields.sys && fields.dia)) {
    alert("לחץ דם נרשם בזוג — סיסטולי ודיאסטולי יחד.");
    return;
  }
  const today = todayIso();
  let entry = state.body.find((e) => e.date === today);
  if (!entry) { entry = { date: today }; state.body.push(entry); }
  for (const [k, v] of Object.entries(fields)) if (v > 0) entry[k] = v;
  save();
  ["#body-weight", "#body-waist", "#body-hr", "#body-sys", "#body-dia", "#body-spo2"].forEach((s) => { $(s).value = ""; });
  renderBody();
});
$("#body-metric").addEventListener("change", drawBodyChart);

/* ---------- תמונות התקדמות (IndexedDB — נשאר במכשיר בלבד) ---------- */
export function photosDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("edan-photos", 1);
    req.onupgradeneeded = () => req.result.createObjectStore("photos", { keyPath: "id" });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
export function photoTx(mode, fn) {
  return photosDB().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction("photos", mode);
    const store = tx.objectStore("photos");
    const result = fn(store);
    tx.oncomplete = () => resolve(result && result.result !== undefined ? result.result : undefined);
    tx.onerror = () => reject(tx.error);
  }));
}
export function listPhotos() { return photoTx("readonly", (s) => s.getAll()); }
export function putPhoto(rec) { return photoTx("readwrite", (s) => s.put(rec)); }
export function removePhoto(id) { return photoTx("readwrite", (s) => s.delete(id)); }

/* כיווץ לפני שמירה — ~1000px JPEG, כדי שהאחסון המקומי לא יתמלא */
export function compressImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const maxDim = 1000;
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("compress failed"))), "image/jpeg", 0.85);
      URL.revokeObjectURL(img.src);
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

export const POSE_LABELS = { front: "פרונט", side: "צד" };

export function buildCompareRow(title, first, last) {
  const wrap = document.createElement("div");
  const t = document.createElement("div");
  t.className = "compare-title";
  t.textContent = title;
  const row = document.createElement("div");
  row.className = "photo-compare";
  for (const [p, cap] of [[first, "התחלה"], [last, "עכשיו"]]) {
    const fig = document.createElement("figure");
    const img = document.createElement("img");
    img.src = URL.createObjectURL(p.blob);
    const fc = document.createElement("figcaption");
    fc.textContent = `${cap} · ${shortDate(p.date)}`;
    fig.append(img, fc);
    row.appendChild(fig);
  }
  wrap.append(t, row);
  return wrap;
}

export async function renderPhotos() {
  let photos = [];
  try { photos = await listPhotos(); } catch (e) { return; }
  photos.sort((a, b) => (a.date < b.date ? -1 : 1));

  // השוואות נפרדות לכל תנוחה — פרונט מול פרונט, צד מול צד
  const compares = $("#photo-compares");
  compares.innerHTML = "";
  let anyPair = false;
  for (const pose of ["front", "side"]) {
    const list = photos.filter((p) => p.pose === pose);
    if (list.length >= 2 && list[0].date !== list[list.length - 1].date) {
      compares.appendChild(buildCompareRow(POSE_LABELS[pose], list[0], list[list.length - 1]));
      anyPair = true;
    }
  }
  // אין זוגות מתויגים — נופלים להשוואה כללית ראשון/אחרון
  if (!anyPair && photos.length >= 2 && photos[0].date !== photos[photos.length - 1].date) {
    compares.appendChild(buildCompareRow("השוואה", photos[0], photos[photos.length - 1]));
  }

  const grid = $("#photo-grid");
  grid.innerHTML = "";
  for (const p of [...photos].reverse()) {
    const cell = document.createElement("div");
    cell.className = "photo-thumb";
    const img = document.createElement("img");
    img.src = URL.createObjectURL(p.blob);
    const date = document.createElement("span");
    date.className = "photo-date";
    date.textContent = shortDate(p.date);
    const pose = document.createElement("button");
    pose.className = "photo-pose" + (p.pose ? "" : " untagged");
    pose.textContent = p.pose ? POSE_LABELS[p.pose] : "תייג";
    pose.title = "החלף פרונט/צד";
    pose.addEventListener("click", async () => {
      p.pose = p.pose === "front" ? "side" : "front";
      await putPhoto(p);
      renderPhotos();
    });
    const del = document.createElement("button");
    del.className = "photo-del";
    del.textContent = "✕";
    del.addEventListener("click", async () => {
      if (!confirm("למחוק את התמונה? אין שחזור.")) return;
      await removePhoto(p.id);
      renderPhotos();
    });
    cell.append(img, date, pose, del);
    grid.appendChild(cell);
  }
}

export let pendingPose = "front";
$$(".photo-add").forEach((btn) => {
  btn.addEventListener("click", () => {
    pendingPose = btn.dataset.pose;
    $("#photo-input").click();
  });
});
$("#photo-input").addEventListener("change", async (e) => {
  const file = e.target.files && e.target.files[0];
  e.target.value = "";
  if (!file) return;
  try {
    const blob = await compressImage(file);
    await putPhoto({ id: newId("ph"), date: todayIso(), blob, pose: pendingPose });
    renderPhotos();
  } catch (err) {
    alert("שמירת התמונה נכשלה — נסה שוב.");
  }
});



export function renderProgress() {
  renderBody();
  renderPhotos();
  renderStreak();
  drawProteinChart();
  fillExerciseSelect();
  drawWeightsChart();
  drawRunChart();
  drawPullupsChart();
  fillCoreExSelect();
  drawCoreExChart();
}

export function renderStreak() {
  // רצף: כמה ימי אימון מתוכננים (א/ג/ה) ברצף הושלמו, אחורה מהיום.
  let streak = 0;
  const d = new Date();
  let guard = 0;
  // אם היום יום אימון שעוד לא הושלם — לא שובר את הרצף, מתחילים מהקודם
  while (guard++ < 400) {
    if (WORKOUT_DAYS.includes(d.getDay())) {
      const key = iso(d);
      const w = state.workouts[key];
      if (w && w.done) streak++;
      else if (key === todayIso()) { /* היום עוד לא — ממשיכים אחורה */ }
      else break;
    }
    d.setDate(d.getDate() - 1);
  }
  $("#streak-count").textContent = streak;
  const total = Object.values(state.workouts).filter((w) => w.done).length;
  $("#streak-detail").textContent = `סה״כ ${total} אימונים הושלמו`;
}

/* ---------- ציור גרפים (canvas) ---------- */
export function setupCanvas(canvas) {
  const dpr = window.devicePixelRatio || 1;
  const cssW = canvas.clientWidth || canvas.parentElement.clientWidth;
  const cssH = parseInt(canvas.getAttribute("height"), 10);
  canvas.width = cssW * dpr;
  canvas.height = cssH * dpr;
  canvas.style.height = cssH + "px";
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssW, cssH);
  return { ctx, W: cssW, H: cssH };
}

export function drawEmpty(ctx, W, H, msg) {
  ctx.fillStyle = "#93a1af";
  ctx.font = "13px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(msg, W / 2, H / 2);
}

export function drawProteinChart() {
  const canvas = $("#chart-protein");
  const { ctx, W, H } = setupCanvas(canvas);
  const days = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const wk = weekKeyOf(d);
    const week = state.weeks[wk];
    const val = week ? week.days[d.getDay()].protein : null;
    days.push({ label: `${d.getDate()}.${d.getMonth() + 1}`, val });
  }
  if (!days.some((d) => d.val != null)) return drawEmpty(ctx, W, H, "אין נתונים עדיין");

  const pad = { t: 12, b: 22, r: 8, l: 30 };
  const maxV = Math.max(160, ...days.map((d) => d.val || 0));
  const x = (i) => W - pad.r - ((i + 0.5) / days.length) * (W - pad.l - pad.r); // RTL: יום ראשון מימין
  const y = (v) => pad.t + (1 - v / maxV) * (H - pad.t - pad.b);
  const barW = ((W - pad.l - pad.r) / days.length) * 0.62;

  // רצועת יעד 130–140
  ctx.fillStyle = "rgba(76, 208, 138, 0.12)";
  ctx.fillRect(pad.l, y(proteinMax()), W - pad.l - pad.r, y(proteinMin()) - y(proteinMax()));
  ctx.strokeStyle = "rgba(76, 208, 138, 0.5)";
  ctx.setLineDash([4, 4]);
  for (const t of [proteinMin(), proteinMax()]) {
    ctx.beginPath(); ctx.moveTo(pad.l, y(t)); ctx.lineTo(W - pad.r, y(t)); ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.fillStyle = "#93a1af";
  ctx.font = "10px sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(String(proteinMin()), 4, y(proteinMin()) + 3);
  ctx.fillText(String(proteinMax()), 4, y(proteinMax()) + 3);

  days.forEach((d, i) => {
    if (d.val == null) return;
    ctx.fillStyle = d.val >= proteinMin() ? "#4cd08a" : "#e8b44c";
    const bx = x(i) - barW / 2;
    ctx.fillRect(bx, y(d.val), barW, H - pad.b - y(d.val));
    if (i % 2 === 0) {
      ctx.fillStyle = "#93a1af";
      ctx.textAlign = "center";
      ctx.fillText(d.label, x(i), H - 8);
    }
  });
}

export let exerciseSelectBound = false;
export function fillExerciseSelect() {
  const sel = $("#chart-exercise-select");
  const prevValue = sel.value;
  sel.innerHTML = "";
  for (const ex of state.exercises.filter((x) => x.mode === "weight")) {
    const opt = document.createElement("option");
    opt.value = ex.id; opt.textContent = ex.id === "curl" ? "Curl (שתי הווריאציות)" : ex.name;
    sel.appendChild(opt);
  }
  // תרגילים ישנים עם היסטוריה — נשארים זמינים בגרף כארכיון
  for (const [id, name] of Object.entries(LEGACY_EXERCISES)) {
    const hasData = completedWorkouts().some(([, w]) =>
      w.ex && w.ex[id] && w.ex[id].some((s) => (s.weight || 0) > 0));
    if (hasData) {
      const opt = document.createElement("option");
      opt.value = id; opt.textContent = name;
      sel.appendChild(opt);
    }
  }
  if (prevValue && [...sel.options].some((o) => o.value === prevValue)) sel.value = prevValue;
  if (!exerciseSelectBound) {
    sel.addEventListener("change", drawWeightsChart);
    exerciseSelectBound = true;
  }
}

export function completedWorkouts() {
  return Object.entries(state.workouts)
    .filter(([, w]) => w.done)
    .sort(([a], [b]) => (a < b ? -1 : 1));
}

export function drawLineChart(canvas, points, unit) {
  const { ctx, W, H } = setupCanvas(canvas);
  if (points.length === 0) return drawEmpty(ctx, W, H, "אין אימונים שהושלמו עדיין");

  const pad = { t: 14, b: 22, r: 14, l: 30 };
  const vals = points.map((p) => p.val);
  const maxV = Math.max(...vals) * 1.2 || 10;
  const x = (i) => points.length === 1
    ? W / 2
    : W - pad.r - (i / (points.length - 1)) * (W - pad.l - pad.r); // RTL: הראשון מימין
  const y = (v) => pad.t + (1 - v / maxV) * (H - pad.t - pad.b);

  ctx.strokeStyle = "#4cd08a";
  ctx.lineWidth = 2;
  ctx.beginPath();
  points.forEach((p, i) => { i === 0 ? ctx.moveTo(x(i), y(p.val)) : ctx.lineTo(x(i), y(p.val)); });
  ctx.stroke();

  points.forEach((p, i) => {
    ctx.fillStyle = "#4cd08a";
    ctx.beginPath(); ctx.arc(x(i), y(p.val), 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#e8edf2";
    ctx.font = "11px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(p.val + unit, x(i), y(p.val) - 8);
    ctx.fillStyle = "#93a1af";
    ctx.font = "10px sans-serif";
    ctx.fillText(p.label, x(i), H - 8);
  });
}

export function drawWeightsChart() {
  const exId = $("#chart-exercise-select").value || "row";
  const points = completedWorkouts()
    .map(([date, w]) => {
      const sets = (w.ex && w.ex[exId]) || [];
      const maxW = Math.max(0, ...sets.map((s) => s.weight || 0));
      return { label: shortDate(date), val: maxW };
    })
    .filter((p) => p.val > 0)
    .slice(-10);
  drawLineChart($("#chart-weights"), points, "");
}

export function drawPullupsChart() {
  // רק סט 1 מלא — מדד ההתקדמות האמיתי לקראת 7 מלאים
  const points = completedWorkouts()
    .filter(([, w]) => w.ex && w.ex.pullups && w.ex.pullups.length)
    .map(([date, w]) => {
      const firstFull = w.ex.pullups.find((s) => s.variant === PULLUP_TYPES[0]);
      return { label: shortDate(date), val: firstFull ? firstFull.reps || 0 : 0 };
    })
    .slice(-10);
  drawLineChart($("#chart-pullups"), points, "");
}

export let coreExSelectBound = false;
export function fillCoreExSelect() {
  const sel = $("#chart-coreex-select");
  const prevValue = sel.value;
  sel.innerHTML = "";
  for (const ex of state.exercises.filter((x) => x.mode === "reps" || x.mode === "seconds")) {
    const opt = document.createElement("option");
    opt.value = ex.id; opt.textContent = ex.name;
    sel.appendChild(opt);
  }
  if (prevValue && [...sel.options].some((o) => o.value === prevValue)) sel.value = prevValue;
  if (!coreExSelectBound) {
    sel.addEventListener("change", drawCoreExChart);
    coreExSelectBound = true;
  }
}

export function drawCoreExChart() {
  const exId = $("#chart-coreex-select").value;
  const ex = exLibById(exId);
  if (!ex) return;
  // נפח = סכום הסטים שסומנו ✓ באימון
  const points = completedWorkouts()
    .map(([date, w]) => {
      const sets = (w.ex && w.ex[exId]) || [];
      const total = sets.filter((s) => s.done)
        .reduce((a, s) => a + ((ex.mode === "seconds" ? s.secs : s.reps) || 0), 0);
      return { label: shortDate(date), val: total };
    })
    .filter((p) => p.val > 0)
    .slice(-10);
  drawLineChart($("#chart-coreex"), points, ex.mode === "seconds" ? " שנ׳" : "");
}

export function drawRunChart() {
  const points = completedWorkouts()
    .filter(([, w]) => w.run && w.run.km > 0)
    .map(([date, w]) => ({ label: shortDate(date), val: w.run.km }))
    .slice(-10);
  drawLineChart($("#chart-run"), points, ' ק"מ');
}

registerScreen("progress", renderProgress);
