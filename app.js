"use strict";

/* ============================================================
   המעקב של עדן — תזונה ואימונים
   כל הנתונים נשמרים מקומית ב-localStorage.
   ============================================================ */

const STORE_KEY = "edan-tracker-v1";
const DAY_NAMES = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
const STRENGTH_DAYS = [0, 2, 4]; // א'/ג'/ה' — כוח: חבל (חימום) ← מתח ← משקולות
const RUN_DAYS = [1, 3, 5];      // ב'/ד'/ו' — ריצה (או חבל) + ליבה
const REST_DAY = 6;              // שבת — מנוחה מלאה, אין רישום
const WORKOUT_DAYS = [0, 1, 2, 3, 4, 5];
const DAY_SHORT = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];
// יעד חלבון יומי — ניתן לעריכה במסך התפריט (state.settings)
const proteinMin = () => (state.settings && state.settings.proteinMin) || 130;
const proteinMax = () => (state.settings && state.settings.proteinMax) || 140;

/* ---------- תבנית תפריט (יובאה מגיליון "תפריט שבועי" באקסל) ---------- */
const MENU_TEMPLATE = [
  { // ראשון
    morning: "קערת חלבון: יוגורט יווני + אבקת וניל + תערובת שקדים, אגוזים ופירות יבשים (אחרי האימון), או צום 16:8",
    noon: "חזה עוף (מוכן) + אורז + ירקות",
    evening: "שקשוקה + סלט",
    notes: "אימון קפיצה בחבל + מתח — חלבון אחרי (יוגורט/ביצים)",
    protein: 145, fast: true,
    meals: { morning: "m-bowl", noon: "m-chicken", evening: "m-shakshuka" },
  },
  { // שני
    morning: "2 ביצים קשות + קוטג׳ + ירקות",
    noon: "מנת אסאדו מהמקפיא + אורז",
    evening: "סלט עדשים קר + יוגורט יווני",
    notes: "",
    protein: 135, fast: false,
    snack: "שייק חלבון (אחרי הריצה)",
    meals: { morning: "m-eggs-cottage", noon: "m-asado-rice", evening: "m-lentil-yogurt", snack: "m-shake" },
  },
  { // שלישי
    morning: "אופציה לצום 16:8 — רק קפה, או קערת חלבון: יוגורט יווני + אבקת וניל + תערובת שקדים, אגוזים ופירות יבשים",
    noon: "חזה עוף + ירקות אנטיפסטי + אורז",
    evening: "חביתה + סלט + פרוסת לחם מלא",
    notes: "אימון משקולות — ארוחת צהריים גדולה יותר ביום אימון",
    protein: 130, fast: true,
    meals: { morning: "m-bowl", noon: "m-chicken", evening: "m-omelette-bread" },
  },
  { // רביעי
    morning: "קוטג׳ + ירקות + פרוסת לחם מלא",
    noon: "מנת אסאדו מהמקפיא + אורז + סלט",
    evening: "סלט טונה עם ביצה",
    notes: "",
    protein: 135, fast: false,
    snack: "שייק חלבון (אחרי הריצה)",
    meals: { morning: "m-cottage-bread", noon: "m-asado-rice", evening: "m-tuna", snack: "m-shake" },
  },
  { // חמישי
    morning: "קערת חלבון: יוגורט יווני + אבקת וניל + תערובת שקדים, אגוזים ופירות יבשים",
    noon: "סלט עדשים עם חזה עוף / מה שנשאר",
    evening: "שקשוקה + סלט",
    notes: "אימון משקולות. לתכנן בישולים לשבוע הבא",
    protein: 140, fast: false,
    meals: { morning: "m-bowl", noon: "m-lentil-chicken", evening: "m-shakshuka" },
  },
  { // שישי
    morning: "— (דילוג — יוצא צום 16:8 בפועל)",
    noon: "משהו קטן: יוגורט יווני / ביצה קשה וירקות",
    evening: "אסאדו בריבת בצל + אורז + סלט גדול",
    notes: "יום בישולים: אסאדו בתנור (3 שעות), אורז, ביצים קשות, עדשים מבושלות לסלט (מחזיק 4-5 ימים במקרר)",
    protein: 105, fast: false,
    snack: "שייק חלבון (אחרי הריצה)",
    meals: { morning: null, noon: "m-snack", evening: "m-asado-rice", snack: "m-shake" },
  },
  { // שבת
    morning: "חביתה 2-3 ביצים + קוטג׳ + ירקות",
    noon: "אסאדו + אורז + ירקות אנטיפסטי",
    evening: "סלט טונה עם ביצה קשה וירקות",
    notes: "להקפיא 2-3 מנות אסאדו",
    protein: 140, fast: false,
    meals: { morning: "m-omelette-cottage", noon: "m-asado-rice", evening: "m-tuna" },
  },
];

/* ---------- מאגר תרגילים (ניתן להוסיף חדשים מהאפליקציה) ----------
   mode קובע את שדות הרישום: weight = חזרות+משקל · reps = חזרות+בוצע ·
   seconds = שניות+טיימר+בוצע · pullup = סוג (מלא/גומייה)+חזרות */
const DEFAULT_EXLIB = [
  { id: "pullups",  name: "מתח", hint: "סט 1 מלא עד הכשל · סטים 2–3 גומייה יעד 7 · ב-7 מלאים סט 2 עובר למלא", mode: "pullup" },
  { id: "row",      name: "חתירה בעמידה (Bent Over Row)", hint: "2× משקולות 5 ק״ג", mode: "weight", defReps: 10, defWeight: 10 },
  { id: "ohp",      name: "לחיצת כתפיים",                 hint: "2× משקולות 5 ק״ג", mode: "weight", defReps: 10, defWeight: 10 },
  { id: "rdl",      name: "דדליפט רומני",                 hint: "2× משקולות 5 ק״ג", mode: "weight", defReps: 12, defWeight: 10 },
  { id: "rearfly",  name: "Rear Delt Fly",                hint: "2× משקולות 5 ק״ג", mode: "weight", defReps: 12, defWeight: 10 },
  { id: "curl",     name: "Curl",                          hint: "משקולות 5 ק״ג — Hammer/רגיל מתחלפים", mode: "weight", defReps: 10, defWeight: 10 },
  { id: "plank",    name: "פלאנק",                         hint: "▶ מפעיל טיימר: 5 שנ׳ היכון ואז שעון עולה", mode: "seconds", defSecs: 30 },
  { id: "russian",  name: "Russian Twist",                 hint: "דאמבל 5 ק״ג · 12–15 לכל צד", mode: "reps", defReps: 12 },
  { id: "situp",    name: "Weighted Sit-up",               hint: "דאמבל צמוד לחזה · 12–15", mode: "reps", defReps: 12 },
  { id: "sidebend", name: "Dumbbell Side Bend",            hint: "12–15 לכל צד — להחליף יד בין סטים", mode: "reps", defReps: 12 },
  { id: "deadbug",  name: "Dead Bug עם דאמבל",             hint: "דאמבל מעל החזה · לסירוגין רגל-רגל", mode: "reps", defReps: 12 },
  { id: "suitcase", name: "Suitcase Carry",                hint: "הליכה עם דאמבל ביד אחת · 30–40 שנ׳ לכל יד", mode: "seconds", defSecs: 30 },
];
/* מאגר אימונים — תבניות שאפשר לטעון ליום, לשמור חדשות ולערוך */
const DEFAULT_WORKOUT_TEMPLATES = [
  { id: "t-strength", name: "אימון כוח", exerciseIds: ["pullups", "row", "ohp", "rdl", "rearfly", "curl"] },
  { id: "t-run", name: "ריצה + ליבה", exerciseIds: ["plank", "russian", "situp", "sidebend", "deadbug", "suitcase"] },
];
/* תרגילים ישנים שהוסרו מהתוכנית — נשמרים בגרפים כארכיון */
const LEGACY_EXERCISES = { squat: "סקוואט גובלט (ארכיון)", press: "לחיצה (ארכיון)" };
const CURL_NAMES = { hammer: "Hammer Curl", regular: "Curl רגיל" };
const PULLUP_TYPES = ["מלא", "עם גומייה (35 ק״ג)", "שלילי (ירידה איטית)"];
const EX_MODES = { weight: "חזרות + משקל", reps: "חזרות", seconds: "שניות (עם טיימר)", pullup: "מתח (מלא/גומייה)" };

