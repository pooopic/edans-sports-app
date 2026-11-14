"use strict";
import { SLOT_KEYS, SLOT_LABELS } from "../core/constants.js";
import { addDays } from "../core/dates.js";
import { DEFAULT_SHOPPING, MENU_TEMPLATE } from "../core/defaults.js";
import { mealById, mealProtein, newId } from "../core/model.js";
import { save, state } from "../core/state.js";

/* ---------- שבוע תפריט ---------- */
/* יום = רשימת ארוחות מודולרית: מוסיפים, מוחקים וגוררים לשינוי סדר */
export function blankDayFrom(t) {
  const items = [];
  for (const slot of SLOT_KEYS) {
    const text = t[slot] || "";
    const mealId = t.meals && t.meals[slot] ? t.meals[slot] : null;
    const meal = mealId ? mealById(mealId) : null;
    if (slot === "snack" && !text && !meal) continue;
    items.push({
      id: newId("mi"), label: SLOT_LABELS[slot], text,
      mealId: meal ? mealId : null,
      protein: meal ? mealProtein(meal) : null,
      eaten: false,
    });
  }
  const vals = items.map((i) => i.protein).filter((v) => v != null);
  return {
    items, notes: t.notes,
    protein: vals.length ? Math.round(vals.reduce((a, b) => a + b, 0)) : t.protein,
    fast: t.fast,
  };
}
export function ensureWeek(weekKey) {
  if (!state.weeks[weekKey]) {
    state.weeks[weekKey] = { days: MENU_TEMPLATE.map(blankDayFrom) };
    save();
  }
  return state.weeks[weekKey];
}

export function ensureShopping(weekKey) {
  if (!state.shopping) state.shopping = {};
  if (!state.shopping[weekKey]) {
    const items = DEFAULT_SHOPPING.map((it) => ({ ...it, id: newId("s"), checked: false }));
    // אוטומציה: פריט מיוחד (לא מהתבנית) שלא נקנה בשבוע הקודם מתגלגל לשבוע החדש
    const prevList = state.shopping[addDays(weekKey, -7)];
    if (prevList) {
      const defaultNames = new Set(DEFAULT_SHOPPING.map((i) => i.name));
      for (const it of prevList.items) {
        if (!it.checked && !defaultNames.has(it.name)) {
          items.push({
            ...it, id: newId("s"), checked: false,
            notes: (it.notes ? it.notes + " · " : "") + "עבר משבוע שעבר (לא נקנה)",
          });
        }
      }
    }
    state.shopping[weekKey] = { items };
    save();
  }
  return state.shopping[weekKey];
}
