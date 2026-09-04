"use strict";

/* ============================================================
   המעקב של עדן — תזונה ואימונים
   כל הנתונים נשמרים מקומית ב-localStorage.
   ============================================================ */

const STORE_KEY = "edan-tracker-v1";
const DAY_NAMES = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
const WORKOUT_DAYS = [0, 1, 2, 3, 4, 5, 6]; // אימון כל יום
const STRENGTH_DAYS = [0, 2, 4]; // ימי משקולות מומלצים: ראשון, שלישי, חמישי
const DAY_SHORT = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];
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

/* ---------- מאגר מוצרים התחלתי (ערכים תזונתיים סטנדרטיים, ל-100 ג׳) ---------- */
const DEFAULT_PRODUCTS = [
  { id: "p-egg",     name: "ביצה",                protein100: 12.6, cal100: 143, unitName: "ביצה",   unitGrams: 55 },
  { id: "p-yogurt",  name: "יוגורט יווני 5%",     protein100: 9,    cal100: 97,  unitName: "גביע",   unitGrams: 150 },
  { id: "p-cottage", name: "קוטג׳ 5%",            protein100: 11,   cal100: 98,  unitName: "גביע",   unitGrams: 250 },
  { id: "p-chicken", name: "חזה עוף מבושל",       protein100: 31,   cal100: 165 },
  { id: "p-asado",   name: "אסאדו מבושל",         protein100: 26,   cal100: 300 },
  { id: "p-rice",    name: "אורז מבושל",          protein100: 2.7,  cal100: 130 },
  { id: "p-lentil",  name: "מרק עדשים",           protein100: 5,    cal100: 70,  unitName: "קערה",   unitGrams: 300 },
  { id: "p-tuna",    name: "טונה בשימורים (מסוננת)", protein100: 26, cal100: 116, unitName: "קופסה", unitGrams: 105 },
  { id: "p-powder",  name: "אבקת חלבון וניל",     protein100: 75,   cal100: 380, unitName: "סקופ",   unitGrams: 30 },
  { id: "p-almonds", name: "שקדים ואגוזים",       protein100: 20,   cal100: 590 },
  { id: "p-bread",   name: "לחם מלא",             protein100: 13,   cal100: 250, unitName: "פרוסה",  unitGrams: 35 },
  { id: "p-veg",     name: "ירקות / סלט",         protein100: 1.5,  cal100: 25 },
];
const DEFAULT_MEALS = [
  { id: "m-bowl", name: "קערת חלבון", items: [
    { productId: "p-yogurt", grams: 200 }, { productId: "p-powder", grams: 30 }, { productId: "p-almonds", grams: 20 },
  ]},
  { id: "m-tuna", name: "סלט טונה עם ביצה", items: [
    { productId: "p-tuna", grams: 105 }, { productId: "p-egg", grams: 55 }, { productId: "p-veg", grams: 150 },
  ]},
  { id: "m-chicken", name: "חזה עוף + אורז + ירקות", items: [
    { productId: "p-chicken", grams: 150 }, { productId: "p-rice", grams: 200 }, { productId: "p-veg", grams: 150 },
  ]},
];

/* ============================ state ============================ */

let state = load();
if (!state.products) {
  state.products = JSON.parse(JSON.stringify(DEFAULT_PRODUCTS));
  state.meals = JSON.parse(JSON.stringify(DEFAULT_MEALS));
  save();
}