/* ---------- מאגר מוצרים התחלתי (ערכים תזונתיים סטנדרטיים, ל-100 ג׳) ---------- */
const DEFAULT_PRODUCTS = [
  { id: "p-egg",     name: "ביצה",                protein100: 12.6, cal100: 143, unitName: "ביצה",   unitGrams: 55 },
  { id: "p-yogurt",  name: "יוגורט יווני 5%",     protein100: 9,    cal100: 97,  unitName: "גביע",   unitGrams: 150 },
  { id: "p-cottage", name: "קוטג׳ 5%",            protein100: 11,   cal100: 98,  unitName: "גביע",   unitGrams: 250 },
  { id: "p-chicken", name: "חזה עוף מבושל",       protein100: 31,   cal100: 165 },
  { id: "p-asado",   name: "אסאדו מבושל",         protein100: 26,   cal100: 300 },
  { id: "p-rice",    name: "אורז מבושל",          protein100: 2.7,  cal100: 130 },
  { id: "p-lentil",  name: "עדשים מבושלות",       protein100: 9,    cal100: 116, unitName: "כוס",    unitGrams: 200 },
  { id: "p-tuna",    name: "טונה בשימורים (מסוננת)", protein100: 26, cal100: 116, unitName: "קופסה", unitGrams: 105 },
  { id: "p-powder",  name: "אבקת חלבון וניל",     protein100: 75,   cal100: 380, unitName: "סקופ",   unitGrams: 30 },
  { id: "p-almonds", name: "שקדים ואגוזים",       protein100: 20,   cal100: 590 },
  { id: "p-bread",   name: "לחם מלא",             protein100: 13,   cal100: 250, unitName: "פרוסה",  unitGrams: 35 },
  { id: "p-veg",     name: "ירקות / סלט",         protein100: 1.5,  cal100: 25 },
  { id: "p-noodles", name: "אטריות שעועית (מבושלות)", protein100: 0.2, cal100: 86, unitName: "מנה", unitGrams: 150 },
  { id: "p-onion",   name: "בצל",                 protein100: 1.1,  cal100: 40 },
  { id: "p-herbs",   name: "עלי תבלין טריים (נענע/כוסברה)", protein100: 3.3, cal100: 44 },
  { id: "p-fishsauce", name: "רוטב דגים",         protein100: 5,    cal100: 35,  unitName: "כף",  unitGrams: 15 },
  { id: "p-mirin",   name: "מירין",               protein100: 0,    cal100: 230, unitName: "כף",  unitGrams: 15 },
  { id: "p-honey",   name: "דבש",                 protein100: 0.3,  cal100: 304, unitName: "כף",  unitGrams: 21 },
  { id: "p-beef",    name: "בשר בקר טחון (מבושל)", protein100: 26,  cal100: 260 },
  { id: "p-grapeleaves", name: "עלי גפן",         protein100: 4,    cal100: 70 },
  { id: "p-oil",     name: "שמן זית",             protein100: 0,    cal100: 884, unitName: "כף",  unitGrams: 14 },
  { id: "p-milk",    name: "חלב 3%",              protein100: 3.4,  cal100: 59,  unitName: "כוס", unitGrams: 240 },
  { id: "p-oats",    name: "שיבולת שועל (יבשה)",  protein100: 13.5, cal100: 389, unitName: "חצי כוס", unitGrams: 40 },
];
/* כל הארוחות מהתפריט השבועי, מורכבות ממוצרים */
const DEFAULT_MEALS = [
  { id: "m-bowl", name: "קערת חלבון", items: [
    { productId: "p-yogurt", grams: 200 }, { productId: "p-powder", grams: 30 }, { productId: "p-almonds", grams: 20 },
  ]},
  { id: "m-chicken", name: "חזה עוף + אורז + ירקות", items: [
    { productId: "p-chicken", grams: 180 }, { productId: "p-rice", grams: 200 }, { productId: "p-veg", grams: 150 },
  ]},
  { id: "m-tuna", name: "סלט טונה עם ביצה", items: [
    { productId: "p-tuna", grams: 105 }, { productId: "p-egg", grams: 55 }, { productId: "p-veg", grams: 150 },
  ]},
  { id: "m-shakshuka", name: "שקשוקה + סלט", items: [
    { productId: "p-egg", grams: 165 }, { productId: "p-veg", grams: 250 },
  ]},
  { id: "m-eggs-cottage", name: "2 ביצים קשות + קוטג׳ + ירקות", items: [
    { productId: "p-egg", grams: 110 }, { productId: "p-cottage", grams: 100 }, { productId: "p-veg", grams: 100 },
  ]},
  { id: "m-omelette-cottage", name: "חביתה + קוטג׳ + ירקות", items: [
    { productId: "p-egg", grams: 140 }, { productId: "p-cottage", grams: 100 }, { productId: "p-veg", grams: 100 },
  ]},
  { id: "m-omelette-bread", name: "חביתה + סלט + לחם מלא", items: [
    { productId: "p-egg", grams: 110 }, { productId: "p-veg", grams: 150 }, { productId: "p-bread", grams: 35 },
  ]},
  { id: "m-cottage-bread", name: "קוטג׳ + ירקות + לחם מלא", items: [
    { productId: "p-cottage", grams: 125 }, { productId: "p-veg", grams: 100 }, { productId: "p-bread", grams: 35 },
  ]},
  { id: "m-asado-rice", name: "אסאדו + אורז + סלט", items: [
    { productId: "p-asado", grams: 180 }, { productId: "p-rice", grams: 200 }, { productId: "p-veg", grams: 100 },
  ]},
  { id: "m-lentil-yogurt", name: "סלט עדשים קר + יוגורט יווני", items: [
    { productId: "p-lentil", grams: 200 }, { productId: "p-veg", grams: 150 }, { productId: "p-yogurt", grams: 150 },
  ]},
  { id: "m-lentil-chicken", name: "סלט עדשים עם חזה עוף", items: [
    { productId: "p-lentil", grams: 200 }, { productId: "p-chicken", grams: 100 }, { productId: "p-veg", grams: 150 },
  ]},
  { id: "m-snack", name: "יוגורט + ביצה קשה וירקות", items: [
    { productId: "p-yogurt", grams: 150 }, { productId: "p-egg", grams: 55 }, { productId: "p-veg", grams: 100 },
  ]},
  { id: "m-shake", name: "שייק חלבון", items: [
    { productId: "p-powder", grams: 30 },   // סקופ
    { productId: "p-milk", grams: 240 },    // כוס חלב; עם מים במקום — 22.5 ג' בלבד
  ]},
  { id: "m-shake-oats", name: "שייק חלבון עם שיבולת שועל מושרית", items: [
    { productId: "p-powder", grams: 30 },
    { productId: "p-milk", grams: 240 },
    { productId: "p-oats", grams: 40 },     // חצי כוס, מושרית בשייק
  ]},
  { id: "m-grapeleaves", name: "עלי גפן ממולאים (מנה ~8 יח׳)", items: [
    { productId: "p-rice", grams: 160 },        // המילוי ברובו אורז עגול
    { productId: "p-beef", grams: 30 },
    { productId: "p-grapeleaves", grams: 50 },
    { productId: "p-oil", grams: 10 },
  ]},
  { id: "m-cabbage", name: "כרוב ממולא בבשר (מנה ~3 יח׳)", items: [
    { productId: "p-veg", grams: 120 },         // עלי כרוב + עגבניות הרוטב
    { productId: "p-rice", grams: 120 },
    { productId: "p-beef", grams: 60 },
    { productId: "p-oil", grams: 10 },
  ]},
  { id: "m-thai", name: "סלט תאילנדי חלבון", items: [
    { productId: "p-noodles", grams: 150 },  // מנה: ~50 ג' יבש
    { productId: "p-tuna", grams: 105 },     // קופסה מסוננת
    { productId: "p-egg", grams: 165 },      // 3 ביצים
    { productId: "p-veg", grams: 200 },      // עגבניות (צרובות) + קישואים
    { productId: "p-onion", grams: 50 },     // סגול או לבן מבושל
    { productId: "p-herbs", grams: 10 },
    { productId: "p-fishsauce", grams: 15 },
    { productId: "p-mirin", grams: 15 },
    { productId: "p-honey", grams: 10 },
  ]},
];

