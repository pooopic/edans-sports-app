"use strict";
/* ה-state המרכזי: נטען פעם אחת מ-localStorage (המפתח edan-tracker-v1) ונשמר בכל שינוי.
   מודולים אחרים נרשמים ל-onSave (למשל הסנכרון) — כך אין תלות מעגלית בין state לסנכרון. */
import { STORE_KEY } from "./constants.js";
import { DEFAULT_MEALS, DEFAULT_PRODUCTS } from "./defaults.js";
import { defaultWorkoutDate, weekKeyOf } from "./dates.js";

const saveHooks = [];
export function onSave(fn) { saveHooks.push(fn); }

export function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { /* אחסון לא זמין / נתון פגום — מתחילים נקי */ }
  return { weeks: {}, workouts: {} };
}
export function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) {}
  for (const fn of saveHooks) { try { fn(); } catch (e) {} } // סנכרון אוטומטי אם מחובר
}

export const state = load();
state.settings = Object.assign(
  { workoutTime: "07:00", workoutDur: 45, proteinMin: 130, proteinMax: 140 },
  state.settings || {}
);
if (!state.products) {
  state.products = JSON.parse(JSON.stringify(DEFAULT_PRODUCTS));
  state.meals = JSON.parse(JSON.stringify(DEFAULT_MEALS));
  save();
}

// יעד חלבון יומי — ניתן לעריכה במסך התפריט (state.settings)
export const proteinMin = () => (state.settings && state.settings.proteinMin) || 130;
export const proteinMax = () => (state.settings && state.settings.proteinMax) || 140;

/* מצב תצוגה משותף בין מסכים (לא נשמר): השבוע המוצג בתפריט/קניות, והיום המוצג באימונים */
export const view = {
  weekKey: weekKeyOf(new Date()),
  workoutDate: defaultWorkoutDate(),
};