const productById = (id) => state.products.find((p) => p.id === id);
const mealById = (id) => state.meals.find((m) => m.id === id);
const round1 = (n) => Math.round(n * 10) / 10;
function mealProtein(meal) {
  return round1(meal.items.reduce((a, it) => {
    const p = productById(it.productId);
    return a + (p ? (it.grams * p.protein100) / 100 : 0);
  }, 0));
}
function mealCal(meal) {
  return Math.round(meal.items.reduce((a, it) => {
    const p = productById(it.productId);
    return a + (p ? (it.grams * p.cal100) / 100 : 0);
  }, 0));
}
function newId(prefix) { return prefix + "-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

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
  return todayIso(); // אימון כל יום — ברירת המחדל היא היום
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
      ropeMode: prev ? (prev.ropeMode || "count") : "count",
      ropeMinutes: 0, ropeRounds: 10,
      ropeJumpsPerSet: prev ? (prev.ropeJumpsPerSet || 50) : 50,
      ropeTargetSets: prev ? (prev.ropeTargetSets || 6) : 6,
      ropeSetsDone: 0,
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
    if (target === "food") renderFood();
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

let scrolledToToday = false;

function renderMenu() {
  const week = ensureWeek(currentWeekKey);
  const endKey = addDays(currentWeekKey, 6);
  $("#week-label").textContent = `${shortDate(currentWeekKey)} – ${shortDate(endKey)}`;
  const now = new Date();
  $("#today-label").textContent = `היום: יום ${DAY_NAMES[now.getDay()]}, ${shortDate(todayIso())}`;

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

    let updateProtein = () => {}; // מוגדר בהמשך, אחרי בניית שורת החלבון

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
        updateProtein();
      });
      const slotP = (day.slotProtein || {})[meal.key];
      const badge = slotP != null ? `<span class="meal-badge">${slotP} ג׳</span>` : "";
      const txt = document.createElement("div");
      txt.innerHTML = `<span class="meal-label">${meal.label}${badge}</span><span class="meal-text">${escapeHtml(day[meal.key])}</span>`;
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

    updateProtein = () => {
      const slots = day.slotProtein || {};
      const hasSlots = MEALS.some((m) => slots[m.key] != null);
      if (hasSlots) {
        // כשמצורפות ארוחות מחושבות — הפס מתקדם לפי מה שבאמת נאכל
        const eaten = round1(MEALS.reduce((a, m) => a + (day.eaten[m.key] && slots[m.key] != null ? slots[m.key] : 0), 0));
        num.innerHTML = `נאכל: <b>${eaten}</b> / ${day.protein} ג׳`;
        fill.style.width = Math.min(100, (eaten / PROTEIN_MAX) * 100) + "%";
        fill.classList.toggle("ok", eaten >= PROTEIN_MIN);
      } else {
        num.innerHTML = `חלבון: <b>${day.protein}</b> ג׳`;
        fill.style.width = Math.min(100, (day.protein / PROTEIN_MAX) * 100) + "%";
        fill.classList.toggle("ok", day.protein >= PROTEIN_MIN);
      }
    };
    minus.addEventListener("click", () => { day.protein = Math.max(0, day.protein - 5); save(); updateProtein(); });
    plus.addEventListener("click", () => { day.protein += 5; save(); updateProtein(); });
    updateProtein();

    prow.append(minus, num, plus, bar);
    card.appendChild(prow);
    wrap.appendChild(card);
  });

  // בפתיחה הראשונה גוללים ליום הנוכחי
  if (!scrolledToToday) {
    scrolledToToday = true;
    const todayCard = wrap.querySelector(".day-card.today");
    if (todayCard) setTimeout(() => todayCard.scrollIntoView({ block: "start", behavior: "smooth" }), 100);
  }
}

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/* ---------- מודאל עריכת יום ---------- */
let editingDayIndex = null;
let editSlots = {}; // מצב זמני של ארוחות מצורפות בזמן עריכה

function fillMealPicker(sel, selectedId) {
  sel.innerHTML = "";
  const none = document.createElement("option");
  none.value = ""; none.textContent = "— צרף ארוחה מהספרייה —";
  sel.appendChild(none);
  for (const m of state.meals) {
    const opt = document.createElement("option");
    opt.value = m.id;
    opt.textContent = `${m.name} · ${mealProtein(m)} ג׳`;
    if (m.id === selectedId) opt.selected = true;
    sel.appendChild(opt);
  }
}

function refreshEditProteinTotal() {
  const vals = MEALS.map((m) => editSlots[m.key].protein).filter((v) => v != null);
  if (vals.length) $("#edit-protein").value = Math.round(vals.reduce((a, b) => a + b, 0));
  for (const m of MEALS) {
    $("#slot-protein-" + m.key).textContent = editSlots[m.key].protein != null ? `${editSlots[m.key].protein} ג׳` : "";
  }
}

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
  const mealIds = day.mealIds || {};
  const slotP = day.slotProtein || {};
  editSlots = {};
  for (const m of MEALS) {
    editSlots[m.key] = { mealId: mealIds[m.key] || "", protein: slotP[m.key] != null ? slotP[m.key] : null };
    fillMealPicker($("#meal-pick-" + m.key), editSlots[m.key].mealId);
  }
  refreshEditProteinTotal();
  $("#modal").classList.remove("hidden");
}