/* ---------- רשימת קניות שבועית (יובאה מגיליון "רשימת קניות" באקסל) ---------- */
const DEFAULT_SHOPPING = [
  { cat: "בשר", name: "אסאדו (שפונדרה)", qty: "2-2.5 ק\"ג", notes: "לבישול היום בנינג׳ה + הקפאת מנות", productId: "p-asado" },
  { cat: "בשר", name: "חזה עוף / פרגיות", qty: "1.5 ק\"ג", notes: "לאפייה בתנור מראש", productId: "p-chicken" },
  { cat: "ביצים וחלב", name: "ביצים", qty: "תבנית 30", notes: "שקשוקות, חביתות, קשות", productId: "p-egg" },
  { cat: "ביצים וחלב", name: "קוטג׳ 5%", qty: "3 יח׳", notes: "", productId: "p-cottage" },
  { cat: "ביצים וחלב", name: "יוגורט יווני (פרו או דומה)", qty: "5-6 יח׳", notes: "חלבון גבוה", productId: "p-yogurt" },
  { cat: "ירקות", name: "עגבניות", qty: "1.5 ק\"ג", notes: "סלטים + שקשוקה" },
  { cat: "ירקות", name: "מלפפונים", qty: "1 ק\"ג", notes: "" },
  { cat: "ירקות", name: "פלפלים", qty: "6-8 יח׳", notes: "סלט + אנטיפסטי" },
  { cat: "ירקות", name: "בצל לבן", qty: "1.25 ק\"ג", notes: "לריבת הבצל של האסאדו" },
  { cat: "ירקות", name: "בצל סגול", qty: "1.25 ק\"ג", notes: "לריבת הבצל של האסאדו" },
  { cat: "ירקות", name: "תפוחי אדמה בייבי", qty: "800 ג׳", notes: "נכנסים בשעה האחרונה בתנור" },
  { cat: "ירקות", name: "שום", qty: "ראש 1", notes: "" },
  { cat: "ירקות", name: "גזר", qty: "0.5 ק\"ג", notes: "מרק + אנטיפסטי" },
  { cat: "ירקות", name: "קישואים", qty: "3-4 יח׳", notes: "אנטיפסטי" },
  { cat: "ירקות", name: "בטטה", qty: "2 יח׳", notes: "אנטיפסטי — פחמימה לימי אימון" },
  { cat: "ירקות", name: "חסה / ירק עלים", qty: "1 יח׳", notes: "" },
  { cat: "ירקות", name: "לימון", qty: "3 יח׳", notes: "" },
  { cat: "ירקות", name: "פטרוזיליה / כוסברה", qty: "צרור", notes: "" },
  { cat: "ירקות", name: "פרי (לבחירה)", qty: "5-6 יח׳", notes: "לארוחת בוקר חמישי ונשנוש" },
  { cat: "יבשים ושימורים", name: "עדשים (ירוקות/כתומות)", qty: "500 ג׳", notes: "לסלט עדשים קר — לבשל ביום הבישולים, מחזיק 4-5 ימים במקרר", productId: "p-lentil" },
  { cat: "יבשים ושימורים", name: "טונה בשימורים", qty: "4 קופסאות", notes: "במים — פחות קלוריות", productId: "p-tuna" },
  { cat: "יבשים ושימורים", name: "לחם מלא", qty: "1 יח׳", notes: "אפשר לפרוס ולהקפיא", productId: "p-bread" },
  { cat: "יבשים ושימורים", name: "אורז", qty: "1 ק\"ג", notes: "בסיס לצהריים", productId: "p-rice" },
  { cat: "יבשים ושימורים", name: "אבקת חלבון וניל", qty: "לבדוק שיש", notes: "לקערת החלבון", productId: "p-powder" },
  { cat: "יבשים ושימורים", name: "שקדים ואגוזים", qty: "לבדוק שיש", notes: "לקערת החלבון", productId: "p-almonds" },
];

/* ============================ state ============================ */

let state = load();
state.settings = Object.assign(
  { workoutTime: "07:00", workoutDur: 45, proteinMin: 130, proteinMax: 140 },
  state.settings || {}
);
if (!state.products) {
  state.products = JSON.parse(JSON.stringify(DEFAULT_PRODUCTS));
  state.meals = JSON.parse(JSON.stringify(DEFAULT_MEALS));
  save();
}

