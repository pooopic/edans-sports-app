"use strict";
import { registerScreen } from "../core/nav.js";
import { DAY_NAMES } from "../core/constants.js";
import { addDays, shortDate, todayIso } from "../core/dates.js";
import { MENU_TEMPLATE } from "../core/defaults.js";
import { mealById, mealGrams, mealProtein, newId, productById, round1 } from "../core/model.js";
import { proteinMax, proteinMin, save, state, view } from "../core/state.js";
import { $, enableDrag, escapeHtml } from "../core/ui.js";
import { blankDayFrom, ensureWeek } from "./model.js";

/* ============================ מסך תפריט ============================ */

$("#week-prev").addEventListener("click", () => { view.weekKey = addDays(view.weekKey, -7); renderMenu(); });
$("#week-next").addEventListener("click", () => { view.weekKey = addDays(view.weekKey, 7); renderMenu(); });
$("#btn-copy-week").addEventListener("click", () => copyPrevWeek(view.weekKey));
$("#target-min").addEventListener("change", () => {
  state.settings.proteinMin = parseInt($("#target-min").value, 10) || 130;
  save();
  renderMenu();
});
$("#target-max").addEventListener("change", () => {
  state.settings.proteinMax = parseInt($("#target-max").value, 10) || 140;
  save();
  renderMenu();
});
$("#btn-reset-week").addEventListener("click", () => {
  if (confirm("לאפס את השבוע לתבנית המקורית?")) {
    state.weeks[view.weekKey] = { days: MENU_TEMPLATE.map(blankDayFrom) };
    save();
    renderMenu();
  }
});



export function copyPrevWeek(weekKey) {
  const prevKey = addDays(weekKey, -7);
  const prev = state.weeks[prevKey];
  if (!prev) { alert("אין נתונים לשבוע הקודם — נשארת התבנית."); return; }
  state.weeks[weekKey] = {
    days: prev.days.map((d) => ({
      items: (d.items || []).map((it) => ({ ...it, id: newId("mi"), eaten: false })),
      notes: d.notes, protein: d.protein, fast: d.fast,
    })),
  };
  save();
  renderMenu();
}

export let scrolledToToday = false;

/* גזירת תכנון ← תפריט: צומת ארוחה בגאנט מוסיף את הארוחה לתפריט של אותו יום.
   הזזה/מחיקה של הצומת מסירה את השורה — אלא אם כבר סומנה כנאכלה. */
export function syncPlanMealsIntoWeek(weekKey) {
  if (!state.plan || !state.plan.nodes) return;
  const week = ensureWeek(weekKey);
  let changed = false;
  week.days.forEach((day, i) => {
    const dateIso = addDays(weekKey, i);
    const nodes = state.plan.nodes.filter((n) => n.lane === "food" && n.date === dateIso && n.mealId);
    for (const node of nodes) {
      if (!(day.items || []).some((it) => it.fromPlan === node.id)) {
        const meal = mealById(node.mealId);
        if (!meal) continue;
        day.items = day.items || [];
        day.items.push({
          id: newId("mi"), label: "מתוכנן 📅", text: meal.name,
          mealId: node.mealId, protein: mealProtein(meal), eaten: false, fromPlan: node.id,
        });
        day.protein = Math.round((day.protein || 0) + mealProtein(meal));
        changed = true;
      }
    }
    const stale = (day.items || []).filter((it) => it.fromPlan && !it.eaten && !nodes.some((n) => n.id === it.fromPlan));
    for (const it of stale) {
      day.items = day.items.filter((x) => x !== it);
      if (it.protein) day.protein = Math.max(0, Math.round((day.protein || 0) - it.protein));
      changed = true;
    }
  });
  if (changed) save();
}

