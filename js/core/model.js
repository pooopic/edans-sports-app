"use strict";
import { state } from "./state.js";

export const productById = (id) => state.products.find((p) => p.id === id);
export const mealById = (id) => state.meals.find((m) => m.id === id);
export const round1 = (n) => Math.round(n * 10) / 10;
export function mealProtein(meal) {
  return round1(meal.items.reduce((a, it) => {
    const p = productById(it.productId);
    return a + (p ? (it.grams * p.protein100) / 100 : 0);
  }, 0));
}
export function mealGrams(meal) {
  return meal.items.reduce((a, it) => a + (it.grams || 0), 0);
}
export function mealCal(meal) {
  return Math.round(meal.items.reduce((a, it) => {
    const p = productById(it.productId);
    return a + (p ? (it.grams * p.cal100) / 100 : 0);
  }, 0));
}
export function newId(prefix) { return prefix + "-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