const SLOT_KEYS = ["morning", "noon", "evening", "snack"];
const SLOT_LABELS = { morning: "בוקר", noon: "צהריים", evening: "ערב", snack: "ביניים" };
const productById = (id) => state.products.find((p) => p.id === id);
const mealById = (id) => state.meals.find((m) => m.id === id);
const round1 = (n) => Math.round(n * 10) / 10;
function mealProtein(meal) {
  return round1(meal.items.reduce((a, it) => {
    const p = productById(it.productId);
    return a + (p ? (it.grams * p.protein100) / 100 : 0);
  }, 0));
}
function mealGrams(meal) {
  return meal.items.reduce((a, it) => a + (it.grams || 0), 0);
}
function mealCal(meal) {
  return Math.round(meal.items.reduce((a, it) => {
    const p = productById(it.productId);
    return a + (p ? (it.grams * p.cal100) / 100 : 0);
  }, 0));
}
function newId(prefix) { return prefix + "-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

/* שדרוג נתונים קיימים: הוספת ארוחות/מוצרים חדשים וקישור ימים שלא נערכו */
if ((state.seedV || 1) < 2) {
  for (const p of DEFAULT_PRODUCTS) if (!productById(p.id)) state.products.push(JSON.parse(JSON.stringify(p)));
  for (const m of DEFAULT_MEALS) if (!mealById(m.id)) state.meals.push(JSON.parse(JSON.stringify(m)));
  for (const wk of Object.values(state.weeks || {})) {
    wk.days.forEach((day, i) => {
      const t = MENU_TEMPLATE[i];
      day.mealIds = day.mealIds || {};
      day.slotProtein = day.slotProtein || {};
      for (const slot of SLOT_KEYS) {
        // מקשרים רק ארוחות שהטקסט שלהן לא שונה מהתבנית המקורית
        if (!day.mealIds[slot] && t.meals && t.meals[slot] && day[slot] === t[slot]) {
          const meal = mealById(t.meals[slot]);
          if (meal) {
            day.mealIds[slot] = t.meals[slot];
            day.slotProtein[slot] = mealProtein(meal);
          }
        }
      }
      const vals = SLOT_KEYS.map((s) => day.slotProtein[s]).filter((v) => v != null);
      if (vals.length) day.protein = Math.round(vals.reduce((a, b) => a + b, 0));
    });
  }
  state.seedV = 2;
  save();
}

/* שדרוג 3: מרק עדשים ← סלט עדשים קר (גרסת קיץ) */
if (state.seedV < 3) {
  const lentil = productById("p-lentil");
  if (lentil && lentil.name === "מרק עדשים") {
    Object.assign(lentil, { name: "עדשים מבושלות", protein100: 9, cal100: 116, unitName: "כוס", unitGrams: 200 });
  }
  const OLD_TEXTS = {
    "מרק עדשים + יוגורט יווני": "סלט עדשים קר + יוגורט יווני",
    "מרק עדשים + חזה עוף / מה שנשאר": "סלט עדשים עם חזה עוף / מה שנשאר",
  };
  for (const id of ["m-lentil-yogurt", "m-lentil-chicken"]) {
    const idx = state.meals.findIndex((m) => m.id === id);
    const fresh = DEFAULT_MEALS.find((m) => m.id === id);
    if (idx >= 0 && OLD_TEXTS[state.meals[idx].name] && fresh) {
      state.meals[idx] = JSON.parse(JSON.stringify(fresh));
    }
  }
  for (const wk of Object.values(state.weeks || {})) {
    for (const day of wk.days) {
      for (const slot of SLOT_KEYS) {
        if (OLD_TEXTS[day[slot]]) day[slot] = OLD_TEXTS[day[slot]];
        const mealId = day.mealIds && day.mealIds[slot];
        if (mealId === "m-lentil-yogurt" || mealId === "m-lentil-chicken") {
          const meal = mealById(mealId);
          if (meal) day.slotProtein[slot] = mealProtein(meal);
        }
      }
      const vals = SLOT_KEYS.map((s) => day.slotProtein && day.slotProtein[s]).filter((v) => v != null);
      if (vals.length) day.protein = Math.round(vals.reduce((a, b) => a + b, 0));
    }
  }
  for (const list of Object.values(state.shopping || {})) {
    for (const item of list.items) {
      if (item.productId === "p-lentil" && item.notes && item.notes.includes("מרק")) {
        item.notes = "לסלט עדשים קר — לבשל ביום הבישולים, מחזיק 4-5 ימים במקרר";
      }
    }
  }
  state.seedV = 3;
  save();
}

/* שדרוג 4: הוספת קניות לשני מתכונים — עלי גפן ממולאים + כרוב ממולא (חד-פעמי, לשבוע הנוכחי) */
if (state.seedV < 4) {
  const wk = weekKeyOf(new Date());
  const list = ensureShopping(wk);
  const addIfMissing = (item) => {
    if (!list.items.some((i) => i.name === item.name)) {
      list.items.push({ ...item, id: newId("s"), checked: false });
    }
  };
  // מיזוג עם פריטים קיימים שחופפים בין התפריט למתכונים
  for (const it of list.items) {
    if (it.name === "לימון" || it.name === "לימונים") { it.qty = "10 יח׳"; it.notes = "3 לתפריט + 7 למתכונים (2 למילוי, 5 לרוטב)"; }
    if (it.name === "עגבניות") { it.qty = "2 ק\"ג"; it.notes = "סלטים + שקשוקה + ~5 למתכונים (3 למילוי, 2 לתחתית הסיר)"; }
    if (it.name === "שום") { it.notes = "ראש אחד מספיק — כולל 5 שיניים למתכונים"; }
    if (it.name.startsWith("פטרוזיליה")) { it.notes = "כולל חופן קצוץ למתכונים"; }
  }
  addIfMissing({ cat: "ירקות", name: "כרוב לבן גדול", qty: "1", notes: "למתכון הכרוב הממולא — לריכוך עלים" });
  addIfMissing({ cat: "ירקות", name: "בצל רגיל", qty: "5 יח׳", notes: "למתכונים: 1.5 למילוי עלי הגפן, 2 לתחתית הסיר, 1 לכרוב", productId: "p-onion" });
  addIfMissing({ cat: "ירקות", name: "בצל ירוק", qty: "חבילה", notes: "למתכונים — חצי לשלב הראשון של המילוי, חצי בהמשך" });
  addIfMissing({ cat: "ירקות", name: "סלרי", qty: "צרור", notes: "למתכונים — 5 גבעולים" });
  addIfMissing({ cat: "בשר", name: "בשר בקר טחון", qty: "500 ג׳", notes: "למילוי עלי הגפן והכרוב" });
  addIfMissing({ cat: "יבשים ושימורים", name: "אורז עגול", qty: "שקית 1.5 ק\"ג", notes: "למתכונים צריך ~1.2 ק\"ג (1 ק\"ג לעלי גפן + כוס לכרוב) — לא להתבלבל עם האורז הרגיל" });
  addIfMissing({ cat: "יבשים ושימורים", name: "עלי גפן משומרים", qty: "2 צנצנות", notes: "או ק\"ג עלים טריים אם יש בעונה" });
  addIfMissing({ cat: "יבשים ושימורים", name: "רסק עגבניות", qty: "פחית קטנה", notes: "למתכונים — צריך 3-4 כפות" });
  addIfMissing({ cat: "יבשים ושימורים", name: "שמן זית", qty: "בקבוק", notes: "למתכונים צריך ~300 מ\"ל — לבדוק כמה יש בבית", productId: "p-oil" });
  addIfMissing({ cat: "תבלינים (לבדוק מה יש בבית)", name: "מלח + פלפל שחור גרוס", qty: "לבדוק שיש", notes: "" });
  addIfMissing({ cat: "תבלינים (לבדוק מה יש בבית)", name: "פפריקה מתוקה", qty: "לבדוק שיש", notes: "צריך ~4 כפות" });
  addIfMissing({ cat: "תבלינים (לבדוק מה יש בבית)", name: "כמון", qty: "לבדוק שיש", notes: "צריך כף" });
  addIfMissing({ cat: "תבלינים (לבדוק מה יש בבית)", name: "בהרט", qty: "לבדוק שיש", notes: "צריך כפית" });
  state.seedV = 4;
  save();
}

/* שדרוג 5: הערות חג לשבוע 6-12.9 (ראש השנה — שישי-שבת מחוץ לבית) */
if (state.seedV < 5) {
  const holidayWeek = state.weeks && state.weeks["2026-09-06"];
  if (holidayWeek) {
    holidayWeek.days[5].notes = "חג 🍎🍯 — ארוחת חג בחוץ (מביאים עלי גפן ממולאים + כרוב ממולא)";
    holidayWeek.days[6].notes = "חג — חוזרים הביתה אחה\"צ";
  }
  state.seedV = 5;
  save();
}

/* שדרוג 6-7: מנות ומוצרים חדשים (סלט תאילנדי, עלי גפן, כרוב ממולא) */
if (state.seedV < 7) {
  for (const p of DEFAULT_PRODUCTS) if (!productById(p.id)) state.products.push(JSON.parse(JSON.stringify(p)));
  for (const m of DEFAULT_MEALS) if (!mealById(m.id)) state.meals.push(JSON.parse(JSON.stringify(m)));
  state.seedV = 7;
  save();
}

/* שדרוג 8: סלוט "ביניים" + שייק חלבון בימי ריצה, ויעד מותאם ל-76 ק"ג (120-135) */
if (state.seedV < 8) {
  if (state.settings.proteinMin === 130 && state.settings.proteinMax === 140) {
    state.settings.proteinMin = 120;
    state.settings.proteinMax = 135;
  }
  for (const p of DEFAULT_PRODUCTS) if (!productById(p.id)) state.products.push(JSON.parse(JSON.stringify(p)));
  for (const m of DEFAULT_MEALS) if (!mealById(m.id)) state.meals.push(JSON.parse(JSON.stringify(m)));
  const shake = mealById("m-shake");
  for (const wk of Object.values(state.weeks || {})) {
    wk.days.forEach((day, i) => {
      if (day.snack == null) day.snack = "";
      if (day.eaten && day.eaten.snack == null) day.eaten.snack = false;
      day.mealIds = day.mealIds || {};
      day.slotProtein = day.slotProtein || {};
      // ימי ריצה (ב'/ד'/ו') מקבלים שייק כברירת מחדל, אם לא נקבע שם משהו
      if (shake && [1, 3, 5].includes(i) && !day.mealIds.snack && !day.snack) {
        day.mealIds.snack = "m-shake";
        day.slotProtein.snack = mealProtein(shake);
        day.snack = "שייק חלבון (אחרי הריצה)";
        const vals = SLOT_KEYS.map((s) => day.slotProtein[s]).filter((v) => v != null);
        if (vals.length) day.protein = Math.round(vals.reduce((a, b) => a + b, 0));
      }
    });
  }
  state.seedV = 8;
  save();
}

/* שדרוג 9: מעבר למבנה יום מודולרי — רשימת ארוחות במקום 4 סלוטים קבועים */
if (state.seedV < 9) {
  for (const wk of Object.values(state.weeks || {})) {
    for (const day of wk.days) {
      if (day.items) continue;
      day.items = [];
      for (const slot of SLOT_KEYS) {
        const text = day[slot] || "";
        const mealId = (day.mealIds || {})[slot] || null;
        if (slot === "snack" && !text && !mealId) continue;
        day.items.push({
          id: newId("mi"),
          label: SLOT_LABELS[slot],
          text,
          mealId,
          protein: day.slotProtein && day.slotProtein[slot] != null ? day.slotProtein[slot] : null,
          eaten: !!((day.eaten || {})[slot]),
        });
      }
      delete day.morning; delete day.noon; delete day.evening; delete day.snack;
      delete day.eaten; delete day.mealIds; delete day.slotProtein;
    }
  }
  state.seedV = 9;
  save();
}

/* שדרוג 10: שיבולת שועל + שייק עם שיבולת מושרית */
if (state.seedV < 10) {
  for (const p of DEFAULT_PRODUCTS) if (!productById(p.id)) state.products.push(JSON.parse(JSON.stringify(p)));
  for (const m of DEFAULT_MEALS) if (!mealById(m.id)) state.meals.push(JSON.parse(JSON.stringify(m)));
  state.seedV = 10;
  save();
}

/* שדרוג 11: יעד חלבון לפי המטרה שהוגדרה — ריקומפוזיציה + ביצועים (125-140) */
if (state.seedV < 11) {
  if (state.settings.proteinMin === 120 && state.settings.proteinMax === 135) {
    state.settings.proteinMin = 125;
    state.settings.proteinMax = 140;
  }
  state.seedV = 11;
  save();
}

/* שדרוג 12: מסך אימונים מודולרי — מאגר תרגילים, מאגר אימונים,
   והמרת כל הרישומים הקיימים למבנה המאוחד w.ex + w.exList */
if (!state.exercises) state.exercises = JSON.parse(JSON.stringify(DEFAULT_EXLIB));
if (!state.workoutTemplates) state.workoutTemplates = JSON.parse(JSON.stringify(DEFAULT_WORKOUT_TEMPLATES));
if (state.seedV < 12) {
  for (const [date, w] of Object.entries(state.workouts || {})) {
    if (w.ex) continue;
    w.ex = {};
    for (const [id, sets] of Object.entries(w.exercises || {})) {
      w.ex[id] = sets.map((s) => ({ reps: s.reps || 0, weight: s.weight || 0 }));
    }
    if (w.pullups && w.pullups.length) {
      w.ex.pullups = w.pullups.map((s) => ({ variant: s.type || PULLUP_TYPES[0], reps: s.reps || 0 }));
    }
    for (const [id, sets] of Object.entries(w.coreEx || {})) {
      w.ex[id] = sets.map((s) => ({ reps: s.reps || 0, done: !!s.done }));
    }
    if (w.core && Array.isArray(w.core.plank)) {
      const p = w.core.plank.filter((v) => v > 0).map((v) => ({ secs: v, done: true }));
      if (p.length) w.ex.plank = p;
    }
    const wd = fromIso(date).getDay();
    const tpl = state.workoutTemplates.find((t) => t.id === (STRENGTH_DAYS.includes(wd) ? "t-strength" : "t-run"));
    w.exList = tpl ? [...tpl.exerciseIds] : Object.keys(w.ex);
    delete w.exercises; delete w.pullups; delete w.coreEx; delete w.core;
  }
  state.seedV = 12;
  save();
}

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
  // היום, אלא אם שבת (מנוחה) — ואז מחר
  const t = new Date();
  return t.getDay() === REST_DAY ? addDays(iso(t), 1) : iso(t);
}