export function renderMenu() {
  syncPlanMealsIntoWeek(view.weekKey);
  const week = ensureWeek(view.weekKey);
  const endKey = addDays(view.weekKey, 6);
  $("#week-label").textContent = `${shortDate(view.weekKey)} – ${shortDate(endKey)}`;
  const now = new Date();
  $("#today-label").textContent = `היום: יום ${DAY_NAMES[now.getDay()]}, ${shortDate(todayIso())}`;

  $("#target-min").value = proteinMin();
  $("#target-max").value = proteinMax();
  const daysOnTarget = week.days.filter((d) => d.protein >= proteinMin()).length;
  $("#week-summary").innerHTML = daysOnTarget === 7
    ? `כל השבוע מתוכנן ביעד 💪`
    : `<b>${daysOnTarget} מתוך 7</b> ימים מתוכננים ביעד — פתח יום חסר (✏️) כדי להשלים`;

  const wrap = $("#menu-days");
  wrap.innerHTML = "";
  week.days.forEach((day, i) => {
    const dateIso = addDays(view.weekKey, i);
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

    for (const item of day.items || []) {
      const row = document.createElement("div");
      row.className = "meal-row" + (item.eaten ? " eaten" : "");
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = item.eaten;
      cb.addEventListener("change", () => {
        item.eaten = cb.checked;
        row.classList.toggle("eaten", cb.checked);
        save();
        updateProtein();
      });
      const badge = item.protein != null ? `<span class="meal-badge">${item.protein} ג׳</span>` : "";
      const txt = document.createElement("div");
      txt.innerHTML = `<span class="meal-label">${escapeHtml(item.label)}${badge}</span><span class="meal-text">${escapeHtml(item.text)}</span>`;
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
      const items = day.items || [];
      const hasCalc = items.some((i) => i.protein != null);
      if (hasCalc) {
        // כשמצורפות ארוחות מחושבות — הפס מתקדם לפי מה שבאמת נאכל
        const eaten = round1(items.reduce((a, i) => a + (i.eaten && i.protein != null ? i.protein : 0), 0));
        num.innerHTML = `נאכל: <b>${eaten}</b> / ${day.protein} ג׳`;
        fill.style.width = Math.min(100, (eaten / proteinMax()) * 100) + "%";
        fill.classList.toggle("ok", eaten >= proteinMin());
      } else {
        num.innerHTML = `חלבון: <b>${day.protein}</b> ג׳`;
        fill.style.width = Math.min(100, (day.protein / proteinMax()) * 100) + "%";
        fill.classList.toggle("ok", day.protein >= proteinMin());
      }
    };
    minus.addEventListener("click", () => { day.protein = Math.max(0, day.protein - 5); save(); updateProtein(); });
    plus.addEventListener("click", () => { day.protein += 5; save(); updateProtein(); });
    updateProtein();

    prow.append(minus, num, plus, bar);
    card.appendChild(prow);

    // שורת מסקנה: כמה חסר ליעד בתכנון של היום הזה
    const status = document.createElement("div");
    const drawStatus = () => {
      const gap = proteinMin() - day.protein;
      status.className = "day-target-status " + (gap > 0 ? "short" : "ok");
      status.textContent = gap > 0 ? `חסר ${gap} ג׳ ליעד — הוסף השלמה או הגדל מנה` : "✓ מתוכנן ביעד";
    };
    drawStatus();
    const origUpdate = updateProtein;
    updateProtein = () => { origUpdate(); drawStatus(); };
    card.appendChild(status);
    wrap.appendChild(card);
  });

  // בפתיחה הראשונה גוללים ליום הנוכחי
  if (!scrolledToToday) {
    scrolledToToday = true;
    const todayCard = wrap.querySelector(".day-card.today");
    if (todayCard) setTimeout(() => todayCard.scrollIntoView({ block: "start", behavior: "smooth" }), 100);
  }
}



/* ---------- מודאל עריכת יום ---------- */
export let editingDayIndex = null;
export let editingItems = []; // עותק עבודה של ארוחות היום בזמן עריכה

