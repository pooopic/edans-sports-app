"use strict";

/* ---------- תבנית תפריט (יובאה מגיליון "תפריט שבועי" באקסל) ---------- */
export const MENU_TEMPLATE = [
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
export const DEFAULT_EXLIB = [
  { id: "runx",     name: "🏃 ריצה", hint: "מרחק וזמן — הקצב מחושב לבד. אפשר לשבץ תוכנית מהבנאי", mode: "run",
    demoQuery: "proper running form technique", cues: ["צעדים קצרים ותכופים — נחיתה מתחת למרכז הכובד", "כתפיים משוחררות, מבט קדימה", "רוב הריצות קלות (Z2) — הקושי שמור לאינטרוולים"] },
  { id: "pullups",  name: "מתח", hint: "סט 1 מלא עד הכשל · סטים 2–3 גומייה יעד 7 · ב-7 מלאים סט 2 עובר למלא", mode: "pullup",
    demoQuery: "pull up proper form tutorial", cues: ["אחיזה מעט רחבה מהכתפיים", "שכמות למטה ואחורה לפני המשיכה", "סנטר מעל המוט, ירידה איטית בשליטה"] },
  { id: "row",      name: "חתירה בעמידה (Bent Over Row)", hint: "2× משקולות 5 ק״ג", mode: "weight", defReps: 10, defWeight: 10,
    demoQuery: "dumbbell bent over row form", cues: ["ברכיים כפופות קלות, גב ישר בהטיה ~45°", "מושכים אל המותן, מרפקים צמודים לגוף", "בלי תנופה — הגב לא זז"] },
  { id: "ohp",      name: "לחיצת כתפיים",                 hint: "2× משקולות 5 ק״ג", mode: "weight", defReps: 10, defWeight: 10,
    demoQuery: "dumbbell shoulder press standing form", cues: ["ליבה אסופה — לא לקמר גב תחתון", "דחיפה מעל הראש עד יישור כמעט מלא", "ירידה איטית לגובה האוזניים"] },
  { id: "rdl",      name: "דדליפט רומני",                 hint: "2× משקולות 5 ק״ג", mode: "weight", defReps: 12, defWeight: 10,
    demoQuery: "dumbbell romanian deadlift form", cues: ["ברכיים כפופות מעט וקבועות", "ירכיים נדחפות אחורה, גב ניטרלי", "יורדים עד מתיחה בירך האחורית — לא מעבר"] },
  { id: "rearfly",  name: "Rear Delt Fly",                hint: "2× משקולות 5 ק״ג", mode: "weight", defReps: 12, defWeight: 10,
    demoQuery: "rear delt fly dumbbell bent over form", cues: ["הטיה קדימה עם גב ישר", "פתיחה לצדדים עם מרפק רך", "משקל קל, טכניקה נקייה — לא תנופה"] },
  { id: "curl",     name: "Curl",                          hint: "משקולות 5 ק״ג — Hammer/רגיל מתחלפים", mode: "weight", defReps: 10, defWeight: 10,
    demoQuery: "hammer curl vs bicep curl form", cues: ["מרפקים צמודים לגוף ולא זזים", "בלי נדנוד גוף", "ירידה איטית — שם הכסף"] },
  { id: "plank",    name: "פלאנק",                         hint: "▶ מפעיל טיימר: 5 שנ׳ היכון ואז שעון עולה", mode: "seconds", defSecs: 30,
    demoQuery: "plank proper form", cues: ["גוף בקו ישר מהעקבים לראש", "בטן ועכוז אסופים", "לא לשקוע בין הכתפיים"] },
  { id: "russian",  name: "Russian Twist",                 hint: "דאמבל 5 ק״ג · 12–15 לכל צד", mode: "reps", defReps: 12,
    demoQuery: "russian twist dumbbell form", cues: ["גב ישר בהטיה אחורית", "הסיבוב מהליבה — המבט עוקב אחרי הידיים", "רגליים יציבות"] },
  { id: "situp",    name: "Weighted Sit-up",               hint: "דאמבל צמוד לחזה · 12–15", mode: "reps", defReps: 12,
    demoQuery: "weighted sit up dumbbell form", cues: ["דאמבל צמוד לחזה", "עלייה וירידה בשליטה", "הגב התחתון לא נחבט ברצפה"] },
  { id: "sidebend", name: "Dumbbell Side Bend",            hint: "12–15 לכל צד — להחליף יד בין סטים", mode: "reps", defReps: 12,
    demoQuery: "dumbbell side bend form", cues: ["הטיה לצד בלבד — בלי סיבוב", "מרגישים מתיחה בצד הנגדי", "טווח בינוני, בלי להתמוטט"] },
  { id: "deadbug",  name: "Dead Bug עם דאמבל",             hint: "דאמבל מעל החזה · לסירוגין רגל-רגל", mode: "reps", defReps: 12,
    demoQuery: "dead bug exercise dumbbell form", cues: ["גב תחתון צמוד לרצפה לאורך כל החזרה", "רגל יורדת לאט — לא נופלת", "נשיפה בהורדה"] },
  { id: "suitcase", name: "Suitcase Carry",                hint: "הליכה עם דאמבל ביד אחת · 30–40 שנ׳ לכל יד", mode: "seconds", defSecs: 30,
    demoQuery: "suitcase carry exercise form", cues: ["הליכה זקופה — הגוף לא נוטה לצד המשקולת", "כתפיים מאוזנות", "ליבה אסופה כל הדרך"] },
];
/* מאגר אימונים — תבניות שאפשר לטעון ליום, לשמור חדשות ולערוך */
export const DEFAULT_WORKOUT_TEMPLATES = [
  { id: "t-strength", name: "אימון כוח", exerciseIds: ["pullups", "row", "ohp", "rdl", "rearfly", "curl"] },
  { id: "t-run", name: "ריצה + ליבה", exerciseIds: ["plank", "russian", "situp", "sidebend", "deadbug", "suitcase"] },
];
/* תרגילים ישנים שהוסרו מהתוכנית — נשמרים בגרפים כארכיון */

/* ---------- מאגר מוצרים התחלתי (ערכים תזונתיים סטנדרטיים, ל-100 ג׳) ---------- */
export const DEFAULT_PRODUCTS = [
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
  { id: "p-oats",    name: "שיבולת שועל (יבשה)",  protein100: 13,   cal100: 380, carb100: 66, fat100: 7, fiber100: 10, unitName: "חצי כוס", unitGrams: 40 },
  /* ערכים מלאים (פחמימה/שומן/סיבים) — שדות אופציונליים בסכמת המוצר */
  { id: "p-lentilpatty", name: "קציצת עדשים ביתית", protein100: 11.7, cal100: 202, carb100: 27.7, fat100: 5.3, fiber100: 5.3, unitName: "קציצה", unitGrams: 47,
    note: "אצוות 16.9.26: 700 מ\"ל עדשים מבושלות, 500 ג' קמח חומוס, 4 ביצים, בצל, 3 שיני שום, 2 בטטות, פירורי לחם ותבלינים. אפוי בתנור, יצאו ~39 קציצות." },
  { id: "p-omelet2", name: "חביתה מ-2 ביצים (עם מעט שמן)", protein100: 10, cal100: 150, carb100: 0.8, fat100: 11.7, unitName: "מנה", unitGrams: 120 },
  { id: "p-cucumber", name: "מלפפון", protein100: 0.7, cal100: 15, carb100: 3, fiber100: 1, unitName: "יחידה", unitGrams: 100 },
  { id: "p-tomato", name: "עגבנייה", protein100: 0.8, cal100: 18, carb100: 4.2, fiber100: 1.3, unitName: "יחידה", unitGrams: 120 },
  { id: "p-creamcheese", name: "גבינת שמנת שום-שמיר נפוליאון", protein100: 6.7, cal100: 233, carb100: 3.3, fat100: 23.3, unitName: "2 כפות", unitGrams: 30 },
  { id: "p-yogurt3", name: "יוגורט 3%", protein100: 5, cal100: 60, carb100: 4.5, fat100: 3, unitName: "גביע", unitGrams: 200 },
  { id: "p-espresso", name: "דאבל אספרסו", protein100: 0, cal100: 0, unitName: "מנה", unitGrams: 60 },
  { id: "p-pita", name: "פיתה רגילה", protein100: 8.9, cal100: 278, carb100: 55.6, fat100: 1.7, fiber100: 2.2, unitName: "פיתה", unitGrams: 90 },
  { id: "p-hummus-plate", name: "צלחת חומוס משאושה (מסעדה)", protein100: 7.1, cal100: 206, carb100: 14.9, fat100: 13.4, fiber100: 5.7, unitName: "צלחת", unitGrams: 350,
    note: "אומדן אמצע טווח (650-800 קק\"ל לצלחת, תלוי בשמן זית וטחינה). לא כולל פיתה." },
];
/* כל הארוחות מהתפריט השבועי, מורכבות ממוצרים */
export const DEFAULT_MEALS = [
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
  { id: "m-shake-morning", name: "שייק בוקר", items: [
    { productId: "p-oats", grams: 100 },
    { productId: "p-powder", grams: 50 },
    { productId: "p-yogurt3", grams: 200 }, // גביע
    { productId: "p-espresso", grams: 60 },
  ]},
  { id: "m-hummus-lunch", name: "צהריים — חומוס משאושה + פיתה", items: [
    { productId: "p-hummus-plate", grams: 350 },
    { productId: "p-pita", grams: 90 },
  ]},
  { id: "m-lentil-patties", name: "ערב — קציצות עדשים", items: [
    { productId: "p-lentilpatty", grams: 188 },  // 4 קציצות
    { productId: "p-omelet2", grams: 120 },
    { productId: "p-cucumber", grams: 300 },     // 3 יח'
    { productId: "p-tomato", grams: 120 },
    { productId: "p-creamcheese", grams: 30 },
  ]},
  { id: "m-grapeleaves", name: "עלי גפן ממולאים (מנה ~8 יח׳)", items: [
    { productId: "p-rice", grams: 160 },        // המילוי ברובו אורז עגול
    { productId: "p-beef", grams: 30 },
    { productId: "p-grapeleaves", grams: 50 },
    { productId: "p-oil", grams: 10 },
  ]},
  { id: "m-cabbage", name: "כרוב ממולא בבשר (מנה ~3 יח׳)", items: [
    { productId: "p-veg", grams: 120 },         // עלי כרוב + עגבניות הרוטב
    { productId: "p-beef", grams: 120 },        // גרסת עידן: קילו בשר לבאטץ' — מילוי בשרי
    { productId: "p-rice", grams: 70 },
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
export const DEFAULT_SHOPPING = [
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