/* ---------- שבוע תפריט ---------- */
/* יום = רשימת ארוחות מודולרית: מוסיפים, מוחקים וגוררים לשינוי סדר */
function blankDayFrom(t) {
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
      items: (d.items || []).map((it) => ({ ...it, id: newId("mi"), eaten: false })),
      notes: d.notes, protein: d.protein, fast: d.fast,
    })),
  };
  save();
  renderMenu();
}

/* ---------- אימון ---------- */
const exLibById = (id) => state.exercises.find((x) => x.id === id);
const templateById = (id) => state.workoutTemplates.find((t) => t.id === id);

function defaultSets(lib) {
  if (!lib) return [{ reps: 10 }];
  if (lib.mode === "weight") return Array.from({ length: 3 }, () => ({ reps: lib.defReps || 10, weight: lib.defWeight || 10 }));
  if (lib.mode === "reps") return Array.from({ length: 3 }, () => ({ reps: lib.defReps || 12, done: false }));
  if (lib.mode === "seconds") return Array.from({ length: 3 }, () => ({ secs: lib.defSecs || 30, done: false }));
  if (lib.mode === "pullup") return [
    { variant: PULLUP_TYPES[0], reps: 4 }, { variant: PULLUP_TYPES[1], reps: 7 }, { variant: PULLUP_TYPES[1], reps: 7 },
  ];
  return [{ reps: 10 }];
}

/* המשכיות פר-תרגיל: הסטים האחרונים של אותו תרגיל, מכל אימון קודם שהוא הופיע בו */
function lastSetsFor(exId, beforeIso) {
  const keys = Object.keys(state.workouts).filter((k) => k < beforeIso).sort().reverse();
  for (const k of keys) {
    const w = state.workouts[k];
    if (w.ex && w.ex[exId] && w.ex[exId].length) return w.ex[exId];
  }
  return null;
}
function freshSetsFor(exId, dateIso) {
  const prev = lastSetsFor(exId, dateIso);
  if (prev) return prev.map((s) => ({ ...s, done: false }));
  return defaultSets(exLibById(exId));
}
function dayTemplate(dateIso) {
  const wd = fromIso(dateIso).getDay();
  return templateById(STRENGTH_DAYS.includes(wd) ? "t-strength" : "t-run") || state.workoutTemplates[0];
}

function ensureWorkout(dateIso) {
  if (!state.workouts[dateIso]) {
    const prev = lastWorkoutBefore(dateIso);
    const prevStrength = lastStrengthWorkoutBefore(dateIso);
    const tpl = dayTemplate(dateIso);
    const exList = tpl ? [...tpl.exerciseIds] : [];
    const ex = {};
    for (const id of exList) ex[id] = freshSetsFor(id, dateIso);
    state.workouts[dateIso] = {
      curlVariant: prevStrength && prevStrength.curlVariant === "hammer" ? "regular" : "hammer",
      ex, exList,
      run: { km: 0, minutes: 0 },
      ropeMode: prev ? (prev.ropeMode || "count") : "count",
      ropeMinutes: 0, ropeRounds: 10,
      ropeJumpsPerSet: prev ? (prev.ropeJumpsPerSet || 50) : 50,
      ropeTargetSets: prev ? (prev.ropeTargetSets || 6) : 6,
      ropeSetsDone: 0,
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
function lastStrengthWorkoutBefore(dateIso) {
  const keys = Object.keys(state.workouts)
    .filter((k) => k < dateIso && STRENGTH_DAYS.includes(fromIso(k).getDay()))
    .sort();
  return keys.length ? state.workouts[keys[keys.length - 1]] : null;
}
function lastRunWorkoutBefore(dateIso) {
  const keys = Object.keys(state.workouts)
    .filter((k) => k < dateIso && RUN_DAYS.includes(fromIso(k).getDay()))
    .sort();
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
    if (target === "shopping") renderShopping();
    if (target === "food") renderFood();
    if (target === "progress") renderProgress();
  });
});

/* ============================ מסך תפריט ============================ */

$("#week-prev").addEventListener("click", () => { currentWeekKey = addDays(currentWeekKey, -7); renderMenu(); });
$("#week-next").addEventListener("click", () => { currentWeekKey = addDays(currentWeekKey, 7); renderMenu(); });
$("#btn-copy-week").addEventListener("click", () => copyPrevWeek(currentWeekKey));
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
    state.weeks[currentWeekKey] = { days: MENU_TEMPLATE.map(blankDayFrom) };
    save();
    renderMenu();
  }
});


let scrolledToToday = false;

function renderMenu() {
  const week = ensureWeek(currentWeekKey);
  const endKey = addDays(currentWeekKey, 6);
  $("#week-label").textContent = `${shortDate(currentWeekKey)} – ${shortDate(endKey)}`;
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

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/* ---------- מודאל עריכת יום ---------- */
let editingDayIndex = null;
let editingItems = []; // עותק עבודה של ארוחות היום בזמן עריכה

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

function updateEditGap() {
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

function refreshEditTotals() {
  const vals = editingItems.map((i) => i.protein).filter((v) => v != null);
  if (vals.length) $("#edit-protein").value = Math.round(vals.reduce((a, b) => a + b, 0));
  updateEditGap();
}

/* גרירה לשינוי סדר — עובד גם במגע (pointer events + touch-action:none על הידית).
   לא מזיזים את האלמנט בזמן הגרירה (זה מנתק את ה-pointer capture) — רק מסמנים
   קו יעד, ומבצעים את הסידור מחדש בשחרור. */
function enableDrag(handle, block, wrap, onDrop) {
  handle.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    handle.setPointerCapture(e.pointerId);
    block.classList.add("dragging");
    let targetIndex = null;
    const idOf = (b) => b.dataset.itemId || b.dataset.exId;
    const clearMarks = () =>
      [...wrap.children].forEach((b) => b.classList.remove("drop-before", "drop-after"));
    const move = (ev) => {
      clearMarks();
      const list = [...wrap.children];
      targetIndex = list.length;
      for (let i = 0; i < list.length; i++) {
        const r = list[i].getBoundingClientRect();
        if (ev.clientY < r.top + r.height / 2) { targetIndex = i; break; }
      }
      if (targetIndex < list.length) list[targetIndex].classList.add("drop-before");
      else list[list.length - 1].classList.add("drop-after");
    };
    const finish = () => {
      handle.removeEventListener("pointermove", move);
      clearMarks();
      block.classList.remove("dragging");
      if (targetIndex == null) return;
      const list = [...wrap.children];
      const ids = list.map(idOf);
      const fromIdx = list.indexOf(block);
      let to = targetIndex;
      const [moved] = ids.splice(fromIdx, 1);
      if (to > fromIdx) to--;
      ids.splice(to, 0, moved);
      onDrop(ids);
    };
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", finish, { once: true });
    handle.addEventListener("pointercancel", finish, { once: true });
  });
}

function renderEditorItems() {
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

function openDayEditor(i) {
  editingDayIndex = i;
  const day = state.weeks[currentWeekKey].days[i];
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
  const day = state.weeks[currentWeekKey].days[editingDayIndex];
  day.items = editingItems;
  day.notes = $("#edit-notes").value;
  day.protein = Math.max(0, parseInt($("#edit-protein").value, 10) || 0);
  day.fast = $("#edit-fast").checked;
  save();
  $("#modal").classList.add("hidden");
  renderMenu();
});

/* ============================ מסך אימונים ============================ */

function normalizeWorkout(w, dateIso) {
  if (!w.run) w.run = { km: 0, minutes: 0 };
  if (!w.curlVariant) w.curlVariant = "hammer";
  if (!w.ex) w.ex = {};
  if (!w.exList) {
    const tpl = dayTemplate(dateIso);
    w.exList = tpl ? [...tpl.exerciseIds] : Object.keys(w.ex);
  }
  for (const id of w.exList) if (!w.ex[id]) w.ex[id] = defaultSets(exLibById(id));
  return w;
}
function getWorkout(dateIso) {
  return normalizeWorkout(ensureWorkout(dateIso), dateIso);
}

