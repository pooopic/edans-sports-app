"use strict";

/* ============================================================
   המעקב של עדן — תזונה ואימונים
   כל הנתונים נשמרים מקומית ב-localStorage.
   ============================================================ */

const STORE_KEY = "edan-tracker-v1";
const DAY_NAMES = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
const WORKOUT_DAYS = [0, 2, 4]; // ראשון, שלישי, חמישי
const PROTEIN_MIN = 130;
const PROTEIN_MAX = 140;

/* ---------- תבנית תפריט (יובאה מגיליון "תפריט שבועי" באקסל) ---------- */
const MENU_TEMPLATE = [
  { // ראשון
    morning: "קערת חלבון: יוגורט יווני + אבקת וניל + תערובת שקדים, אגוזים ופירות יבשים (אחרי האימון), או צום 16:8",
    noon: "חזה עוף (מוכן) + אורז + ירקות",
    evening: "שקשוקה + סלט",
    notes: "אימון קפיצה בחבל + מתח — חלבון אחרי (יוגורט/ביצים)",
    protein: 145, fast: true,
  },
  { // שני
    morning: "2 ביצים קשות + קוטג׳ + ירקות",
    noon: "מנת אסאדו מהמקפיא + אורז",
    evening: "מרק עדשים + יוגורט יווני",
    notes: "",
    protein: 135, fast: false,
  },
  { // שלישי
    morning: "אופציה לצום 16:8 — רק קפה, או קערת חלבון: יוגורט יווני + אבקת וניל + תערובת שקדים, אגוזים ופירות יבשים",
    noon: "חזה עוף + ירקות אנטיפסטי + אורז",
    evening: "חביתה + סלט + פרוסת לחם מלא",
    notes: "אימון משקולות — ארוחת צהריים גדולה יותר ביום אימון",
    protein: 130, fast: true,
  },
  { // רביעי
    morning: "קוטג׳ + ירקות + פרוסת לחם מלא",
    noon: "מנת אסאדו מהמקפיא + אורז + סלט",
    evening: "סלט טונה עם ביצה",
    notes: "",
    protein: 135, fast: false,
  },
  { // חמישי
    morning: "קערת חלבון: יוגורט יווני + אבקת וניל + תערובת שקדים, אגוזים ופירות יבשים",
    noon: "מרק עדשים + חזה עוף / מה שנשאר",
    evening: "שקשוקה + סלט",
    notes: "אימון משקולות. לתכנן בישולים לשבוע הבא",
    protein: 140, fast: false,
  },
  { // שישי
    morning: "— (דילוג — יוצא צום 16:8 בפועל)",
    noon: "משהו קטן: יוגורט יווני / ביצה קשה וירקות",
    evening: "אסאדו בריבת בצל + אורז + סלט גדול",
    notes: "יום בישולים: אסאדו בתנור (3 שעות), אורז, ביצים קשות, מרק עדשים להקפאה",
    protein: 105, fast: false,
  },
  { // שבת
    morning: "חביתה 2-3 ביצים + קוטג׳ + ירקות",
    noon: "אסאדו + אורז + ירקות אנטיפסטי",
    evening: "סלט טונה עם ביצה קשה וירקות",
    notes: "להקפיא 2-3 מנות אסאדו + מנות מרק עדשים",
    protein: 140, fast: false,
  },
];

/* ---------- תבנית אימון (מותאמת לציוד הביתי) ---------- */
const EXERCISES = [
  { id: "squat",    name: "סקוואט גובלט",   equip: "משקולת 5 ק״ג צמוד לחזה", defSets: 3, defReps: 10, defWeight: 5 },
  { id: "press",    name: "לחיצה",          equip: "משקולות 5 ק״ג / שכיבות TRX", defSets: 3, defReps: 10, defWeight: 5 },
  { id: "row",      name: "חתירה",          equip: "TRX / משקולות", defSets: 3, defReps: 10, defWeight: 0 },
  { id: "rdl",      name: "דדליפט רומני",   equip: "2× משקולות 5 ק״ג", defSets: 3, defReps: 12, defWeight: 10 },
];
const PULLUP_TYPES = ["מלא", "עם גומייה (35 ק״ג)", "שלילי (ירידה איטית)"];

