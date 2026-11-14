"use strict";

export const STORE_KEY = "edan-tracker-v1";
export const DAY_NAMES = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
export const STRENGTH_DAYS = [0, 2, 4]; // א'/ג'/ה' — כוח: חבל (חימום) ← מתח ← משקולות
export const RUN_DAYS = [1, 3, 5];      // ב'/ד'/ו' — ריצה (או חבל) + ליבה
export const REST_DAY = 6;              // שבת — מנוחה מלאה, אין רישום
export const WORKOUT_DAYS = [0, 1, 2, 3, 4, 5];
export const DAY_SHORT = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];

export const LEGACY_EXERCISES = { squat: "סקוואט גובלט (ארכיון)", press: "לחיצה (ארכיון)" };
export const CURL_NAMES = { hammer: "Hammer Curl", regular: "Curl רגיל" };
export const PULLUP_TYPES = ["מלא", "עם גומייה (35 ק״ג)", "שלילי (ירידה איטית)"];
export const EX_MODES = { weight: "חזרות + משקל", reps: "חזרות", seconds: "שניות (עם טיימר)", pullup: "מתח (מלא/גומייה)" };

export const SLOT_KEYS = ["morning", "noon", "evening", "snack"];
export const SLOT_LABELS = { morning: "בוקר", noon: "צהריים", evening: "ערב", snack: "ביניים" };
