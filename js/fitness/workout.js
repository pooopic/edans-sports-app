"use strict";
import { registerScreen } from "../core/nav.js";
import { CURL_NAMES, DAY_NAMES, DAY_SHORT, EX_MODES, PULLUP_TYPES, REST_DAY, STRENGTH_DAYS } from "../core/constants.js";
import { addDays, fromIso, shortDate, todayIso } from "../core/dates.js";
import { newId, round1 } from "../core/model.js";
import { save, state, view } from "../core/state.js";
import { $, $$, beep, enableDrag, escapeHtml } from "../core/ui.js";
import { defaultSets, exLibById, freshSetsFor, getWorkout, lastSetsFor, rwkById, templateById } from "./model.js";
import { renderRunWorkouts } from "./runbuilder.js";

/* ============================ מסך אימונים ============================ */



export function renderWorkout() {
  renderWorkoutChips();
  exTimerReset(); // מעבר יום לא משאיר טיימר רץ שיישמר ליום הלא נכון
  const wd = fromIso(view.workoutDate).getDay();
  const isRestDay = wd === REST_DAY;
  const isStrength = STRENGTH_DAYS.includes(wd);
  // שבת = מנוחה, אלא אם נרשם אימון ספונטני ("בכל זאת התאמנתי")
  const existing = state.workouts[view.workoutDate];
  const isRest = isRestDay && !(existing && existing.logAnyway);

  $("#card-rest").classList.toggle("hidden", !isRest);
  $("#card-rope").classList.toggle("hidden", isRest);
  $("#card-exercises").classList.toggle("hidden", isRest);
  $("#card-timer").classList.toggle("hidden", isRest);
  $("#btn-finish-workout").classList.toggle("hidden", isRest);

  if (isRest) {
    $("#workout-day-type").textContent = "😴 מנוחה מלאה";
    return;
  }

  const w = getWorkout(view.workoutDate);

  $("#workout-day-type").textContent = isRestDay
    ? "🏋️ אימון ספונטני בשבת — נרשם רגיל"
    : isStrength
      ? "💪 אימון כוח: חבל (חימום) ← מתח ← משקולות"
      : "🏃 ריצה (או חבל אם לא רצת) + ליבה";
  $("#rope-role").textContent = isStrength ? "· חימום 5–8 דק׳" : "· אם לא רצת";

  renderRope(w);
  renderDayExercises(w);
  renderRunWorkouts();

  const finishBtn = $("#btn-finish-workout");
  finishBtn.textContent = w.done ? "✔ האימון הושלם (לחץ לביטול)" : "✅ סיים אימון";
  finishBtn.classList.toggle("done", w.done);
}

/* ---------- ריצה ---------- */
export function paceText(km, minutes) {
  if (!km || !minutes) return "—";
  const paceMin = minutes / km;
  const mm = Math.floor(paceMin);
  const ss = Math.round((paceMin - mm) * 60);
  return `${mm}:${String(ss).padStart(2, "0")} דק׳/ק״מ`;
}
$("#btn-rest-log").addEventListener("click", () => {
  const w = getWorkout(view.workoutDate);
  if (!w.logAnyway && !w.done) { w.exList = []; w.ex = {}; } // יום חופשי מתחיל ריק — מוסיפים רק מה שבאמת בוצע
  w.logAnyway = true;
  save();
  renderWorkout();
});

/* ---------- רשימת התרגילים של היום (מודולרית) ---------- */
export function exDisplayName(lib, w) {
  if (lib.id === "curl") return `${CURL_NAMES[w.curlVariant] || CURL_NAMES.hammer} <span class="meal-badge">היום</span>`;
  return escapeHtml(lib.name);
}
export function formatPrevSets(lib, sets) {
  if (lib.mode === "run") return sets.map((s) => `${s.km || 0} ק״מ / ${s.minutes || 0} דק׳`).join(" · ");
  if (lib.mode === "weight") return sets.map((s) => `${s.reps}×${s.weight || 0}ק״ג`).join(" · ");
  if (lib.mode === "pullup") return sets.map((s) => `${s.reps} ${s.variant === PULLUP_TYPES[0] ? "מלא" : "גומייה"}`).join(" · ");
  const done = sets.filter((s) => s.done);
  const use = done.length ? done : sets;
  return use.map((s) => (lib.mode === "seconds" ? s.secs : s.reps) || 0).join(" · ") + (lib.mode === "seconds" ? " שנ׳" : " חזרות");
}