export function fillMealPicker(sel, selectedId) {
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

export function updateEditGap() {
  const planned = parseInt($("#edit-protein").value, 10) || 0;
  const gap = proteinMin() - planned;
  const el = $("#edit-gap");
  if (gap <= 0) {
    el.className = "edit-gap ok";
    el.textContent = `✓ ${planned} ג׳ — היום מתוכנן ביעד (${proteinMin()}–${proteinMax()})`;
    return;
  }
  // הצעות השלמה: ארוחות מהספרייה + מוצרים בודדים לפי יחידה (ביצה, גביע...)
  const pool = state.meals
    .map((m) => ({ name: m.name, p: mealProtein(m) }))
    .concat(state.products
      .filter((pr) => pr.unitName && pr.unitGrams && pr.protein100 >= 5)
      .map((pr) => ({
        name: pr.unitName === pr.name ? pr.name : `${pr.unitName} ${pr.name}`,
        p: round1((pr.unitGrams * pr.protein100) / 100),
      })));
  const options = pool
    .filter((o) => o.p > 2)
    .sort((a, b) => Math.abs(a.p - gap) - Math.abs(b.p - gap))
    .slice(0, 2);
  const sugg = options.map((o) => `${o.name} (+${o.p})`).join(" או ");
  el.className = "edit-gap short";
  el.textContent = `חסר ${gap} ג׳ ליעד ${proteinMin()}. להשלמה: ${sugg}, או הגדל מנה קיימת.`;
}

export function refreshEditTotals() {
  const vals = editingItems.map((i) => i.protein).filter((v) => v != null);
  if (vals.length) $("#edit-protein").value = Math.round(vals.reduce((a, b) => a + b, 0));
  updateEditGap();
}



export function renderEditorItems() {
  const wrap = $("#edit-items");
  wrap.innerHTML = "";
  editingItems.forEach((it) => {
    const block = document.createElement("div");
    block.className = "edit-item";
    block.dataset.itemId = it.id;

    const head = document.createElement("div");
    head.className = "edit-item-head";
    const handle = document.createElement("span");
    handle.className = "drag-handle";
    handle.textContent = "≡";
    const label = document.createElement("input");
    label.type = "text";
    label.className = "edit-item-label";
    label.value = it.label;
    label.addEventListener("input", () => { it.label = label.value; });
    const spacer = document.createElement("span");
    spacer.className = "grow";
    const pspan = document.createElement("span");
    pspan.className = "slot-protein";
    const setP = () => { pspan.textContent = it.protein != null ? `${it.protein} ג׳` : ""; };
    setP();
    const del = document.createElement("button");
    del.className = "del-set";
    del.textContent = "✕";
    del.addEventListener("click", () => {
      editingItems = editingItems.filter((x) => x !== it);
      renderEditorItems();
    });
    head.append(handle, label, spacer, pspan, del);

    const ta = document.createElement("textarea");
    ta.rows = 2;
    ta.value = it.text;
    ta.addEventListener("input", () => { it.text = ta.value; });

    const pickRow = document.createElement("div");
    pickRow.className = "row gap slot-meal-row";
    const sel = document.createElement("select");
    sel.className = "grow";
    fillMealPicker(sel, it.mealId || "");
    pickRow.append(sel);

    // כמות לפי משקל: החלבון מתדרג פרופורציונלית לגרמים ביחס למנה המלאה
    const gramsRow = document.createElement("div");
    gramsRow.className = "row gap slot-meal-row grams-row";
    const gramsIn = document.createElement("input");
    gramsIn.type = "number"; gramsIn.min = 0; gramsIn.step = 10; gramsIn.inputMode = "numeric";
    gramsIn.style.width = "90px";
    const gramsHint = document.createElement("span");
    gramsHint.className = "grams-hint";

    const refreshGramsRow = () => {
      const meal = it.mealId ? mealById(it.mealId) : null;
      gramsRow.classList.toggle("hidden", !meal);
      if (!meal) return;
      const base = mealGrams(meal);
      if (!it.grams) it.grams = base;
      gramsIn.value = it.grams;
      const portions = base ? round1(it.grams / base) : 1;
      gramsHint.textContent = `ג׳ (מנה מלאה = ${base} ג׳ ≈ ${portions} מנות)`;
    };
    gramsIn.addEventListener("input", () => {
      const meal = it.mealId ? mealById(it.mealId) : null;
      if (!meal) return;
      const base = mealGrams(meal);
      it.grams = parseFloat(gramsIn.value) || 0;
      it.protein = base ? round1((mealProtein(meal) * it.grams) / base) : mealProtein(meal);
      const portions = base ? round1(it.grams / base) : 1;
      gramsHint.textContent = `ג׳ (מנה מלאה = ${base} ג׳ ≈ ${portions} מנות)`;
      setP();
      refreshEditTotals();
    });
    gramsRow.append(gramsIn, gramsHint);
    refreshGramsRow();

    sel.addEventListener("change", () => {
      if (sel.value) {
        const meal = mealById(sel.value);
        it.mealId = sel.value;
        it.grams = mealGrams(meal);
        it.protein = mealProtein(meal);
        const names = meal.items.map((x) => (productById(x.productId) || { name: "?" }).name).join(", ");
        it.text = `${meal.name} (${names})`;
        ta.value = it.text;
      } else {
        it.mealId = null;
        it.protein = null;
        it.grams = null;
      }
      refreshGramsRow();
      setP();
      refreshEditTotals();
    });

    block.append(head, ta, pickRow, gramsRow);
    enableDrag(handle, block, wrap, (orderIds) => {
      editingItems.sort((a, b) => orderIds.indexOf(a.id) - orderIds.indexOf(b.id));
      renderEditorItems();
    });
    wrap.appendChild(block);
  });
  refreshEditTotals();
}

export function openDayEditor(i) {
  editingDayIndex = i;
  const day = state.weeks[view.weekKey].days[i];
  $("#modal-title").textContent = `עריכת יום ${DAY_NAMES[i]}`;
  editingItems = (day.items || []).map((it) => ({ ...it }));
  $("#edit-notes").value = day.notes;
  $("#edit-protein").value = day.protein;
  $("#edit-fast").checked = day.fast;
  renderEditorItems();
  $("#modal").classList.remove("hidden");
}

$("#edit-item-add").addEventListener("click", () => {
  editingItems.push({ id: newId("mi"), label: "ארוחה", text: "", mealId: null, protein: null, eaten: false });
  renderEditorItems();
});
$("#edit-protein").addEventListener("input", updateEditGap);
$("#modal-cancel").addEventListener("click", () => $("#modal").classList.add("hidden"));
$("#modal").addEventListener("click", (e) => { if (e.target === $("#modal")) $("#modal").classList.add("hidden"); });
$("#modal-save").addEventListener("click", () => {
  const day = state.weeks[view.weekKey].days[editingDayIndex];
  day.items = editingItems;
  day.notes = $("#edit-notes").value;
  day.protein = Math.max(0, parseInt($("#edit-protein").value, 10) || 0);
  day.fast = $("#edit-fast").checked;
  save();
  $("#modal").classList.add("hidden");
  renderMenu();
});

registerScreen("menu", renderMenu);