function renderWorkout() {
  renderWorkoutChips();
  exTimerReset(); // מעבר יום לא משאיר טיימר רץ שיישמר ליום הלא נכון
  const wd = fromIso(currentWorkoutDate).getDay();
  const isRest = wd === REST_DAY;
  const isStrength = STRENGTH_DAYS.includes(wd);

  // שבת: מנוחה מלאה — אין רישום
  $("#card-rest").classList.toggle("hidden", !isRest);
  $("#card-run").classList.toggle("hidden", isRest || isStrength);
  $("#card-rope").classList.toggle("hidden", isRest);
  $("#card-exercises").classList.toggle("hidden", isRest);
  $("#card-timer").classList.toggle("hidden", isRest);
  $("#btn-finish-workout").classList.toggle("hidden", isRest);

  if (isRest) {
    $("#workout-day-type").textContent = "😴 מנוחה מלאה";
    return;
  }

  $("#workout-day-type").textContent = isStrength
    ? "💪 אימון כוח: חבל (חימום) ← מתח ← משקולות"
    : "🏃 ריצה (או חבל אם לא רצת) + ליבה";
  $("#rope-role").textContent = isStrength ? "· חימום 5–8 דק׳" : "· אם לא רצת";

  const w = getWorkout(currentWorkoutDate);

  renderRope(w);
  renderRun(w);
  renderDayExercises(w);

  const finishBtn = $("#btn-finish-workout");
  finishBtn.textContent = w.done ? "✔ האימון הושלם (לחץ לביטול)" : "✅ סיים אימון";
  finishBtn.classList.toggle("done", w.done);
}

/* ---------- ריצה ---------- */
function paceText(km, minutes) {
  if (!km || !minutes) return "—";
  const paceMin = minutes / km;
  const mm = Math.floor(paceMin);
  const ss = Math.round((paceMin - mm) * 60);
  return `${mm}:${String(ss).padStart(2, "0")} דק׳/ק״מ`;
}
function renderRun(w) {
  $("#run-km").value = w.run.km || "";
  $("#run-minutes").value = w.run.minutes || "";
  $("#run-pace").textContent = paceText(w.run.km, w.run.minutes);
}
$("#run-km").addEventListener("input", () => {
  const w = getWorkout(currentWorkoutDate);
  w.run.km = parseFloat($("#run-km").value) || 0;
  save();
  $("#run-pace").textContent = paceText(w.run.km, w.run.minutes);
});
$("#run-minutes").addEventListener("input", () => {
  const w = getWorkout(currentWorkoutDate);
  w.run.minutes = parseFloat($("#run-minutes").value) || 0;
  save();
  $("#run-pace").textContent = paceText(w.run.km, w.run.minutes);
});

/* ---------- רשימת התרגילים של היום (מודולרית) ---------- */
function exDisplayName(lib, w) {
  if (lib.id === "curl") return `${CURL_NAMES[w.curlVariant] || CURL_NAMES.hammer} <span class="meal-badge">היום</span>`;
  return escapeHtml(lib.name);
}
function formatPrevSets(lib, sets) {
  if (lib.mode === "weight") return sets.map((s) => `${s.reps}×${s.weight || 0}ק״ג`).join(" · ");
  if (lib.mode === "pullup") return sets.map((s) => `${s.reps} ${s.variant === PULLUP_TYPES[0] ? "מלא" : "גומייה"}`).join(" · ");
  const done = sets.filter((s) => s.done);
  const use = done.length ? done : sets;
  return use.map((s) => (lib.mode === "seconds" ? s.secs : s.reps) || 0).join(" · ") + (lib.mode === "seconds" ? " שנ׳" : " חזרות");
}

function renderDayExercises(w) {
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
    const removeBtn = document.createElement("button");
    removeBtn.className = "del-set";
    removeBtn.textContent = "✕";
    removeBtn.title = "הסר מהאימון של היום";
    removeBtn.addEventListener("click", () => {
      w.exList = w.exList.filter((id) => id !== exId);
      save();
      renderDayExercises(w);
    });
    head.append(handle, nameDiv, removeBtn);
    block.appendChild(head);

    const prev = lastSetsFor(exId, currentWorkoutDate);
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

function buildSetsTable(lib, sets, w) {
  const cols = {
    weight: ["סט", "חזרות", "משקל (ק״ג)", ""],
    reps: ["סט", "חזרות", "בוצע", ""],
    seconds: ["סט", "שניות", "", "בוצע", ""],
    pullup: ["סט", "סוג", "חזרות", ""],
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
    }
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  return table;
}

/* ---------- טיימר שניות (פלאנק, Suitcase Carry...): היכון 5 שנ' -> שעון עולה ---------- */
const exTimer = { phase: "idle", interval: null, sec: 0, target: 0, set: null, input: null, name: "" };

function exTimerDraw() {
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
function exTimerReset() {
  clearInterval(exTimer.interval);
  exTimer.phase = "idle";
  $("#ex-timer").classList.add("hidden");
}
function exTimerStart(lib, set, input) {
  clearInterval(exTimer.interval);
  exTimer.set = set;
  exTimer.input = input;
  exTimer.name = lib.name;
  exTimer.target = set.secs || 0;
  exTimer.phase = "countdown";
  exTimer.sec = 5;
  $("#ex-timer").classList.remove("hidden");
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
  const w = getWorkout(currentWorkoutDate);
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
  $("#ex-modal").classList.remove("hidden");
});
$("#ex-cancel").addEventListener("click", () => $("#ex-modal").classList.add("hidden"));
$("#ex-add-existing").addEventListener("click", () => {
  const id = $("#ex-pick").value;
  if (!id) { alert("כל התרגילים מהמאגר כבר באימון — צור תרגיל חדש למטה."); return; }
  const w = getWorkout(currentWorkoutDate);
  w.exList.push(id);
  if (!w.ex[id]) w.ex[id] = freshSetsFor(id, currentWorkoutDate);
  save();
  $("#ex-modal").classList.add("hidden");
  renderWorkout();
});
$("#ex-add-new").addEventListener("click", () => {
  const name = $("#ex-new-name").value.trim();
  if (!name) { alert("חסר שם לתרגיל."); return; }
  const lib = {
    id: newId("x"),
    name,
    hint: $("#ex-new-hint").value.trim(),
    mode: $("#ex-new-mode").value,
    defReps: 12, defWeight: 10, defSecs: 30,
  };
  state.exercises.push(lib);
  const w = getWorkout(currentWorkoutDate);
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
      const w = getWorkout(currentWorkoutDate);
      w.exList = [...tpl.exerciseIds];
      for (const id of w.exList) if (!w.ex[id]) w.ex[id] = freshSetsFor(id, currentWorkoutDate);
      save();
      $("#wt-modal").classList.add("hidden");
      renderWorkout();
    });
    row.appendChild(body);
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
  const w = getWorkout(currentWorkoutDate);
  if (!w.exList.length) { alert("אין תרגילים באימון של היום."); return; }
  const name = prompt("שם לאימון החדש (יישמר במאגר האימונים):");
  if (!name || !name.trim()) return;
  state.workoutTemplates.push({ id: newId("wt"), name: name.trim(), exerciseIds: [...w.exList] });
  save();
  alert(`"${name.trim()}" נשמר — זמין דרך 📂 טען אימון.`);
});

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
      + (wd === REST_DAY ? " restday" : "")
      + (state.workouts[dateIso] && state.workouts[dateIso].done ? " done" : "");
    chip.textContent = (i === 0 ? `היום · ${DAY_SHORT[wd]}` : `${DAY_SHORT[wd]} ${shortDate(dateIso)}`)
      + (wd === REST_DAY ? " 😴" : "");
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
  const w = getWorkout(currentWorkoutDate);
  w.ropeMode = "count"; save(); renderRope(w);
});
$("#rope-mode-time").addEventListener("click", () => {
  const w = getWorkout(currentWorkoutDate);
  w.ropeMode = "time"; save(); renderRope(w);
});
$("#rope-jumps-per-set").addEventListener("input", () => {
  const w = getWorkout(currentWorkoutDate);
  w.ropeJumpsPerSet = parseInt($("#rope-jumps-per-set").value, 10) || 50;
  save(); renderRope(w);
});
$("#rope-target-sets").addEventListener("input", () => {
  const w = getWorkout(currentWorkoutDate);
  w.ropeTargetSets = parseInt($("#rope-target-sets").value, 10) || 6;
  save();
});
$("#rope-set-done").addEventListener("click", () => {
  const w = getWorkout(currentWorkoutDate);
  w.ropeSetsDone = (w.ropeSetsDone || 0) + 1;
  save(); renderRope(w);
  beep(880, 0.15);
  if (w.ropeSetsDone === (w.ropeTargetSets || 6)) {
    setTimeout(() => beep(1100, 0.2), 180); setTimeout(() => beep(1320, 0.3), 380);
  }
});
$("#rope-set-undo").addEventListener("click", () => {
  const w = getWorkout(currentWorkoutDate);
  w.ropeSetsDone = Math.max(0, (w.ropeSetsDone || 0) - 1);
  save(); renderRope(w);
});