export function demoVideoUrl(lib) {
  if (lib.videoUrl) return lib.videoUrl;
  const q = lib.demoQuery || `${lib.name} exercise proper form`;
  return "https://www.youtube.com/results?search_query=" + encodeURIComponent(q);
}

export function openDemoModal(lib) {
  $("#demo-name").textContent = lib.name;
  $("#demo-hint").textContent = lib.hint || "";
  const ul = $("#demo-cues");
  ul.innerHTML = "";
  const cues = lib.cues && lib.cues.length ? lib.cues : ["שמור על טכניקה נקייה וטווח תנועה מבוקר", "עדיף משקל קל ונקי ממשקל כבד ומרושל", "כאב חד = עוצרים"];
  for (const c of cues) {
    const li = document.createElement("li");
    li.textContent = c;
    li.style.margin = "4px 0";
    ul.appendChild(li);
  }
  $("#demo-video").href = demoVideoUrl(lib);
  $("#demo-modal").classList.remove("hidden");
}
$("#demo-cancel").addEventListener("click", () => $("#demo-modal").classList.add("hidden"));

/* w.run הוא סיכום הריצה של היום (לגרפים, לגאנט ולהיסטוריה) — נגזר מסטים של תרגיל הריצה */
export function syncRunMirror(w) {
  const sets = (w.ex && w.ex.runx) || [];
  w.run.km = round1(sets.reduce((a, s) => a + (s.km || 0), 0));
  w.run.minutes = Math.round(sets.reduce((a, s) => a + (s.minutes || 0), 0));
}
/* מה מתוכנן לריצה של היום — מהצומת בתכנון או משיבוץ ידני מהבנאי */
export function plannedRunFor(dateIso, w) {
  if (w.runPlanName) return w.runPlanName;
  const n = state.plan && state.plan.nodes.find((x) => x.lane === "run" && x.date === dateIso);
  if (!n) return null;
  const rw = n.runWorkoutId ? rwkById(n.runWorkoutId) : null;
  return rw ? rw.name : n.label;
}

export function renderDayExercises(w) {
  parkExTimer(); // אם הטיימר יושב בתוך בלוק — מחלצים אותו לפני שהרשימה נבנית מחדש
  syncRunMirror(w);
  const wrap = $("#day-ex-list");
  wrap.innerHTML = "";
  for (const exId of w.exList) {
    const lib = exLibById(exId);
    if (!lib) continue;
    const sets = w.ex[exId];
    const block = document.createElement("div");
    block.className = "exercise";
    block.dataset.exId = exId;

    const head = document.createElement("div");
    head.className = "exercise-head";
    const handle = document.createElement("span");
    handle.className = "drag-handle";
    handle.textContent = "≡";
    const nameDiv = document.createElement("div");
    nameDiv.className = "grow";
    nameDiv.innerHTML = `<div class="exercise-name">${exDisplayName(lib, w)}</div><div class="exercise-equip">${escapeHtml(lib.hint || "")}</div>`;
    const demoBtn = document.createElement("button");
    demoBtn.className = "del-set demo-btn";
    demoBtn.textContent = "🎬";
    demoBtn.title = "הדגמה ודגשי טכניקה";
    demoBtn.addEventListener("click", () => openDemoModal(lib));
    const removeBtn = document.createElement("button");
    removeBtn.className = "del-set";
    removeBtn.textContent = "✕";
    removeBtn.title = "הסר מהאימון של היום";
    removeBtn.addEventListener("click", () => {
      w.exList = w.exList.filter((id) => id !== exId);
      save();
      renderDayExercises(w);
    });
    head.append(handle, nameDiv, demoBtn, removeBtn);
    block.appendChild(head);

    if (lib.mode === "run") {
      const plan = plannedRunFor(view.workoutDate, w);
      if (plan) {
        const planEl = document.createElement("div");
        planEl.className = "prev-hint";
        planEl.textContent = "🛠 מתוכנן: " + plan;
        block.appendChild(planEl);
      }
    }
    const prev = lastSetsFor(exId, view.workoutDate);
    if (prev) {
      const hintEl = document.createElement("div");
      hintEl.className = "prev-hint";
      hintEl.textContent = "אימון קודם: " + formatPrevSets(lib, prev);
      block.appendChild(hintEl);
    }

    block.appendChild(buildSetsTable(lib, sets, w));

    const add = document.createElement("button");
    add.className = "btn small add-set";
    add.textContent = "+ הוסף סט";
    add.addEventListener("click", () => {
      const last = sets[sets.length - 1];
      sets.push(last ? { ...last, done: false } : defaultSets(lib)[0]);
      save();
      renderDayExercises(w);
    });
    block.appendChild(add);

    enableDrag(handle, block, wrap, (orderIds) => {
      w.exList.sort((a, b) => orderIds.indexOf(a) - orderIds.indexOf(b));
      save();
      renderDayExercises(w);
    });
    wrap.appendChild(block);
  }
}