/* ============================ state ============================ */

let state = load();

function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { /* אחסון לא זמין / נתון פגום — מתחילים נקי */ }
  return { weeks: {}, workouts: {} };
}
function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) {}
}

/* ---------- תאריכים ---------- */
function iso(d) {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, "0"), day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function fromIso(s) { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); }
function weekKeyOf(d) { // ראשון של אותו שבוע
  const c = new Date(d);
  c.setDate(c.getDate() - c.getDay());
  return iso(c);
}
function addDays(isoStr, n) { const d = fromIso(isoStr); d.setDate(d.getDate() + n); return iso(d); }
function shortDate(isoStr) { const d = fromIso(isoStr); return `${d.getDate()}.${d.getMonth() + 1}`; }

const todayIso = () => iso(new Date());
let currentWeekKey = weekKeyOf(new Date());
let currentWorkoutDate = defaultWorkoutDate();

function defaultWorkoutDate() {
  // ברירת מחדל: היום אם הוא יום אימון, אחרת יום האימון הקרוב בשבוע הנוכחי
  const t = new Date();
  if (WORKOUT_DAYS.includes(t.getDay())) return iso(t);
  const wk = weekKeyOf(t);
  for (const wd of WORKOUT_DAYS) {
    const d = addDays(wk, wd);
    if (d >= todayIso()) return d;
  }
  // כל ימי האימון של השבוע כבר עברו — בוחרים את האחרון שבהם
  return addDays(wk, WORKOUT_DAYS[WORKOUT_DAYS.length - 1]);
}

/* ---------- שבוע תפריט ---------- */
function blankDayFrom(t) {
  return {
    morning: t.morning, noon: t.noon, evening: t.evening, notes: t.notes,
    protein: t.protein, fast: t.fast,
    eaten: { morning: false, noon: false, evening: false },
  };
}
function ensureWeek(weekKey) {
  if (!state.weeks[weekKey]) {
    state.weeks[weekKey] = { days: MENU_TEMPLATE.map(blankDayFrom) };
    save();
  }
  return state.weeks[weekKey];
}
function copyPrevWeek(weekKey) {
  const prevKey = addDays(weekKey, -7);
  const prev = state.weeks[prevKey];
  if (!prev) { alert("אין נתונים לשבוע הקודם — נשארת התבנית."); return; }
  state.weeks[weekKey] = {
    days: prev.days.map((d) => ({
      morning: d.morning, noon: d.noon, evening: d.evening, notes: d.notes,
      protein: d.protein, fast: d.fast,
      eaten: { morning: false, noon: false, evening: false },
    })),
  };
  save();
  renderMenu();
}

/* ---------- אימון ---------- */
function ensureWorkout(dateIso) {
  if (!state.workouts[dateIso]) {
    const prev = lastWorkoutBefore(dateIso);
    const exercises = {};
    for (const ex of EXERCISES) {
      const prevSets = prev && prev.exercises[ex.id] && prev.exercises[ex.id].length
        ? prev.exercises[ex.id]
        : null;
      exercises[ex.id] = prevSets
        ? prevSets.map((s) => ({ reps: s.reps, weight: s.weight }))
        : Array.from({ length: ex.defSets }, () => ({ reps: ex.defReps, weight: ex.defWeight }));
    }
    const pullups = prev && prev.pullups && prev.pullups.length
      ? prev.pullups.map((s) => ({ type: s.type, reps: s.reps }))
      : [ { type: PULLUP_TYPES[0], reps: 3 }, { type: PULLUP_TYPES[1], reps: 6 }, { type: PULLUP_TYPES[1], reps: 6 } ];
    state.workouts[dateIso] = {
      ropeMinutes: 0, ropeRounds: 10,
      exercises, pullups,
      done: false,
    };
    save();
  }
  return state.workouts[dateIso];
}
function lastWorkoutBefore(dateIso) {
  const keys = Object.keys(state.workouts).filter((k) => k < dateIso).sort();
  return keys.length ? state.workouts[keys[keys.length - 1]] : null;
}