$("#rope-minutes").addEventListener("input", () => {
  const w = getWorkout(currentWorkoutDate);
  w.ropeMinutes = parseFloat($("#rope-minutes").value) || 0;
  save();
});
$("#rope-rounds").addEventListener("input", () => {
  const w = getWorkout(currentWorkoutDate);
  w.ropeRounds = parseInt($("#rope-rounds").value, 10) || 10;
  save();
});

/* ---------- ייצוא לוח שבועי ליומן (.ics) ---------- */
function nextDateOfDay(weekday) { // התאריך הקרוב (כולל היום) של יום נתון
  const d = new Date();
  while (d.getDay() !== weekday) d.setDate(d.getDate() + 1);
  return d;
}
function icsDate(d, timeStr) {
  const [hh, mm] = timeStr.split(":");
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}T${hh}${mm}00`;
}
function buildICS() {
  const time = state.settings.workoutTime || "07:00";
  const dur = state.settings.workoutDur || 45;
  const stamp = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const alarms =
    "BEGIN:VALARM\r\nACTION:DISPLAY\r\nDESCRIPTION:אימון מחר\r\nTRIGGER:-PT12H\r\nEND:VALARM\r\n" +
    "BEGIN:VALARM\r\nACTION:DISPLAY\r\nDESCRIPTION:אימון עוד חצי שעה\r\nTRIGGER:-PT30M\r\nEND:VALARM\r\n";
  const ev = (uid, summary, desc, firstDay, byday) =>
    "BEGIN:VEVENT\r\n" +
    `UID:${uid}@edans-sports-app\r\n` +
    `DTSTAMP:${stamp}\r\n` +
    `DTSTART;TZID=Asia/Jerusalem:${icsDate(nextDateOfDay(firstDay), time)}\r\n` +
    `DURATION:PT${dur}M\r\n` +
    `RRULE:FREQ=WEEKLY;BYDAY=${byday}\r\n` +
    `SUMMARY:${summary}\r\n` +
    `DESCRIPTION:${desc}\r\n` +
    alarms +
    "END:VEVENT\r\n";
  return "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//edans-sports-app//HE\r\n" +
    "BEGIN:VTIMEZONE\r\nTZID:Asia/Jerusalem\r\n" +
    "BEGIN:DAYLIGHT\r\nTZOFFSETFROM:+0200\r\nTZOFFSETTO:+0300\r\nTZNAME:IDT\r\nDTSTART:19700327T020000\r\nRRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1FR\r\nEND:DAYLIGHT\r\n" +
    "BEGIN:STANDARD\r\nTZOFFSETFROM:+0300\r\nTZOFFSETTO:+0200\r\nTZNAME:IST\r\nDTSTART:19701025T020000\r\nRRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU\r\nEND:STANDARD\r\n" +
    "END:VTIMEZONE\r\n" +
    ev("strength", "💪 אימון כוח — חבל, מתח, משקולות",
      "חבל 5-8 דק' חימום (30/30) ← מתח ← משקולות: חתירה בעמידה, לחיצת כתפיים, דדליפט רומני, Rear Delt Fly, Curl",
      0, "SU,TU,TH") +
    ev("run", "🏃 ריצה + ליבה",
      "ריצה (או חבל אם לא רצת) + פלאנק ובטן",
      1, "MO,WE,FR") +
    "END:VCALENDAR\r\n";
}
$("#ics-time").addEventListener("input", () => { state.settings.workoutTime = $("#ics-time").value || "07:00"; save(); });
$("#ics-dur").addEventListener("input", () => { state.settings.workoutDur = parseInt($("#ics-dur").value, 10) || 45; save(); });
$("#ics-time").value = state.settings.workoutTime || "07:00";
$("#ics-dur").value = state.settings.workoutDur || 45;
$("#ics-export").addEventListener("click", () => {
  const blob = new Blob([buildICS()], { type: "text/calendar;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "edan-workouts.ics";
  document.body.appendChild(a);
  a.click();
  a.remove();
});

$("#btn-finish-workout").addEventListener("click", () => {
  const w = getWorkout(currentWorkoutDate);
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
  const w = getWorkout(currentWorkoutDate);
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

/* ============================ מסך קניות ============================ */

function ensureShopping(weekKey) {
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

function shareShoppingList() {
  const list = ensureShopping(currentWeekKey);
  const remaining = list.items.filter((i) => !i.checked);
  if (!remaining.length) { alert("הכל נקנה! 🎉"); return; }
  let text = `🛒 רשימת קניות ${shortDate(currentWeekKey)}–${shortDate(addDays(currentWeekKey, 6))}\n`;
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
function weekProductNeeds(weekKey) {
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

function formatNeed(productId, grams) {
  const p = productById(productId);
  if (p && p.unitName && p.unitGrams) return `~${Math.ceil(grams / p.unitGrams)} ${p.unitName}`;
  return grams >= 1000 ? `~${round1(grams / 1000)} ק״ג` : `~${Math.round(grams)} ג׳`;
}

/* סנכרון אוטומטי: כל מוצר שהתפריט של השבוע צריך ואין לו פריט קנייה — נוסף לבד.
   פריט אוטומטי שהצורך בו נעלם (והוא לא סומן) — מוסר. */
function syncShoppingWithMenu(weekKey) {
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

function renderShopping() {
  const list = syncShoppingWithMenu(currentWeekKey);
  const endKey = addDays(currentWeekKey, 6);
  $("#shop-week-label").textContent = `${shortDate(currentWeekKey)} – ${shortDate(endKey)}`;
  const bought = list.items.filter((i) => i.checked).length;
  $("#shop-progress").textContent = `נקנו ${bought} מתוך ${list.items.length}`;

  const needs = weekProductNeeds(currentWeekKey);
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
$("#shop-week-prev").addEventListener("click", () => { currentWeekKey = addDays(currentWeekKey, -7); renderShopping(); });
$("#shop-week-next").addEventListener("click", () => { currentWeekKey = addDays(currentWeekKey, 7); renderShopping(); });
$("#shop-reset").addEventListener("click", () => {
  if (!confirm("לאפס את הרשימה לרשימה המקורית? (סימונים ופריטים שהוספת יימחקו)")) return;
  delete state.shopping[currentWeekKey];
  save();
  renderShopping();
});
$("#shop-add").addEventListener("click", () => {
  const list = ensureShopping(currentWeekKey);
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
  const list = ensureShopping(currentWeekKey);
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

/* ---------- מדדי גוף: משקל + מותן ---------- */
if (!state.body) state.body = []; // [{date, weight, waist}]

function renderBody() {
  const entries = [...state.body].sort((a, b) => (a.date < b.date ? -1 : 1));
  const last = entries[entries.length - 1];
  $("#body-last").textContent = last
    ? `מדידה אחרונה: ${shortDate(last.date)} — ${last.weight} ק״ג${last.waist ? `, מותן ${last.waist} ס״מ` : ""}`
    : "עוד אין מדידות — שקילה פעם בשבוע, באותה שעה, מספיקה.";
  drawBodyChart();
}

function drawBodyChart() {
  const metric = $("#body-metric").value || "weight";
  const points = [...state.body]
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .filter((e) => e[metric] > 0)
    .map((e) => ({ label: shortDate(e.date), val: e[metric] }))
    .slice(-12);
  drawLineChart($("#chart-body"), points, "");
}

$("#body-save").addEventListener("click", () => {
  const weight = parseFloat($("#body-weight").value) || 0;
  const waist = parseFloat($("#body-waist").value) || 0;
  if (!weight && !waist) { alert("הזן לפחות משקל או מותן."); return; }
  const today = todayIso();
  const existing = state.body.find((e) => e.date === today);
  if (existing) {
    if (weight) existing.weight = weight;
    if (waist) existing.waist = waist;
  } else {
    state.body.push({ date: today, weight, waist });
  }
  save();
  $("#body-weight").value = "";
  $("#body-waist").value = "";
  renderBody();
});
$("#body-metric").addEventListener("change", drawBodyChart);

/* ---------- תמונות התקדמות (IndexedDB — נשאר במכשיר בלבד) ---------- */
function photosDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("edan-photos", 1);
    req.onupgradeneeded = () => req.result.createObjectStore("photos", { keyPath: "id" });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
function photoTx(mode, fn) {
  return photosDB().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction("photos", mode);
    const store = tx.objectStore("photos");
    const result = fn(store);
    tx.oncomplete = () => resolve(result && result.result !== undefined ? result.result : undefined);
    tx.onerror = () => reject(tx.error);
  }));
}
function listPhotos() { return photoTx("readonly", (s) => s.getAll()); }
function putPhoto(rec) { return photoTx("readwrite", (s) => s.put(rec)); }
function removePhoto(id) { return photoTx("readwrite", (s) => s.delete(id)); }

/* כיווץ לפני שמירה — ~1000px JPEG, כדי שהאחסון המקומי לא יתמלא */
function compressImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const maxDim = 1000;
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("compress failed"))), "image/jpeg", 0.85);
      URL.revokeObjectURL(img.src);
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

async function renderPhotos() {
  let photos = [];
  try { photos = await listPhotos(); } catch (e) { return; }
  photos.sort((a, b) => (a.date < b.date ? -1 : 1));

  const compare = $("#photo-compare");
  compare.innerHTML = "";
  compare.classList.toggle("hidden", photos.length < 2);
  if (photos.length >= 2) {
    for (const [p, cap] of [[photos[0], "התחלה"], [photos[photos.length - 1], "עכשיו"]]) {
      const fig = document.createElement("figure");
      const img = document.createElement("img");
      img.src = URL.createObjectURL(p.blob);
      const fc = document.createElement("figcaption");
      fc.textContent = `${cap} · ${shortDate(p.date)}`;
      fig.append(img, fc);
      compare.appendChild(fig);
    }
  }

  const grid = $("#photo-grid");
  grid.innerHTML = "";
  for (const p of [...photos].reverse()) {
    const cell = document.createElement("div");
    cell.className = "photo-thumb";
    const img = document.createElement("img");
    img.src = URL.createObjectURL(p.blob);
    const date = document.createElement("span");
    date.className = "photo-date";
    date.textContent = shortDate(p.date);
    const del = document.createElement("button");
    del.className = "photo-del";
    del.textContent = "✕";
    del.addEventListener("click", async () => {
      if (!confirm("למחוק את התמונה? אין שחזור.")) return;
      await removePhoto(p.id);
      renderPhotos();
    });
    cell.append(img, date, del);
    grid.appendChild(cell);
  }
}

$("#photo-add").addEventListener("click", () => $("#photo-input").click());
$("#photo-input").addEventListener("change", async (e) => {
  const file = e.target.files && e.target.files[0];
  e.target.value = "";
  if (!file) return;
  try {
    const blob = await compressImage(file);
    await putPhoto({ id: newId("ph"), date: todayIso(), blob });
    renderPhotos();
  } catch (err) {
    alert("שמירת התמונה נכשלה — נסה שוב.");
  }
});

function renderProgress() {
  renderBody();
  renderPhotos();
  renderStreak();
  drawProteinChart();
  fillExerciseSelect();
  drawWeightsChart();
  drawRunChart();
  drawPullupsChart();
  fillCoreExSelect();
  drawCoreExChart();
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
  ctx.fillRect(pad.l, y(proteinMax()), W - pad.l - pad.r, y(proteinMin()) - y(proteinMax()));
  ctx.strokeStyle = "rgba(76, 208, 138, 0.5)";
  ctx.setLineDash([4, 4]);
  for (const t of [proteinMin(), proteinMax()]) {
    ctx.beginPath(); ctx.moveTo(pad.l, y(t)); ctx.lineTo(W - pad.r, y(t)); ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.fillStyle = "#93a1af";
  ctx.font = "10px sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(String(proteinMin()), 4, y(proteinMin()) + 3);
  ctx.fillText(String(proteinMax()), 4, y(proteinMax()) + 3);

  days.forEach((d, i) => {
    if (d.val == null) return;
    ctx.fillStyle = d.val >= proteinMin() ? "#4cd08a" : "#e8b44c";
    const bx = x(i) - barW / 2;
    ctx.fillRect(bx, y(d.val), barW, H - pad.b - y(d.val));
    if (i % 2 === 0) {
      ctx.fillStyle = "#93a1af";
      ctx.textAlign = "center";
      ctx.fillText(d.label, x(i), H - 8);
    }
  });
}

let exerciseSelectBound = false;
function fillExerciseSelect() {
  const sel = $("#chart-exercise-select");
  const prevValue = sel.value;
  sel.innerHTML = "";
  for (const ex of state.exercises.filter((x) => x.mode === "weight")) {
    const opt = document.createElement("option");
    opt.value = ex.id; opt.textContent = ex.id === "curl" ? "Curl (שתי הווריאציות)" : ex.name;
    sel.appendChild(opt);
  }
  // תרגילים ישנים עם היסטוריה — נשארים זמינים בגרף כארכיון
  for (const [id, name] of Object.entries(LEGACY_EXERCISES)) {
    const hasData = completedWorkouts().some(([, w]) =>
      w.ex && w.ex[id] && w.ex[id].some((s) => (s.weight || 0) > 0));
    if (hasData) {
      const opt = document.createElement("option");
      opt.value = id; opt.textContent = name;
      sel.appendChild(opt);
    }
  }
  if (prevValue && [...sel.options].some((o) => o.value === prevValue)) sel.value = prevValue;
  if (!exerciseSelectBound) {
    sel.addEventListener("change", drawWeightsChart);
    exerciseSelectBound = true;
  }
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
  const exId = $("#chart-exercise-select").value || "row";
  const points = completedWorkouts()
    .map(([date, w]) => {
      const sets = (w.ex && w.ex[exId]) || [];
      const maxW = Math.max(0, ...sets.map((s) => s.weight || 0));
      return { label: shortDate(date), val: maxW };
    })
    .filter((p) => p.val > 0)
    .slice(-10);
  drawLineChart($("#chart-weights"), points, "");
}

function drawPullupsChart() {
  // רק סט 1 מלא — מדד ההתקדמות האמיתי לקראת 7 מלאים
  const points = completedWorkouts()
    .filter(([, w]) => w.ex && w.ex.pullups && w.ex.pullups.length)
    .map(([date, w]) => {
      const firstFull = w.ex.pullups.find((s) => s.variant === PULLUP_TYPES[0]);
      return { label: shortDate(date), val: firstFull ? firstFull.reps || 0 : 0 };
    })
    .slice(-10);
  drawLineChart($("#chart-pullups"), points, "");
}

let coreExSelectBound = false;
function fillCoreExSelect() {
  const sel = $("#chart-coreex-select");
  const prevValue = sel.value;
  sel.innerHTML = "";
  for (const ex of state.exercises.filter((x) => x.mode === "reps" || x.mode === "seconds")) {
    const opt = document.createElement("option");
    opt.value = ex.id; opt.textContent = ex.name;
    sel.appendChild(opt);
  }
  if (prevValue && [...sel.options].some((o) => o.value === prevValue)) sel.value = prevValue;
  if (!coreExSelectBound) {
    sel.addEventListener("change", drawCoreExChart);
    coreExSelectBound = true;
  }
}

function drawCoreExChart() {
  const exId = $("#chart-coreex-select").value;
  const ex = exLibById(exId);
  if (!ex) return;
  // נפח = סכום הסטים שסומנו ✓ באימון
  const points = completedWorkouts()
    .map(([date, w]) => {
      const sets = (w.ex && w.ex[exId]) || [];
      const total = sets.filter((s) => s.done)
        .reduce((a, s) => a + ((ex.mode === "seconds" ? s.secs : s.reps) || 0), 0);
      return { label: shortDate(date), val: total };
    })
    .filter((p) => p.val > 0)
    .slice(-10);
  drawLineChart($("#chart-coreex"), points, ex.mode === "seconds" ? " שנ׳" : "");
}

function drawRunChart() {
  const points = completedWorkouts()
    .filter(([, w]) => w.run && w.run.km > 0)
    .map(([date, w]) => ({ label: shortDate(date), val: w.run.km }))
    .slice(-10);
  drawLineChart($("#chart-run"), points, ' ק"מ');
}

/* ============================ אתחול ============================ */

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").then((reg) => reg.update()).catch(() => {});
  });
  // כשגרסה חדשה נטענה ברקע והשתלטה — רענון אוטומטי חד-פעמי כדי להציג אותה מיד
  let reloadedForUpdate = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloadedForUpdate) return;
    reloadedForUpdate = true;
    location.reload();
  });
}

renderMenu();
ropeRender();