const SLOT_FIELDS = { morning: "#edit-morning", noon: "#edit-noon", evening: "#edit-evening" };
for (const m of MEALS) {
  $("#meal-pick-" + m.key).addEventListener("change", (e) => {
    const id = e.target.value;
    if (id) {
      const meal = mealById(id);
      editSlots[m.key] = { mealId: id, protein: mealProtein(meal) };
      const names = meal.items.map((it) => (productById(it.productId) || { name: "?" }).name).join(", ");
      $(SLOT_FIELDS[m.key]).value = `${meal.name} (${names})`;
    } else {
      editSlots[m.key] = { mealId: "", protein: null };
    }
    refreshEditProteinTotal();
  });
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
  day.mealIds = {}; day.slotProtein = {};
  for (const m of MEALS) {
    day.mealIds[m.key] = editSlots[m.key].mealId || null;
    day.slotProtein[m.key] = editSlots[m.key].protein;
  }
  save();
  $("#modal").classList.add("hidden");
  renderMenu();
});

/* ============================ מסך אימונים ============================ */

function renderWorkout() {
  renderWorkoutChips();
  const w = ensureWorkout(currentWorkoutDate);

  const wd = fromIso(currentWorkoutDate).getDay();
  $("#workout-day-type").textContent = STRENGTH_DAYS.includes(wd)
    ? "💪 יום משקולות: פול־בודי + חבל + מתח"
    : "🪢 יום קל: חבל + מתח (בלי משקולות — מנוחה לשרירים)";

  renderRope(w);
  renderExercises(w);
  renderPullups(w);

  const finishBtn = $("#btn-finish-workout");
  finishBtn.textContent = w.done ? "✔ האימון הושלם (לחץ לביטול)" : "✅ סיים אימון";
  finishBtn.classList.toggle("done", w.done);
}