/* ============================ ניווט ============================ */

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];

$$(".navbtn").forEach((btn) => {
  btn.addEventListener("click", () => {
    $$(".navbtn").forEach((b) => b.classList.toggle("active", b === btn));
    const target = btn.dataset.screen;
    $$(".screen").forEach((s) => s.classList.add("hidden"));
    $("#screen-" + target).classList.remove("hidden");
    if (target === "menu") renderMenu();
    if (target === "workout") renderWorkout();
    if (target === "progress") renderProgress();
  });
});

/* ============================ מסך תפריט ============================ */

$("#week-prev").addEventListener("click", () => { currentWeekKey = addDays(currentWeekKey, -7); renderMenu(); });
$("#week-next").addEventListener("click", () => { currentWeekKey = addDays(currentWeekKey, 7); renderMenu(); });
$("#btn-copy-week").addEventListener("click", () => copyPrevWeek(currentWeekKey));
$("#btn-reset-week").addEventListener("click", () => {
  if (confirm("לאפס את השבוע לתבנית המקורית?")) {
    state.weeks[currentWeekKey] = { days: MENU_TEMPLATE.map(blankDayFrom) };
    save();
    renderMenu();
  }
});

const MEALS = [
  { key: "morning", label: "בוקר" },
  { key: "noon", label: "צהריים" },
  { key: "evening", label: "ערב" },
];

function renderMenu() {
  const week = ensureWeek(currentWeekKey);
  const endKey = addDays(currentWeekKey, 6);
  $("#week-label").textContent = `${shortDate(currentWeekKey)} – ${shortDate(endKey)}`;

  const wrap = $("#menu-days");
  wrap.innerHTML = "";
  week.days.forEach((day, i) => {
    const dateIso = addDays(currentWeekKey, i);
    const card = document.createElement("div");
    card.className = "card day-card" + (dateIso === todayIso() ? " today" : "");

    const head = document.createElement("div");
    head.className = "day-head";
    head.innerHTML = `
      <span class="day-name">${DAY_NAMES[i]}</span>
      <span class="day-date">${shortDate(dateIso)}</span>
      ${day.fast ? '<span class="fast-badge">צום 16:8</span>' : ""}
      <span class="spacer"></span>`;
    const editBtn = document.createElement("button");
    editBtn.className = "edit-btn";
    editBtn.textContent = "✏️";
    editBtn.addEventListener("click", () => openDayEditor(i));
    head.appendChild(editBtn);
    card.appendChild(head);

    for (const meal of MEALS) {
      const row = document.createElement("div");
      row.className = "meal-row" + (day.eaten[meal.key] ? " eaten" : "");
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = day.eaten[meal.key];
      cb.addEventListener("change", () => {
        day.eaten[meal.key] = cb.checked;
        row.classList.toggle("eaten", cb.checked);
        save();
      });
      const txt = document.createElement("div");
      txt.innerHTML = `<span class="meal-label">${meal.label}</span><span class="meal-text">${escapeHtml(day[meal.key])}</span>`;
      row.appendChild(cb);
      row.appendChild(txt);
      card.appendChild(row);
    }

    if (day.notes) {
      const n = document.createElement("div");
      n.className = "day-notes";
      n.textContent = "📌 " + day.notes;
      card.appendChild(n);
    }

    // חלבון
    const prow = document.createElement("div");
    prow.className = "protein-row";
    const minus = document.createElement("button");
    minus.className = "stepper"; minus.textContent = "−";
    const plus = document.createElement("button");
    plus.className = "stepper"; plus.textContent = "+";
    const num = document.createElement("div");
    num.className = "protein-num";
    const bar = document.createElement("div");
    bar.className = "protein-bar";
    const fill = document.createElement("div");
    fill.className = "protein-fill";
    bar.appendChild(fill);

    const update = () => {
      num.innerHTML = `חלבון: <b>${day.protein}</b> ג׳`;
      const pct = Math.min(100, (day.protein / PROTEIN_MAX) * 100);
      fill.style.width = pct + "%";
      fill.classList.toggle("ok", day.protein >= PROTEIN_MIN);
    };
    minus.addEventListener("click", () => { day.protein = Math.max(0, day.protein - 5); save(); update(); });
    plus.addEventListener("click", () => { day.protein += 5; save(); update(); });
    update();

    prow.append(minus, num, plus, bar);
    card.appendChild(prow);
    wrap.appendChild(card);
  });
}

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/* ---------- מודאל עריכת יום ---------- */
let editingDayIndex = null;
function openDayEditor(i) {
  editingDayIndex = i;
  const day = state.weeks[currentWeekKey].days[i];
  $("#modal-title").textContent = `עריכת יום ${DAY_NAMES[i]}`;
  $("#edit-morning").value = day.morning;
  $("#edit-noon").value = day.noon;
  $("#edit-evening").value = day.evening;
  $("#edit-notes").value = day.notes;
  $("#edit-protein").value = day.protein;
  $("#edit-fast").checked = day.fast;
  $("#modal").classList.remove("hidden");
}
$("#modal-cancel").addEventListener("click", () => $("#modal").classList.add("hidden"));
$("#modal").addEventListener("click", (e) => { if (e.target === $("#modal")) $("#modal").classList.add("hidden"); });
$("#modal-save").addEventListener("click", () => {
  const day = state.weeks[currentWeekKey].days[editingDayIndex];
  day.morning = $("#edit-morning").value;
  day.noon = $("#edit-noon").value;
  day.evening = $("#edit-evening").value;
  day.notes = $("#edit-notes").value;
  day.protein = Math.max(0, parseInt($("#edit-protein").value, 10) || 0);
  day.fast = $("#edit-fast").checked;
  save();
  $("#modal").classList.add("hidden");
  renderMenu();
});

