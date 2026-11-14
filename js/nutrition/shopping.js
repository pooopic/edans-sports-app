"use strict";
import { registerScreen } from "../core/nav.js";
import { addDays, shortDate } from "../core/dates.js";
import { mealById, newId, productById, round1 } from "../core/model.js";
import { save, state, view } from "../core/state.js";
import { $, escapeHtml } from "../core/ui.js";
import { ensureShopping } from "./model.js";

/* ============================ מסך קניות ============================ */



export function shareShoppingList() {
  const list = ensureShopping(view.weekKey);
  const remaining = list.items.filter((i) => !i.checked);
  if (!remaining.length) { alert("הכל נקנה! 🎉"); return; }
  let text = `🛒 רשימת קניות ${shortDate(view.weekKey)}–${shortDate(addDays(view.weekKey, 6))}\n`;
  for (const cat of [...new Set(remaining.map((i) => i.cat))]) {
    text += `\n*${cat}*\n`;
    for (const it of remaining.filter((i) => i.cat === cat)) {
      text += `▫️ ${it.name}${it.qty ? " — " + it.qty : ""}\n`;
    }
  }
  if (navigator.share) {
    navigator.share({ text }).catch(() => {});
  } else if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(() => alert("הרשימה הועתקה — הדבק בוואטסאפ 📋"));
  }
}

/* כמה גרם מכל מוצר צריך השבוע, לפי הארוחות המקושרות בתפריט */
export function weekProductNeeds(weekKey) {
  const week = state.weeks[weekKey];
  const needs = {};
  if (!week) return needs;
  for (const day of week.days) {
    for (const item of day.items || []) {
      const meal = item.mealId ? mealById(item.mealId) : null;
      if (!meal) continue;
      for (const it of meal.items) needs[it.productId] = (needs[it.productId] || 0) + it.grams;
    }
  }
  return needs;
}

export function formatNeed(productId, grams) {
  const p = productById(productId);
  if (p && p.unitName && p.unitGrams) return `~${Math.ceil(grams / p.unitGrams)} ${p.unitName}`;
  return grams >= 1000 ? `~${round1(grams / 1000)} ק״ג` : `~${Math.round(grams)} ג׳`;
}

/* סנכרון אוטומטי: כל מוצר שהתפריט של השבוע צריך ואין לו פריט קנייה — נוסף לבד.
   פריט אוטומטי שהצורך בו נעלם (והוא לא סומן) — מוסר. */
export function syncShoppingWithMenu(weekKey) {
  const list = ensureShopping(weekKey);
  const needs = weekProductNeeds(weekKey);
  let changed = false;
  for (const [pid, grams] of Object.entries(needs)) {
    if (!grams || pid === "p-veg") continue; // ירקות מכוסים בפריטי הירקות הקיימים
    const p = productById(pid);
    if (!p) continue;
    const covered = list.items.some((i) =>
      i.productId === pid || i.name.includes(p.name) || p.name.includes(i.name));
    if (covered) continue;
    list.items.push({
      id: newId("s"), cat: "מהתפריט (אוטומטי)", name: p.name,
      qty: formatNeed(pid, grams), notes: "נוסף אוטומטית — בשימוש בתפריט השבוע",
      productId: pid, checked: false, auto: true,
    });
    changed = true;
  }
  const before = list.items.length;
  list.items = list.items.filter((i) => !(i.auto && !i.checked && !needs[i.productId]));
  if (changed || list.items.length !== before) save();
  return list;
}

export function renderShopping() {
  const list = syncShoppingWithMenu(view.weekKey);
  const endKey = addDays(view.weekKey, 6);
  $("#shop-week-label").textContent = `${shortDate(view.weekKey)} – ${shortDate(endKey)}`;
  const bought = list.items.filter((i) => i.checked).length;
  $("#shop-progress").textContent = `נקנו ${bought} מתוך ${list.items.length}`;

  const needs = weekProductNeeds(view.weekKey);
  const wrap = $("#shopping-list");
  wrap.innerHTML = "";
  const cats = [...new Set(list.items.map((i) => i.cat))];
  for (const cat of cats) {
    const h = document.createElement("div");
    h.className = "shop-cat";
    h.textContent = cat;
    wrap.appendChild(h);
    for (const item of list.items.filter((i) => i.cat === cat)) {
      const row = document.createElement("div");
      row.className = "shop-item" + (item.checked ? " checked" : "");
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = item.checked;
      cb.addEventListener("change", () => {
        item.checked = cb.checked;
        save();
        row.classList.toggle("checked", cb.checked);
        const b = list.items.filter((i) => i.checked).length;
        $("#shop-progress").textContent = `נקנו ${b} מתוך ${list.items.length}`;
      });
      const body = document.createElement("div");
      body.className = "shop-body";
      let html = `<span class="shop-name">${escapeHtml(item.name)}</span><span class="shop-qty">${escapeHtml(item.qty)}</span>`;
      if (item.notes) html += `<div class="shop-notes">${escapeHtml(item.notes)}</div>`;
      if (item.productId && needs[item.productId]) {
        html += `<div class="shop-calc">לפי התפריט: ${formatNeed(item.productId, needs[item.productId])} לשבוע</div>`;
      }
      body.innerHTML = html;
      const del = document.createElement("button");
      del.className = "del-set";
      del.textContent = "✕";
      del.addEventListener("click", () => {
        list.items = list.items.filter((i) => i.id !== item.id);
        save();
        renderShopping();
      });
      row.append(cb, body, del);
      wrap.appendChild(row);
    }
  }
}

$("#shop-share").addEventListener("click", shareShoppingList);
$("#shop-week-prev").addEventListener("click", () => { view.weekKey = addDays(view.weekKey, -7); renderShopping(); });
$("#shop-week-next").addEventListener("click", () => { view.weekKey = addDays(view.weekKey, 7); renderShopping(); });
$("#shop-reset").addEventListener("click", () => {
  if (!confirm("לאפס את הרשימה לרשימה המקורית? (סימונים ופריטים שהוספת יימחקו)")) return;
  delete state.shopping[view.weekKey];
  save();
  renderShopping();
});
$("#shop-add").addEventListener("click", () => {
  const list = ensureShopping(view.weekKey);
  const sel = $("#shop-item-cat");
  sel.innerHTML = "";
  for (const cat of [...new Set(list.items.map((i) => i.cat))].concat("אחר")) {
    const opt = document.createElement("option");
    opt.value = cat; opt.textContent = cat;
    sel.appendChild(opt);
  }
  $("#shop-item-name").value = "";
  $("#shop-item-qty").value = "";
  $("#shop-modal").classList.remove("hidden");
});
$("#shop-item-cancel").addEventListener("click", () => $("#shop-modal").classList.add("hidden"));
$("#shop-item-save").addEventListener("click", () => {
  const name = $("#shop-item-name").value.trim();
  if (!name) { alert("חסר שם לפריט."); return; }
  const list = ensureShopping(view.weekKey);
  list.items.push({
    id: newId("s"),
    cat: $("#shop-item-cat").value,
    name,
    qty: $("#shop-item-qty").value.trim() || "",
    notes: "",
    checked: false,
  });
  save();
  $("#shop-modal").classList.add("hidden");
  renderShopping();
});

registerScreen("shopping", renderShopping);