function renderWorkoutChips() {
  // מהיום ושבוע קדימה — לא מציגים ימים שכבר עברו
  const wrap = $("#workout-day-chips");
  wrap.innerHTML = "";
  for (let i = 0; i < 7; i++) {
    const dateIso = addDays(todayIso(), i);
    const wd = fromIso(dateIso).getDay();
    const chip = document.createElement("button");
    chip.className = "chip"
      + (dateIso === currentWorkoutDate ? " active" : "")
      + (i === 0 ? " today" : "")
      + (state.workouts[dateIso] && state.workouts[dateIso].done ? " done" : "");
    chip.textContent = i === 0 ? `היום · ${DAY_SHORT[wd]}` : `${DAY_SHORT[wd]} ${shortDate(dateIso)}`;
    chip.addEventListener("click", () => { currentWorkoutDate = dateIso; renderWorkout(); });
    wrap.appendChild(chip);
  }
  // תאריך חופשי — למשל כדי להשלים רישום של אימון מאתמול
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

/* ---------- חבל: מצב ספירה / מצב זמן ---------- */
function renderRope(w) {
  const mode = w.ropeMode || "count";
  $("#rope-mode-count").classList.toggle("active", mode === "count");
  $("#rope-mode-time").classList.toggle("active", mode === "time");
  $("#rope-count-box").classList.toggle("hidden", mode !== "count");
  $("#rope-time-box").classList.toggle("hidden", mode !== "time");

  $("#rope-jumps-per-set").value = w.ropeJumpsPerSet || 50;
  $("#rope-target-sets").value = w.ropeTargetSets || 6;
  $("#rope-sets-done").textContent = w.ropeSetsDone || 0;
  $("#rope-total-jumps").textContent = (w.ropeSetsDone || 0) * (w.ropeJumpsPerSet || 50);

  $("#rope-minutes").value = w.ropeMinutes || "";
  $("#rope-rounds").value = w.ropeRounds || 10;
}

$("#rope-mode-count").addEventListener("click", () => {
  const w = ensureWorkout(currentWorkoutDate);
  w.ropeMode = "count"; save(); renderRope(w);
});
$("#rope-mode-time").addEventListener("click", () => {
  const w = ensureWorkout(currentWorkoutDate);
  w.ropeMode = "time"; save(); renderRope(w);
});
$("#rope-jumps-per-set").addEventListener("input", () => {
  const w = ensureWorkout(currentWorkoutDate);
  w.ropeJumpsPerSet = parseInt($("#rope-jumps-per-set").value, 10) || 50;
  save(); renderRope(w);
});
$("#rope-target-sets").addEventListener("input", () => {
  const w = ensureWorkout(currentWorkoutDate);
  w.ropeTargetSets = parseInt($("#rope-target-sets").value, 10) || 6;
  save();
});
$("#rope-set-done").addEventListener("click", () => {
  const w = ensureWorkout(currentWorkoutDate);
  w.ropeSetsDone = (w.ropeSetsDone || 0) + 1;
  save(); renderRope(w);
  beep(880, 0.15);
  if (w.ropeSetsDone === (w.ropeTargetSets || 6)) {
    setTimeout(() => beep(1100, 0.2), 180); setTimeout(() => beep(1320, 0.3), 380);
  }
});
$("#rope-set-undo").addEventListener("click", () => {
  const w = ensureWorkout(currentWorkoutDate);
  w.ropeSetsDone = Math.max(0, (w.ropeSetsDone || 0) - 1);
  save(); renderRope(w);
});

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
  try { if (navigator.vibrate) navigator.vibrate(120); } catch (e) {}
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

/* ============================ מסך מזון ============================ */

function renderFood() {
  const plist = $("#product-list");
  plist.innerHTML = "";
  for (const p of state.products) {
    const row = document.createElement("div");
    row.className = "food-item";
    const unit = p.unitName && p.unitGrams ? ` · ${p.unitName} = ${p.unitGrams} ג׳` : "";
    row.innerHTML = `<div><div class="food-item-name">${escapeHtml(p.name)}</div>
      <div class="food-item-info">${p.cal100} קק״ל ל־100 ג׳${unit}</div></div>
      <div class="food-item-protein">${p.protein100} ג׳/100</div>`;
    row.addEventListener("click", () => openProductEditor(p.id));
    plist.appendChild(row);
  }

  const mlist = $("#meal-list");
  mlist.innerHTML = "";
  for (const m of state.meals) {
    const row = document.createElement("div");
    row.className = "food-item";
    const names = m.items.map((it) => (productById(it.productId) || { name: "?" }).name).join(", ");
    row.innerHTML = `<div><div class="food-item-name">${escapeHtml(m.name)}</div>
      <div class="food-item-info">${escapeHtml(names)} · ${mealCal(m)} קק״ל</div></div>
      <div class="food-item-protein">${mealProtein(m)} ג׳</div>`;
    row.addEventListener("click", () => openMealEditor(m.id));
    mlist.appendChild(row);
  }
}

/* ---------- מודאל בדיקה ---------- */
let reviewConfirmAction = null;
function showReview(notes, onConfirm) {
  const box = $("#review-notes");
  box.innerHTML = "";
  const icons = { error: "⛔", warn: "⚠️", ok: "✅", info: "🔢" };
  for (const n of notes) {
    const div = document.createElement("div");
    div.className = "review-note " + n.level;
    div.innerHTML = `<span>${icons[n.level]}</span><span>${escapeHtml(n.text)}</span>`;
    box.appendChild(div);
  }
  const hasError = notes.some((n) => n.level === "error");
  $("#review-confirm").disabled = hasError;
  $("#review-confirm").textContent = hasError ? "יש שגיאה — תקן קודם" : "אשר ושמור";
  reviewConfirmAction = onConfirm;
  $("#review-modal").classList.remove("hidden");
}
$("#review-back").addEventListener("click", () => { $("#review-modal").classList.add("hidden"); });
$("#review-confirm").addEventListener("click", () => {
  $("#review-modal").classList.add("hidden");
  if (reviewConfirmAction) reviewConfirmAction();
});

/* ---------- בדיקות סבירות (מבוססות על כללי תזונה בסיסיים) ---------- */
function reviewProduct(p) {
  const notes = [];
  if (!p.name.trim()) notes.push({ level: "error", text: "חסר שם למוצר." });
  if (p.protein100 > 100) notes.push({ level: "error", text: `${p.protein100} ג׳ חלבון ב־100 ג׳ מוצר — בלתי אפשרי (המקסימום הוא 100).` });
  else if (p.protein100 > 45 && p.cal100 < 500)
    notes.push({ level: "warn", text: `${p.protein100} ג׳ חלבון ל־100 ג׳ זה גבוה מאוד — הגיוני רק לאבקת חלבון או בשר מיובש. בדוק את התווית.` });
  if (p.cal100 > 0 && p.cal100 < p.protein100 * 4)
    notes.push({ level: "error", text: `${p.cal100} קק״ל נמוך מדי: חלבון לבדו נותן ${Math.round(p.protein100 * 4)} קק״ל (4 קק״ל לגרם). כנראה טעות באחד המספרים.` });
  if (p.cal100 > 900) notes.push({ level: "warn", text: "מעל 900 קק״ל ל־100 ג׳ — רק שמן טהור מגיע לזה. בדוק את המספר." });
  if (p.unitGrams > 1000) notes.push({ level: "warn", text: "משקל יחידה מעל קילו — בטוח?" });
  if (p.unitName && !p.unitGrams) notes.push({ level: "warn", text: "הגדרת שם יחידה בלי משקל — לא יהיה אפשר לחשב לפי יחידות." });
  if (p.protein100 === 0) notes.push({ level: "info", text: "מוצר בלי חלבון — לגיטימי (ירקות, שמן), רק מוודא שזו הכוונה." });
  if (!notes.some((n) => n.level === "error" || n.level === "warn"))
    notes.push({ level: "ok", text: "הערכים נראים סבירים." });
  return notes;
}

function reviewMeal(m) {
  const notes = [];
  if (!m.name.trim()) notes.push({ level: "error", text: "חסר שם לארוחה." });
  if (!m.items.length) notes.push({ level: "error", text: "הארוחה ריקה — הוסף לפחות מוצר אחד." });
  let totalGrams = 0;
  for (const it of m.items) {
    const p = productById(it.productId);
    if (!p) { notes.push({ level: "error", text: "אחד המוצרים בארוחה לא קיים יותר." }); continue; }
    totalGrams += it.grams;
    notes.push({ level: "info", text: `${p.name}: ${it.grams} ג׳ × ${p.protein100}/100 = ${round1((it.grams * p.protein100) / 100)} ג׳ חלבון` });
    if (it.grams > 500) notes.push({ level: "warn", text: `${it.grams} ג׳ ${p.name} — כמות גדולה מאוד למנה אחת. בטוח?` });
    if (it.grams <= 0) notes.push({ level: "error", text: `כמות לא תקינה עבור ${p.name}.` });
  }
  const prot = mealProtein(m), cal = mealCal(m);
  notes.push({ level: "info", text: `סה״כ: ${prot} ג׳ חלבון, ${cal} קק״ל, ${totalGrams} ג׳ אוכל.` });
  if (prot > 70) notes.push({ level: "warn", text: "מעל 70 ג׳ חלבון בארוחה אחת — הגוף מנצל, אבל זה חריג. ודא את הכמויות." });
  if (prot < 10 && m.items.length) notes.push({ level: "warn", text: `רק ${prot} ג׳ חלבון — ארוחה דלת חלבון. בסדר אם זו הכוונה, אבל היא לא תקדם אותך ליעד היומי.` });
  if (totalGrams > 1200) notes.push({ level: "warn", text: "מעל 1.2 ק״ג אוכל בארוחה — נשמע הרבה. בדוק את הכמויות." });
  if (!notes.some((n) => n.level === "error" || n.level === "warn"))
    notes.push({ level: "ok", text: "הארוחה נראית מאוזנת והחישוב תקין." });
  return notes;
}

/* ---------- עורך מוצר ---------- */
let editingProductId = null;
function openProductEditor(id) {
  editingProductId = id;
  const p = id ? productById(id) : null;
  $("#product-modal-title").textContent = p ? `עריכת ${p.name}` : "מוצר חדש";
  $("#prod-name").value = p ? p.name : "";
  $("#prod-protein").value = p ? p.protein100 : "";
  $("#prod-cal").value = p ? p.cal100 : "";
  $("#prod-unit-name").value = p && p.unitName ? p.unitName : "";
  $("#prod-unit-grams").value = p && p.unitGrams ? p.unitGrams : "";
  $("#product-delete").classList.toggle("hidden", !p);
  $("#product-modal").classList.remove("hidden");
}
$("#product-add").addEventListener("click", () => openProductEditor(null));
$("#product-cancel").addEventListener("click", () => $("#product-modal").classList.add("hidden"));
$("#product-delete").addEventListener("click", () => {
  const usedBy = state.meals.filter((m) => m.items.some((it) => it.productId === editingProductId));
  if (usedBy.length) { alert(`אי אפשר למחוק — המוצר בשימוש בארוחות: ${usedBy.map((m) => m.name).join(", ")}`); return; }
  if (!confirm("למחוק את המוצר?")) return;
  state.products = state.products.filter((p) => p.id !== editingProductId);
  save();
  $("#product-modal").classList.add("hidden");
  renderFood();
});
$("#product-save").addEventListener("click", () => {
  const p = {
    id: editingProductId || newId("p"),
    name: $("#prod-name").value.trim(),
    protein100: parseFloat($("#prod-protein").value) || 0,
    cal100: parseFloat($("#prod-cal").value) || 0,
    unitName: $("#prod-unit-name").value.trim() || undefined,
    unitGrams: parseFloat($("#prod-unit-grams").value) || undefined,
  };
  showReview(reviewProduct(p), () => {
    const idx = state.products.findIndex((x) => x.id === p.id);
    if (idx >= 0) state.products[idx] = p; else state.products.push(p);
    save();
    $("#product-modal").classList.add("hidden");
    renderFood();
  });
});

/* ---------- עורך ארוחה ---------- */
let editingMeal = null; // עותק עבודה זמני
function openMealEditor(id) {
  const m = id ? mealById(id) : null;
  editingMeal = m
    ? JSON.parse(JSON.stringify(m))
    : { id: null, name: "", items: [] };
  $("#meal-modal-title").textContent = m ? `עריכת ${m.name}` : "ארוחה חדשה";
  $("#meal-name").value = editingMeal.name;
  $("#meal-delete").classList.toggle("hidden", !m);
  renderMealItems();
  $("#meal-modal").classList.remove("hidden");
}
function renderMealItems() {
  const wrap = $("#meal-items");
  wrap.innerHTML = "";
  editingMeal.items.forEach((it, i) => {
    const row = document.createElement("div");
    row.className = "meal-item-row";
    const sel = document.createElement("select");
    for (const p of state.products) {
      const opt = document.createElement("option");
      opt.value = p.id; opt.textContent = p.name;
      if (p.id === it.productId) opt.selected = true;
      sel.appendChild(opt);
    }
    sel.addEventListener("change", () => { it.productId = sel.value; renderMealItems(); });
    const amt = document.createElement("input");
    amt.type = "number"; amt.min = 0; amt.step = 5; amt.inputMode = "numeric"; amt.value = it.grams;
    amt.placeholder = "גרם";
    amt.addEventListener("input", () => { it.grams = parseFloat(amt.value) || 0; updateMealTotals(); });
    const del = document.createElement("button");
    del.className = "del-set"; del.textContent = "✕";
    del.addEventListener("click", () => { editingMeal.items.splice(i, 1); renderMealItems(); });
    row.append(sel, amt, del);
    wrap.appendChild(row);

    const p = productById(it.productId);
    if (p) {
      const calc = document.createElement("div");
      calc.className = "meal-item-calc";
      const unitHint = p.unitName && p.unitGrams ? ` (${p.unitName} = ${p.unitGrams} ג׳)` : "";
      calc.textContent = `= ${round1((it.grams * p.protein100) / 100)} ג׳ חלבון, ${Math.round((it.grams * p.cal100) / 100)} קק״ל${unitHint}`;
      wrap.appendChild(calc);
    }
  });
  updateMealTotals();
}
function updateMealTotals() {
  $("#meal-totals").innerHTML = editingMeal.items.length
    ? `סה״כ: <span>${mealProtein(editingMeal)} ג׳ חלבון</span> · ${mealCal(editingMeal)} קק״ל`
    : "";
}
$("#meal-add").addEventListener("click", () => openMealEditor(null));
$("#meal-cancel").addEventListener("click", () => $("#meal-modal").classList.add("hidden"));
$("#meal-item-add").addEventListener("click", () => {
  const first = state.products[0];
  editingMeal.items.push({ productId: first ? first.id : "", grams: 100 });
  renderMealItems();
});
$("#meal-delete").addEventListener("click", () => {
  if (!confirm("למחוק את הארוחה?")) return;
  state.meals = state.meals.filter((m) => m.id !== editingMeal.id);
  save();
  $("#meal-modal").classList.add("hidden");
  renderFood();
});
$("#meal-save").addEventListener("click", () => {
  editingMeal.name = $("#meal-name").value.trim();
  showReview(reviewMeal(editingMeal), () => {
    if (!editingMeal.id) editingMeal.id = newId("m");
    const idx = state.meals.findIndex((x) => x.id === editingMeal.id);
    if (idx >= 0) state.meals[idx] = editingMeal; else state.meals.push(editingMeal);
    save();
    $("#meal-modal").classList.add("hidden");
    renderFood();
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