/* ============================ מסך אימונים ============================ */

function renderWorkout() {
  renderWorkoutChips();
  const w = ensureWorkout(currentWorkoutDate);

  $("#rope-minutes").value = w.ropeMinutes || "";
  $("#rope-rounds").value = w.ropeRounds || 10;

  renderExercises(w);
  renderPullups(w);

  const finishBtn = $("#btn-finish-workout");
  finishBtn.textContent = w.done ? "✔ האימון הושלם (לחץ לביטול)" : "✅ סיים אימון";
  finishBtn.classList.toggle("done", w.done);
}

function renderWorkoutChips() {
  const wrap = $("#workout-day-chips");
  wrap.innerHTML = "";
  const wk = weekKeyOf(new Date());
  for (const wd of WORKOUT_DAYS) {
    const dateIso = addDays(wk, wd);
    const chip = document.createElement("button");
    chip.className = "chip"
      + (dateIso === currentWorkoutDate ? " active" : "")
      + (state.workouts[dateIso] && state.workouts[dateIso].done ? " done" : "");
    chip.textContent = `${DAY_NAMES[wd]} ${shortDate(dateIso)}`;
    chip.addEventListener("click", () => { currentWorkoutDate = dateIso; renderWorkout(); });
    wrap.appendChild(chip);
  }
  // תאריך חופשי
  const dateChip = document.createElement("input");
  dateChip.type = "date";
  dateChip.className = "chip";
  dateChip.style.width = "150px";
  dateChip.value = currentWorkoutDate;
  dateChip.addEventListener("change", () => {
    if (dateChip.value) { currentWorkoutDate = dateChip.value; renderWorkout(); }
  });
  wrap.appendChild(dateChip);
}

$("#rope-minutes").addEventListener("input", () => {
  const w = ensureWorkout(currentWorkoutDate);
  w.ropeMinutes = parseFloat($("#rope-minutes").value) || 0;
  save();
});
$("#rope-rounds").addEventListener("input", () => {
  const w = ensureWorkout(currentWorkoutDate);
  w.ropeRounds = parseInt($("#rope-rounds").value, 10) || 10;
  save();
});