export function buildSetsTable(lib, sets, w) {
  const cols = {
    weight: ["סט", "חזרות", "משקל (ק״ג)", ""],
    reps: ["סט", "חזרות", "בוצע", ""],
    seconds: ["סט", "שניות", "", "בוצע", ""],
    pullup: ["סט", "סוג", "חזרות", ""],
    run: ["", "ק״מ", "דקות", "קצב", ""],
  }[lib.mode] || ["סט", "חזרות", ""];
  const table = document.createElement("table");
  table.className = "sets-table";
  table.innerHTML = `<thead><tr>${cols.map((c) => `<th>${c}</th>`).join("")}</tr></thead>`;
  const tbody = document.createElement("tbody");

  sets.forEach((s, si) => {
    const tr = document.createElement("tr");
    const td = (child) => { const t = document.createElement("td"); if (child) t.appendChild(child); return t; };
    const numInput = (val, onSet) => {
      const i = document.createElement("input");
      i.type = "number"; i.min = 0; i.inputMode = "numeric"; i.value = val || 0;
      if (lib.mode === "weight") i.step = 0.5;
      i.addEventListener("input", () => { onSet(parseFloat(i.value) || 0); save(); });
      return i;
    };
    const doneCb = () => {
      const cb = document.createElement("input");
      cb.type = "checkbox"; cb.checked = !!s.done;
      cb.style.width = "22px"; cb.style.height = "22px"; cb.style.accentColor = "var(--accent)";
      cb.addEventListener("change", () => { s.done = cb.checked; save(); });
      return cb;
    };
    const delBtn = () => {
      const b = document.createElement("button");
      b.className = "del-set"; b.textContent = "✕";
      b.addEventListener("click", () => { sets.splice(si, 1); save(); renderDayExercises(w); });
      return b;
    };
    const numCell = document.createElement("td");
    numCell.textContent = si + 1;
    tr.appendChild(numCell);

    if (lib.mode === "weight") {
      tr.append(td(numInput(s.reps, (v) => { s.reps = v; })), td(numInput(s.weight, (v) => { s.weight = v; })), td(delBtn()));
    } else if (lib.mode === "reps") {
      tr.append(td(numInput(s.reps, (v) => { s.reps = v; })), td(doneCb()), td(delBtn()));
    } else if (lib.mode === "seconds") {
      const secsInput = numInput(s.secs, (v) => { s.secs = v; });
      const goBtn = document.createElement("button");
      goBtn.className = "btn small";
      goBtn.textContent = "▶";
      goBtn.addEventListener("click", () => exTimerStart(lib, s, secsInput));
      tr.append(td(secsInput), td(goBtn), td(doneCb()), td(delBtn()));
    } else if (lib.mode === "pullup") {
      const sel = document.createElement("select");
      for (const t of PULLUP_TYPES) {
        const opt = document.createElement("option");
        opt.value = t; opt.textContent = t;
        if (t === s.variant) opt.selected = true;
        sel.appendChild(opt);
      }
      sel.addEventListener("change", () => { s.variant = sel.value; save(); });
      const repsTd = td(numInput(s.reps, (v) => { s.reps = v; }));
      repsTd.style.width = "70px";
      tr.append(td(sel), repsTd, td(delBtn()));
    } else if (lib.mode === "run") {
      const paceTd = document.createElement("td");
      paceTd.className = "run-pace-cell";
      paceTd.textContent = paceText(s.km, s.minutes);
      const upd = () => { paceTd.textContent = paceText(s.km, s.minutes); syncRunMirror(w); };
      const kmIn = numInput(s.km, (v) => { s.km = v; upd(); });
      kmIn.step = 0.1; kmIn.inputMode = "decimal";
      const minIn = numInput(s.minutes, (v) => { s.minutes = v; upd(); });
      tr.append(td(kmIn), td(minIn), paceTd, td(delBtn()));
    }
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  return table;
}

/* ---------- טיימר שניות (פלאנק, Suitcase Carry...): היכון 5 שנ' -> שעון עולה ---------- */
export const exTimer = { phase: "idle", interval: null, sec: 0, target: 0, set: null, input: null, name: "" };

export function exTimerDraw() {
  if (exTimer.phase === "countdown") {
    $("#ex-timer-phase").textContent = `היכון — ${exTimer.name}`;
    $("#ex-timer-phase").className = "timer-phase rest";
    $("#ex-timer-time").textContent = exTimer.sec;
  } else if (exTimer.phase === "work") {
    const hit = exTimer.target && exTimer.sec >= exTimer.target;
    $("#ex-timer-phase").textContent = exTimer.name +
      (exTimer.target ? ` · יעד ${exTimer.target} שנ׳${hit ? " — עברת! 🎉" : ""}` : "");
    $("#ex-timer-phase").className = "timer-phase work";
    $("#ex-timer-time").textContent = `${Math.floor(exTimer.sec / 60)}:${String(exTimer.sec % 60).padStart(2, "0")}`;
  }
}
/* הפאנל חוזר למקום קבוע בכרטיס — כדי שרינדור מחדש של הרשימה לא ימחק אותו */
export function parkExTimer() {
  const panel = $("#ex-timer");
  const home = $("#card-exercises");
  if (panel && home && panel.parentElement !== home) home.appendChild(panel);
}
export function exTimerReset() {
  clearInterval(exTimer.interval);
  exTimer.phase = "idle";
  $("#ex-timer").classList.add("hidden");
  parkExTimer();
}
export function exTimerStart(lib, set, input) {
  clearInterval(exTimer.interval);
  exTimer.set = set;
  exTimer.input = input;
  exTimer.name = lib.name;
  exTimer.target = set.secs || 0;
  exTimer.phase = "countdown";
  exTimer.sec = 5;
  const panel = $("#ex-timer");
  // הטיימר מופיע בתוך בלוק התרגיל שלחצת בו — לא בתחתית המסך
  const block = input.closest(".exercise");
  if (block) block.appendChild(panel);
  panel.classList.remove("hidden");
  panel.scrollIntoView({ block: "center", behavior: "smooth" });
  exTimerDraw();
  beep(660, 0.1);
  exTimer.interval = setInterval(() => {
    if (exTimer.phase === "countdown") {
      exTimer.sec--;
      if (exTimer.sec > 0) beep(660, 0.1);
      else { exTimer.phase = "work"; exTimer.sec = 0; beep(880, 0.3); }
    } else {
      exTimer.sec++;
      if (exTimer.target && exTimer.sec === exTimer.target) {
        beep(880, 0.2); setTimeout(() => beep(1100, 0.3), 220);
      }
    }
    exTimerDraw();
  }, 1000);
}
$("#ex-timer-reset").addEventListener("click", exTimerReset);
$("#ex-timer-stop").addEventListener("click", () => {
  if (exTimer.phase === "work" && exTimer.sec > 0 && exTimer.set) {
    exTimer.set.secs = exTimer.sec;
    exTimer.set.done = true;
    save();
    if (exTimer.input) exTimer.input.value = exTimer.sec;
    beep(1100, 0.2);
    renderWorkout();
  }
  exTimerReset();
});

/* ---------- הוספת תרגיל / טעינת אימון / שמירת אימון ---------- */
$("#day-ex-add").addEventListener("click", () => {
  const w = getWorkout(view.workoutDate);
  const sel = $("#ex-pick");
  sel.innerHTML = "";
  for (const lib of state.exercises.filter((x) => !w.exList.includes(x.id))) {
    const opt = document.createElement("option");
    opt.value = lib.id;
    opt.textContent = `${lib.name} (${EX_MODES[lib.mode] || lib.mode})`;
    sel.appendChild(opt);
  }
  $("#ex-new-name").value = "";
  $("#ex-new-hint").value = "";
  $("#ex-new-video").value = "";
  $("#ex-modal").classList.remove("hidden");
});
$("#ex-cancel").addEventListener("click", () => $("#ex-modal").classList.add("hidden"));
$("#ex-add-existing").addEventListener("click", () => {
  const id = $("#ex-pick").value;
  if (!id) { alert("כל התרגילים מהמאגר כבר באימון — צור תרגיל חדש למטה."); return; }
  const w = getWorkout(view.workoutDate);
  w.exList.push(id);
  if (!w.ex[id]) w.ex[id] = freshSetsFor(id, view.workoutDate);
  save();
  $("#ex-modal").classList.add("hidden");
  renderWorkout();
});
$("#ex-add-new").addEventListener("click", () => {
  const name = $("#ex-new-name").value.trim();
  if (!name) { alert("חסר שם לתרגיל."); return; }
  const videoUrl = $("#ex-new-video").value.trim();
  const lib = {
    id: newId("x"),
    name,
    hint: $("#ex-new-hint").value.trim(),
    mode: $("#ex-new-mode").value,
    defReps: 12, defWeight: 10, defSecs: 30,
    demoQuery: `${name} exercise proper form`,
  };
  if (videoUrl) lib.videoUrl = videoUrl;
  state.exercises.push(lib);
  const w = getWorkout(view.workoutDate);
  w.exList.push(lib.id);
  w.ex[lib.id] = defaultSets(lib);
  save();
  $("#ex-modal").classList.add("hidden");
  renderWorkout();
});

$("#wt-load").addEventListener("click", () => {
  const listEl = $("#wt-list");
  listEl.innerHTML = "";
  for (const tpl of state.workoutTemplates) {
    const row = document.createElement("div");
    row.className = "food-item";
    const names = tpl.exerciseIds.map((id) => (exLibById(id) || { name: "?" }).name).join(", ");
    const body = document.createElement("div");
    body.innerHTML = `<div class="food-item-name">${escapeHtml(tpl.name)}</div><div class="food-item-info">${escapeHtml(names)}</div>`;
    body.style.flex = "1";
    body.addEventListener("click", () => {
      if (!confirm(`לטעון את "${tpl.name}"? רשימת התרגילים של היום תוחלף (הנתונים שכבר נרשמו נשמרים).`)) return;
      const w = getWorkout(view.workoutDate);
      w.exList = [...tpl.exerciseIds];
      for (const id of w.exList) if (!w.ex[id]) w.ex[id] = freshSetsFor(id, view.workoutDate);
      save();
      $("#wt-modal").classList.add("hidden");
      renderWorkout();
    });
    row.appendChild(body);
    const edit = document.createElement("button");
    edit.className = "btn small ghost";
    edit.textContent = "✏️";
    edit.addEventListener("click", (e) => {
      e.stopPropagation();
      $("#wt-modal").classList.add("hidden");
      openTplEditor(tpl.id);
    });
    row.appendChild(edit);
    if (!tpl.id.startsWith("t-")) { // תבניות שהמשתמש יצר — אפשר למחוק
      const del = document.createElement("button");
      del.className = "del-set";
      del.textContent = "✕";
      del.addEventListener("click", (e) => {
        e.stopPropagation();
        if (!confirm(`למחוק את התבנית "${tpl.name}"?`)) return;
        state.workoutTemplates = state.workoutTemplates.filter((t) => t.id !== tpl.id);
        save();
        $("#wt-load").click();
      });
      row.appendChild(del);
    }
    listEl.appendChild(row);
  }
  $("#wt-modal").classList.remove("hidden");
});
$("#wt-cancel").addEventListener("click", () => $("#wt-modal").classList.add("hidden"));
$("#wt-save").addEventListener("click", () => {
  const w = getWorkout(view.workoutDate);
  if (!w.exList.length) { alert("אין תרגילים באימון של היום."); return; }
  const name = prompt("שם לאימון החדש (יישמר במאגר האימונים):");
  if (!name || !name.trim()) return;
  state.workoutTemplates.push({ id: newId("wt"), name: name.trim(), exerciseIds: [...w.exList] });
  save();
  alert(`"${name.trim()}" נשמר — זמין דרך 📂 טען אימון.`);
});

/* ---------- היסטוריית אימונים — פתיחה ועריכה של כל יום שנרשם ---------- */
export function workoutSummary(dateIso, w) {
  const parts = [];
  if (w.run && w.run.km > 0) parts.push(`🏃 ${w.run.km} ק״מ`);
  if (w.ropeMinutes > 0) parts.push(`🪢 ${w.ropeMinutes} דק׳`);
  else if (w.ropeSetsDone > 0) parts.push(`🪢 ${w.ropeSetsDone} סטים`);
  const exCount = w.exList
    ? w.exList.filter((id) => id !== "runx" && (w.ex[id] || []).some((s) => s.done || (s.weight || 0) > 0 || (s.reps || 0) > 0 || (s.secs || 0) > 0)).length
    : 0;
  if (exCount) parts.push(`🏋️ ${exCount} תרגילים`);
  return parts.join(" · ") || "ללא רישום";
}

$("#workout-history").addEventListener("click", () => {
  const listEl = $("#history-list");
  listEl.innerHTML = "";
  const dates = Object.keys(state.workouts).sort().reverse().slice(0, 40);
  if (!dates.length) {
    listEl.innerHTML = '<p class="hint">עוד אין אימונים רשומים.</p>';
  }
  for (const date of dates) {
    const w = state.workouts[date];
    const wd = fromIso(date).getDay();
    const row = document.createElement("div");
    row.className = "food-item";
    row.innerHTML = `<div><div class="food-item-name">${w.done ? "✅" : "▫️"} יום ${DAY_NAMES[wd]} · ${shortDate(date)}</div>
      <div class="food-item-info">${STRENGTH_DAYS.includes(wd) ? "כוח" : wd === REST_DAY ? "מנוחה" : "ריצה + ליבה"} · ${workoutSummary(date, w)}</div></div>
      <span style="color: var(--muted);">›</span>`;
    row.addEventListener("click", () => {
      view.workoutDate = date;
      $("#history-modal").classList.add("hidden");
      renderWorkout();
      window.scrollTo({ top: 0 });
    });
    listEl.appendChild(row);
  }
  $("#history-modal").classList.remove("hidden");
});
$("#history-cancel").addEventListener("click", () => $("#history-modal").classList.add("hidden"));

export function renderWorkoutChips() {
  // מהיום ושבוע קדימה — לא מציגים ימים שכבר עברו
  const wrap = $("#workout-day-chips");
  wrap.innerHTML = "";
  // יום עבר שנבחר דרך ההיסטוריה — מוצג כצ'יפ ראשון כדי שיהיה ברור מה עורכים
  if (view.workoutDate < todayIso()) {
    const wd = fromIso(view.workoutDate).getDay();
    const past = document.createElement("button");
    past.className = "chip active";
    past.textContent = `🕘 ${DAY_SHORT[wd]} ${shortDate(view.workoutDate)}`;
    wrap.appendChild(past);
  }
  for (let i = 0; i < 7; i++) {
    const dateIso = addDays(todayIso(), i);
    const wd = fromIso(dateIso).getDay();
    const chip = document.createElement("button");
    chip.className = "chip"
      + (dateIso === view.workoutDate ? " active" : "")
      + (i === 0 ? " today" : "")
      + (wd === REST_DAY ? " restday" : "")
      + (state.workouts[dateIso] && state.workouts[dateIso].done ? " done" : "");
    chip.textContent = (i === 0 ? `היום · ${DAY_SHORT[wd]}` : `${DAY_SHORT[wd]} ${shortDate(dateIso)}`)
      + (wd === REST_DAY ? " 😴" : "");
    chip.addEventListener("click", () => { view.workoutDate = dateIso; renderWorkout(); });
    wrap.appendChild(chip);
  }
  // תאריך חופשי — למשל כדי להשלים רישום של אימון מאתמול
  const dateChip = document.createElement("input");
  dateChip.type = "date";
  dateChip.className = "chip";
  dateChip.style.width = "150px";
  dateChip.value = view.workoutDate;
  dateChip.addEventListener("change", () => {
    if (dateChip.value) { view.workoutDate = dateChip.value; renderWorkout(); }
  });
  wrap.appendChild(dateChip);
}

/* ---------- חבל: מצב ספירה / מצב זמן ---------- */
export function renderRope(w) {
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
  const w = getWorkout(view.workoutDate);
  w.ropeMode = "count"; save(); renderRope(w);
});
$("#rope-mode-time").addEventListener("click", () => {
  const w = getWorkout(view.workoutDate);
  w.ropeMode = "time"; save(); renderRope(w);
});
$("#rope-jumps-per-set").addEventListener("input", () => {
  const w = getWorkout(view.workoutDate);
  w.ropeJumpsPerSet = parseInt($("#rope-jumps-per-set").value, 10) || 50;
  save(); renderRope(w);
});
$("#rope-target-sets").addEventListener("input", () => {
  const w = getWorkout(view.workoutDate);
  w.ropeTargetSets = parseInt($("#rope-target-sets").value, 10) || 6;
  save();
});
$("#rope-set-done").addEventListener("click", () => {
  const w = getWorkout(view.workoutDate);
  w.ropeSetsDone = (w.ropeSetsDone || 0) + 1;
  save(); renderRope(w);
  beep(880, 0.15);
  if (w.ropeSetsDone === (w.ropeTargetSets || 6)) {
    setTimeout(() => beep(1100, 0.2), 180); setTimeout(() => beep(1320, 0.3), 380);
  }
});
$("#rope-set-undo").addEventListener("click", () => {
  const w = getWorkout(view.workoutDate);
  w.ropeSetsDone = Math.max(0, (w.ropeSetsDone || 0) - 1);
  save(); renderRope(w);
});

$("#rope-minutes").addEventListener("input", () => {
  const w = getWorkout(view.workoutDate);
  w.ropeMinutes = parseFloat($("#rope-minutes").value) || 0;
  save();
});
$("#rope-rounds").addEventListener("input", () => {
  const w = getWorkout(view.workoutDate);
  w.ropeRounds = parseInt($("#rope-rounds").value, 10) || 10;
  save();
});


/* ---------- עורך תבניות אימון כוח ---------- */
export let editingTpl = null;
export function openTplEditor(id) {
  editingTpl = JSON.parse(JSON.stringify(templateById(id)));
  $("#tpl-name").value = editingTpl.name;
  renderTplList();
  $("#tpl-modal").classList.remove("hidden");
}
export function renderTplList() {
  const wrap = $("#tpl-list");
  wrap.innerHTML = "";
  editingTpl.exerciseIds.forEach((exId, i) => {
    const lib = exLibById(exId);
    const row = document.createElement("div");
    row.className = "rwk-step";
    row.dataset.itemId = exId + ":" + i;
    const handle = document.createElement("span");
    handle.className = "drag-handle";
    handle.textContent = "≡";
    const name = document.createElement("span");
    name.className = "grow";
    name.textContent = lib ? lib.name : exId;
    const del = document.createElement("button");
    del.className = "del-set";
    del.textContent = "✕";
    del.addEventListener("click", () => { editingTpl.exerciseIds.splice(i, 1); renderTplList(); });
    row.append(handle, name, del);
    enableDrag(handle, row, wrap, (orderIds) => {
      editingTpl.exerciseIds = orderIds.map((k) => k.split(":")[0]);
      renderTplList();
    });
    wrap.appendChild(row);
  });
  const sel = $("#tpl-ex-pick");
  sel.innerHTML = "";
  for (const lib of state.exercises) {
    const opt = document.createElement("option");
    opt.value = lib.id; opt.textContent = lib.name;
    sel.appendChild(opt);
  }
}
$("#tpl-ex-add").addEventListener("click", () => {
  editingTpl.exerciseIds.push($("#tpl-ex-pick").value);
  renderTplList();
});
$("#tpl-cancel").addEventListener("click", () => $("#tpl-modal").classList.add("hidden"));
$("#tpl-save").addEventListener("click", () => {
  const name = $("#tpl-name").value.trim();
  if (!name) { alert("חסר שם."); return; }
  editingTpl.name = name;
  const idx = state.workoutTemplates.findIndex((t) => t.id === editingTpl.id);
  state.workoutTemplates[idx] = editingTpl;
  save();
  $("#tpl-modal").classList.add("hidden");
});

$("#btn-finish-workout").addEventListener("click", () => {
  const w = getWorkout(view.workoutDate);
  w.done = !w.done;
  save();
  renderWorkout();
});



/* ---------- טיימר חבל 30/30 ---------- */
export const rope = { running: false, phase: "work", secLeft: 30, round: 1, totalRounds: 10, interval: null };

export function ropeRender() {
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

export function ropeTick() {
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

export function ropeFinish() {
  clearInterval(rope.interval);
  rope.running = false;
  beep(880, 0.2); setTimeout(() => beep(1100, 0.2), 220); setTimeout(() => beep(1320, 0.4), 440);
  const w = getWorkout(view.workoutDate);
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
export let restInterval = null;
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

registerScreen("workout", renderWorkout);
ropeRender();
