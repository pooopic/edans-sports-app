"use strict";
import { registerScreen } from "../core/nav.js";
import { mealById, mealCal, mealProtein, newId, productById, round1 } from "../core/model.js";
import { save, state } from "../core/state.js";
import { $, escapeHtml } from "../core/ui.js";

/* ============================ מסך מזון ============================ */

export function renderFood() {
  const plist = $("#product-list");
  plist.innerHTML = "";
  for (const p of state.products) {
    const row = document.createElement("div");
    row.className = "food-item";
    const unit = p.unitName && p.unitGrams ? ` · ${p.unitName} = ${p.unitGrams} ג׳` : "";
    const macros = [
      p.carb100 != null ? `פחמ׳ ${p.carb100}` : null,
      p.fat100 != null ? `שומן ${p.fat100}` : null,
      p.fiber100 != null ? `סיבים ${p.fiber100}` : null,
    ].filter(Boolean).join(" · ");
    const noteMark = p.note ? " 📝" : "";
    row.innerHTML = `<div><div class="food-item-name">${escapeHtml(p.name)}${noteMark}</div>
      <div class="food-item-info">${p.cal100} קק״ל ל־100 ג׳${unit}${macros ? "<br>" + macros : ""}</div></div>
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
export let reviewConfirmAction = null;
export function showReview(notes, onConfirm) {
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
export function reviewProduct(p) {
  const notes = [];
  if (!p.name.trim()) notes.push({ level: "error", text: "חסר שם למוצר." });
  if (p.protein100 > 100) notes.push({ level: "error", text: `${p.protein100} ג׳ חלבון ב־100 ג׳ מוצר — בלתי אפשרי (המקסימום הוא 100).` });
  else if (p.protein100 > 45 && p.cal100 < 500)
    notes.push({ level: "warn", text: `${p.protein100} ג׳ חלבון ל־100 ג׳ זה גבוה מאוד — הגיוני רק לאבקת חלבון או בשר מיובש. בדוק את התווית.` });
  if (p.cal100 > 0 && p.cal100 < p.protein100 * 4)
    notes.push({ level: "error", text: `${p.cal100} קק״ל נמוך מדי: חלבון לבדו נותן ${Math.round(p.protein100 * 4)} קק״ל (4 קק״ל לגרם). כנראה טעות באחד המספרים.` });
  if (p.cal100 > 900) notes.push({ level: "warn", text: "מעל 900 קק״ל ל־100 ג׳ — רק שמן טהור מגיע לזה. בדוק את המספר." });
  if (p.unitGrams > 1000) notes.push({ level: "warn", text: "משקל יחידה מעל קילו — בטוח?" });
  // בדיקת עקביות אנרגטית: קק"ל ≈ 4×חלבון + 4×פחמימה + 9×שומן
  if (p.carb100 != null || p.fat100 != null) {
    const expected = 4 * p.protein100 + 4 * (p.carb100 || 0) + 9 * (p.fat100 || 0);
    if (expected >= 30 && p.cal100 > 0 && Math.abs(expected - p.cal100) / p.cal100 > 0.25) {
      notes.push({ level: "warn", text: `המאקרו לא מסתדר עם הקלוריות: 4×חלבון + 4×פחמ׳ + 9×שומן = ~${Math.round(expected)} קק״ל, אבל הוזן ${p.cal100}. בדוק את אחד המספרים.` });
    }
  }
  if (p.unitName && !p.unitGrams) notes.push({ level: "warn", text: "הגדרת שם יחידה בלי משקל — לא יהיה אפשר לחשב לפי יחידות." });
  if (p.protein100 === 0) notes.push({ level: "info", text: "מוצר בלי חלבון — לגיטימי (ירקות, שמן), רק מוודא שזו הכוונה." });
  if (!notes.some((n) => n.level === "error" || n.level === "warn"))
    notes.push({ level: "ok", text: "הערכים נראים סבירים." });
  return notes;
}

export function reviewMeal(m) {
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
export let editingProductId = null;
export function openProductEditor(id) {
  editingProductId = id;
  const p = id ? productById(id) : null;
  $("#product-modal-title").textContent = p ? `עריכת ${p.name}` : "מוצר חדש";
  $("#prod-name").value = p ? p.name : "";
  $("#prod-protein").value = p ? p.protein100 : "";
  $("#prod-cal").value = p ? p.cal100 : "";
  $("#prod-carb").value = p && p.carb100 != null ? p.carb100 : "";
  $("#prod-fat").value = p && p.fat100 != null ? p.fat100 : "";
  $("#prod-fiber").value = p && p.fiber100 != null ? p.fiber100 : "";
  $("#prod-note").value = p && p.note ? p.note : "";
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
  const optNum = (sel) => {
    const v = $(sel).value.trim();
    return v === "" ? undefined : parseFloat(v) || 0;
  };
  const p = {
    id: editingProductId || newId("p"),
    name: $("#prod-name").value.trim(),
    protein100: parseFloat($("#prod-protein").value) || 0,
    cal100: parseFloat($("#prod-cal").value) || 0,
    carb100: optNum("#prod-carb"),
    fat100: optNum("#prod-fat"),
    fiber100: optNum("#prod-fiber"),
    note: $("#prod-note").value.trim() || undefined,
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
export let editingMeal = null; // עותק עבודה זמני
export function openMealEditor(id) {
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
export function renderMealItems() {
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
export function mealMacro(meal, key) {
  return round1(meal.items.reduce((a, it) => {
    const p = productById(it.productId);
    return a + (p && p[key] != null ? (it.grams * p[key]) / 100 : 0);
  }, 0));
}
export function updateMealTotals() {
  if (!editingMeal.items.length) { $("#meal-totals").innerHTML = ""; return; }
  const carb = mealMacro(editingMeal, "carb100");
  const fat = mealMacro(editingMeal, "fat100");
  const fiber = mealMacro(editingMeal, "fiber100");
  const extra = (carb || fat || fiber)
    ? `<div class="hint" style="margin-top:2px;">פחמ׳ ${carb} · שומן ${fat} · סיבים ${fiber}</div>`
    : "";
  $("#meal-totals").innerHTML =
    `סה״כ: <span>${mealProtein(editingMeal)} ג׳ חלבון</span> · ${mealCal(editingMeal)} קק״ל${extra}`;
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

registerScreen("food", renderFood);