function renderExercises(w) {
  const wrap = $("#exercise-list");
  wrap.innerHTML = "";
  const prev = lastWorkoutBefore(currentWorkoutDate);

  for (const ex of EXERCISES) {
    const sets = w.exercises[ex.id];
    const box = document.createElement("div");
    box.className = "exercise";

    const head = document.createElement("div");
    head.className = "exercise-head";
    head.innerHTML = `<div><div class="exercise-name">${ex.name}</div><div class="exercise-equip">${ex.equip}</div></div>`;
    box.appendChild(head);

    if (prev && prev.exercises[ex.id] && prev.exercises[ex.id].length) {
      const p = prev.exercises[ex.id];
      const hint = document.createElement("div");
      hint.className = "prev-hint";
      hint.textContent = "אימון קודם: " + p.map((s) => `${s.reps}×${s.weight || 0}ק״ג`).join(" · ");
      box.appendChild(hint);
    }

    const table = document.createElement("table");
    table.className = "sets-table";
    table.innerHTML = `<thead><tr><th>סט</th><th>חזרות</th><th>משקל (ק״ג)</th><th></th></tr></thead>`;
    const tbody = document.createElement("tbody");

    sets.forEach((s, si) => {
      const tr = document.createElement("tr");
      const tdN = document.createElement("td"); tdN.textContent = si + 1;
      const tdR = document.createElement("td");
      const inR = document.createElement("input");
      inR.type = "number"; inR.min = 0; inR.inputMode = "numeric"; inR.value = s.reps;
      inR.addEventListener("input", () => { s.reps = parseInt(inR.value, 10) || 0; save(); });
      tdR.appendChild(inR);
      const tdW = document.createElement("td");
      const inW = document.createElement("input");
      inW.type = "number"; inW.min = 0; inW.step = 0.5; inW.inputMode = "decimal"; inW.value = s.weight;
      inW.addEventListener("input", () => { s.weight = parseFloat(inW.value) || 0; save(); });
      tdW.appendChild(inW);
      const tdD = document.createElement("td");
      const del = document.createElement("button");
      del.className = "del-set"; del.textContent = "✕";
      del.addEventListener("click", () => { sets.splice(si, 1); save(); renderExercises(w); });
      tdD.appendChild(del);
      tr.append(tdN, tdR, tdW, tdD);
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    box.appendChild(table);

    const add = document.createElement("button");
    add.className = "btn small add-set";
    add.textContent = "+ הוסף סט";
    add.addEventListener("click", () => {
      const last = sets[sets.length - 1] || { reps: ex.defReps, weight: ex.defWeight };
      sets.push({ reps: last.reps, weight: last.weight });
      save();
      renderExercises(w);
    });
    box.appendChild(add);
    wrap.appendChild(box);
  }
}

function renderPullups(w) {
  const wrap = $("#pullup-list");
  wrap.innerHTML = "";
  const table = document.createElement("table");
  table.className = "sets-table";
  table.innerHTML = `<thead><tr><th>סט</th><th>סוג</th><th>חזרות</th><th></th></tr></thead>`;
  const tbody = document.createElement("tbody");

  w.pullups.forEach((s, si) => {
    const tr = document.createElement("tr");
    const tdN = document.createElement("td"); tdN.textContent = si + 1;
    const tdT = document.createElement("td");
    const sel = document.createElement("select");
    for (const t of PULLUP_TYPES) {
      const opt = document.createElement("option");
      opt.value = t; opt.textContent = t;
      if (t === s.type) opt.selected = true;
      sel.appendChild(opt);
    }
    sel.addEventListener("change", () => { s.type = sel.value; save(); });
    tdT.appendChild(sel);
    const tdR = document.createElement("td");
    tdR.style.width = "70px";
    const inR = document.createElement("input");
    inR.type = "number"; inR.min = 0; inR.inputMode = "numeric"; inR.value = s.reps;
    inR.addEventListener("input", () => { s.reps = parseInt(inR.value, 10) || 0; save(); });
    tdR.appendChild(inR);
    const tdD = document.createElement("td");
    const del = document.createElement("button");
    del.className = "del-set"; del.textContent = "✕";
    del.addEventListener("click", () => { w.pullups.splice(si, 1); save(); renderPullups(w); });
    tdD.appendChild(del);
    tr.append(tdN, tdT, tdR, tdD);
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  wrap.appendChild(table);
}
$("#pullup-add").addEventListener("click", () => {
  const w = ensureWorkout(currentWorkoutDate);
  const last = w.pullups[w.pullups.length - 1];
  w.pullups.push(last ? { type: last.type, reps: last.reps } : { type: PULLUP_TYPES[0], reps: 3 });
  save();
  renderPullups(w);
});

$("#btn-finish-workout").addEventListener("click", () => {
  const w = ensureWorkout(currentWorkoutDate);
  w.done = !w.done;
  save();
  renderWorkout();
});

/* ---------- צלילים ---------- */
let audioCtx = null;
function beep(freq = 880, dur = 0.15) {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.frequency.value = freq;
    o.connect(g); g.connect(audioCtx.destination);
    g.gain.setValueAtTime(0.25, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
    o.start(); o.stop(audioCtx.currentTime + dur);
  } catch (e) {}
}

/* ---------- טיימר חבל 30/30 ---------- */
const rope = { running: false, phase: "work", secLeft: 30, round: 1, totalRounds: 10, interval: null };

function ropeRender() {
  const phaseEl = $("#rope-phase");
  if (!rope.running && rope.round === 1 && rope.phase === "work" && rope.secLeft === 30) {
    phaseEl.textContent = "מוכן?";
    phaseEl.className = "timer-phase";
    $("#rope-round").textContent = "";
  } else {
    phaseEl.textContent = rope.phase === "work" ? "🪢 קפיצה!" : "😮‍💨 מנוחה";
    phaseEl.className = "timer-phase " + rope.phase;
    $("#rope-round").textContent = `סבב ${rope.round} מתוך ${rope.totalRounds}`;
  }
  $("#rope-clock").textContent = `0:${String(rope.secLeft).padStart(2, "0")}`;
  $("#rope-start").textContent = rope.running ? "⏸ השהה" : "▶ התחל";
}

function ropeTick() {
  rope.secLeft--;
  if (rope.secLeft <= 3 && rope.secLeft > 0) beep(660, 0.1);
  if (rope.secLeft <= 0) {
    if (rope.phase === "work") {
      rope.phase = "rest";
      rope.secLeft = 30;
      beep(440, 0.3);
    } else {
      if (rope.round >= rope.totalRounds) {
        ropeFinish();
        return;
      }
      rope.round++;
      rope.phase = "work";
      rope.secLeft = 30;
      beep(880, 0.3);
    }
  }
  ropeRender();
}

function ropeFinish() {
  clearInterval(rope.interval);
  rope.running = false;
  beep(880, 0.2); setTimeout(() => beep(1100, 0.2), 220); setTimeout(() => beep(1320, 0.4), 440);
  const w = ensureWorkout(currentWorkoutDate);
  const minutes = rope.totalRounds; // כל סבב = 30 עבודה + 30 מנוחה = דקה
  w.ropeMinutes = Math.max(w.ropeMinutes || 0, minutes);
  w.ropeRounds = rope.totalRounds;
  save();
  $("#rope-minutes").value = w.ropeMinutes;
  $("#rope-phase").textContent = "🎉 סיימת!";
  $("#rope-phase").className = "timer-phase work";
  $("#rope-clock").textContent = "0:00";
  $("#rope-start").textContent = "▶ התחל";
}

$("#rope-start").addEventListener("click", () => {
  if (rope.running) {
    clearInterval(rope.interval);
    rope.running = false;
  } else {
    rope.totalRounds = parseInt($("#rope-rounds").value, 10) || 10;
    rope.running = true;
    beep(880, 0.2);
    rope.interval = setInterval(ropeTick, 1000);
  }
  ropeRender();
});
$("#rope-reset").addEventListener("click", () => {
  clearInterval(rope.interval);
  rope.running = false; rope.phase = "work"; rope.secLeft = 30; rope.round = 1;
  ropeRender();
});

/* ---------- טיימר מנוחה ---------- */
let restInterval = null;
$$(".rest-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    clearInterval(restInterval);
    let sec = parseInt(btn.dataset.sec, 10);
    const clock = $("#rest-clock");
    clock.classList.add("running");
    const draw = () => { clock.textContent = `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`; };
    draw();
    beep(660, 0.15);
    restInterval = setInterval(() => {
      sec--;
      if (sec <= 0) {
        clearInterval(restInterval);
        clock.textContent = "מנוחה נגמרה!";
        clock.classList.remove("running");
        beep(880, 0.2); setTimeout(() => beep(1100, 0.3), 220);
        return;
      }
      if (sec <= 3) beep(660, 0.1);
      draw();
    }, 1000);
  });
});

/* ============================ מסך התקדמות ============================ */

function renderProgress() {
  renderStreak();
  drawProteinChart();
  fillExerciseSelect();
  drawWeightsChart();
  drawPullupsChart();
}

function renderStreak() {
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
function setupCanvas(canvas) {
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

function drawEmpty(ctx, W, H, msg) {
  ctx.fillStyle = "#93a1af";
  ctx.font = "13px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(msg, W / 2, H / 2);
}

function drawProteinChart() {
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
  ctx.fillRect(pad.l, y(PROTEIN_MAX), W - pad.l - pad.r, y(PROTEIN_MIN) - y(PROTEIN_MAX));
  ctx.strokeStyle = "rgba(76, 208, 138, 0.5)";
  ctx.setLineDash([4, 4]);
  for (const t of [PROTEIN_MIN, PROTEIN_MAX]) {
    ctx.beginPath(); ctx.moveTo(pad.l, y(t)); ctx.lineTo(W - pad.r, y(t)); ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.fillStyle = "#93a1af";
  ctx.font = "10px sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("130", 4, y(PROTEIN_MIN) + 3);
  ctx.fillText("140", 4, y(PROTEIN_MAX) + 3);

  days.forEach((d, i) => {
    if (d.val == null) return;
    ctx.fillStyle = d.val >= PROTEIN_MIN ? "#4cd08a" : "#e8b44c";
    const bx = x(i) - barW / 2;
    ctx.fillRect(bx, y(d.val), barW, H - pad.b - y(d.val));
    if (i % 2 === 0) {
      ctx.fillStyle = "#93a1af";
      ctx.textAlign = "center";
      ctx.fillText(d.label, x(i), H - 8);
    }
  });
}

function fillExerciseSelect() {
  const sel = $("#chart-exercise-select");
  if (sel.options.length) return;
  for (const ex of EXERCISES) {
    const opt = document.createElement("option");
    opt.value = ex.id; opt.textContent = ex.name;
    sel.appendChild(opt);
  }
  sel.addEventListener("change", drawWeightsChart);
}

function completedWorkouts() {
  return Object.entries(state.workouts)
    .filter(([, w]) => w.done)
    .sort(([a], [b]) => (a < b ? -1 : 1));
}

function drawLineChart(canvas, points, unit) {
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

function drawWeightsChart() {
  const exId = $("#chart-exercise-select").value || EXERCISES[0].id;
  const points = completedWorkouts()
    .map(([date, w]) => {
      const sets = w.exercises[exId] || [];
      const maxW = Math.max(0, ...sets.map((s) => s.weight || 0));
      return { label: shortDate(date), val: maxW };
    })
    .slice(-10);
  drawLineChart($("#chart-weights"), points, "");
}

function drawPullupsChart() {
  const points = completedWorkouts()
    .map(([date, w]) => {
      const full = (w.pullups || []).filter((s) => s.type === PULLUP_TYPES[0]);
      return { label: shortDate(date), val: full.reduce((a, s) => a + (s.reps || 0), 0) };
    })
    .slice(-10);
  drawLineChart($("#chart-pullups"), points, "");
}

/* ============================ אתחול ============================ */

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}

renderMenu();
ropeRender();
