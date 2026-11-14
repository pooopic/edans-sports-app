"use strict";
import { PULLUP_TYPES, RUN_DAYS, SLOT_KEYS, SLOT_LABELS, STRENGTH_DAYS } from "./constants.js";
import { addDays, fromIso, iso, weekKeyOf } from "./dates.js";
import { DEFAULT_EXLIB, DEFAULT_MEALS, DEFAULT_PRODUCTS, DEFAULT_WORKOUT_TEMPLATES, MENU_TEMPLATE } from "./defaults.js";
import { mealById, mealGrams, mealProtein, newId, productById, round1 } from "./model.js";
import { save, state } from "./state.js";
import { $ } from "./ui.js";
import { ensureShopping } from "../nutrition/model.js";

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

/* שדרוג 13: כרוב ממולא בגרסה הבשרית של עדן (קילו בשר לבאטץ', פחות אורז) */
if (state.seedV === 12) {
  const cab = mealById("m-cabbage");
  const isDefault = cab && JSON.stringify(cab.items) === JSON.stringify([
    { productId: "p-veg", grams: 120 }, { productId: "p-rice", grams: 120 },
    { productId: "p-beef", grams: 60 }, { productId: "p-oil", grams: 10 },
  ]);
  if (isDefault) {
    cab.items = [
      { productId: "p-veg", grams: 120 }, { productId: "p-beef", grams: 120 },
      { productId: "p-rice", grams: 70 }, { productId: "p-oil", grams: 10 },
    ];
    // ימים עתידיים שמקושרים לכרוב ושטרם נאכלו — מתעדכנים לערך החדש
    const todayStr = iso(new Date()); // todayIso מוגדר בהמשך הקובץ — לא זמין כאן
    for (const [wk, week] of Object.entries(state.weeks || {})) {
      week.days.forEach((day, i) => {
        const date = addDays(wk, i);
        if (date < todayStr) return;
        let changed = false;
        for (const it of day.items || []) {
          if (it.mealId === "m-cabbage" && !it.eaten) {
            const base = mealGrams(cab);
            const grams = it.grams || base;
            it.protein = base ? round1((mealProtein(cab) * grams) / base) : mealProtein(cab);
            changed = true;
          }
        }
        if (changed) {
          const vals = (day.items || []).map((x) => x.protein).filter((v) => v != null);
          if (vals.length) day.protein = Math.round(vals.reduce((a, b) => a + b, 0));
        }
      });
    }
  }
  state.seedV = 13;
  save();
}

/* שדרוג 14: נתוני תזונה מלאים — מוצרים חדשים עם מאקרו, 3 ארוחות, ותיעוד יום 16.9 */
if (state.seedV === 13) {
  for (const p of DEFAULT_PRODUCTS) if (!productById(p.id)) state.products.push(JSON.parse(JSON.stringify(p)));
  for (const m of DEFAULT_MEALS) if (!mealById(m.id)) state.meals.push(JSON.parse(JSON.stringify(m)));
  // עדכון ערכים למוצרים קיימים — רק אם עוד עומדים על ברירת המחדל הישנה
  const oats = productById("p-oats");
  if (oats && oats.protein100 === 13.5 && oats.cal100 === 389) {
    Object.assign(oats, { protein100: 13, cal100: 380, carb100: 66, fat100: 7, fiber100: 10 });
  }
  const powder = productById("p-powder");
  if (powder && powder.protein100 === 75 && powder.cal100 === 380) {
    Object.assign(powder, { protein100: 76, cal100: 390, carb100: 8, fat100: 4 });
  }
  // תיעוד יום רביעי 16.9.2026 — שלוש הארוחות שנאכלו + סיכום
  const week = state.weeks && state.weeks["2026-09-13"];
  if (week && week.days[3]) {
    const day = week.days[3];
    const mk = (mealId, label) => {
      const meal = mealById(mealId);
      const names = meal.items.map((x) => (productById(x.productId) || { name: "?" }).name).join(", ");
      return {
        id: newId("mi"), label, text: `${meal.name} (${names})`,
        mealId, protein: mealProtein(meal), eaten: true,
      };
    };
    day.items = [
      mk("m-shake-morning", "בוקר"),
      mk("m-hummus-lunch", "צהריים"),
      mk("m-lentil-patties", "ערב"),
    ];
    day.protein = Math.round(day.items.reduce((a, i) => a + i.protein, 0));
    day.notes = "נשארו 2 קציצות במקרר (תוקף 3-4 ימים, לא להקפיא מחדש); ~29 קציצות במקפיא. סה\"כ היום: ~2,362 קק\"ל, 133 ג' חלבון, 250 פחמ', 94.5 שומן, 46.5 סיבים";
  }
  state.seedV = 14;
  save();
}

/* שדרוג 15: תכנון גאנט — זריעת התוכנית ריצה 12 שבועות + אבני דרך */
if (!state.plan) state.plan = { nodes: [] };
if (state.seedV === 14) {
  const seedNodes = [
    { lane: "run", date: "2026-09-23", label: "אינטרוולים 3×3 Z4" },
    { lane: "run", date: "2026-09-30", label: "טמפו 15ד Z4" },
    { lane: "milestone", date: "2026-10-02", label: "🧪 מבחן 5K" },
    { lane: "milestone", date: "2026-11-08", label: "מתח: 7 מלאים" },
    { lane: "milestone", date: "2026-12-04", label: "🎯 10K סאב-60" },
  ];
  for (const n of seedNodes) {
    if (!state.plan.nodes.some((x) => x.date === n.date && x.label === n.label)) {
      state.plan.nodes.push({ id: newId("pl"), ...n });
    }
  }
  state.seedV = 15;
  save();
}

/* שדרוג 16: בנאי אימוני ריצה — זריעת 4 אימוני התוכנית (זהים לקבצי ה-FIT שנשלחו) */
if (!state.runWorkouts) state.runWorkouts = [];
if (state.seedV === 15) {
  const seeds = [
    { id: "rw-easy", name: "ריצה קלה Z2 — 30 דק׳", steps: [
      { kind: "warmup", dur: "time", val: 5, zone: 1 },
      { kind: "active", dur: "time", val: 30, zone: 2 },
      { kind: "cooldown", dur: "time", val: 5, zone: 1 },
    ]},
    { id: "rw-int33", name: "אינטרוולים 3×3 Z4", steps: [
      { kind: "warmup", dur: "time", val: 10, zone: 2 },
      { kind: "active", dur: "time", val: 3, zone: 4 },
      { kind: "rest", dur: "time", val: 2, zone: 1 },
      { kind: "repeat", from: 1, reps: 3 },
      { kind: "cooldown", dur: "time", val: 8, zone: 1 },
    ]},
    { id: "rw-tempo", name: "טמפו 15 דק׳ Z4", steps: [
      { kind: "warmup", dur: "time", val: 10, zone: 2 },
      { kind: "active", dur: "time", val: 15, zone: 4 },
      { kind: "cooldown", dur: "time", val: 8, zone: 1 },
    ]},
    { id: "rw-5k", name: "מבחן 5K", steps: [
      { kind: "warmup", dur: "time", val: 10, zone: 2 },
      { kind: "active", dur: "km", val: 5, zone: 0 },
      { kind: "cooldown", dur: "time", val: 5, zone: 1 },
    ]},
  ];
  for (const s of seeds) if (!state.runWorkouts.some((w) => w.id === s.id)) state.runWorkouts.push(s);
  state.seedV = 16;
  save();
}

/* שדרוג 17: דגשי טכניקה + חיפוש סרטון לכל תרגילי המאגר הקיימים */
if (state.seedV === 16) {
  if (Array.isArray(state.exercises)) {
    for (const ex of state.exercises) {
      const def = DEFAULT_EXLIB.find((d) => d.id === ex.id);
      if (def) {
        if (!ex.demoQuery) ex.demoQuery = def.demoQuery;
        if (!ex.cues) ex.cues = def.cues;
      }
    }
  }
  state.seedV = 17;
  save();
}

/* שדרוג 18: מירוץ העגור 10 ק"מ — 30.10, נעוץ כאבן דרך בתכנון */
if (state.seedV === 17) {
  if (!state.plan) state.plan = { nodes: [] };
  if (!state.plan.nodes.some((n) => n.id === "pl-agur-2026")) {
    state.plan.nodes.push({ id: "pl-agur-2026", date: "2026-10-30", lane: "milestone", label: "🏁 מירוץ העגור 10K" });
  }
  state.seedV = 18;
  save();
}

/* שדרוג 19: ריצה כתרגיל מן המניין (mode "run") — נכנסת לרשימת התרגילים של היום.
   w.run נשאר כמראה מסוכמת לגרפים, לגאנט ולהיסטוריה. */
if (state.seedV === 18) {
  if (Array.isArray(state.exercises) && !state.exercises.some((x) => x.id === "runx")) {
    const def = DEFAULT_EXLIB.find((d) => d.id === "runx");
    if (def) state.exercises.unshift(JSON.parse(JSON.stringify(def)));
  }
  const tRun = (state.workoutTemplates || []).find((t) => t.id === "t-run");
  if (tRun && !tRun.exerciseIds.includes("runx")) tRun.exerciseIds.unshift("runx");
  for (const [date, w] of Object.entries(state.workouts || {})) {
    const wd = fromIso(date).getDay();
    const ran = w.run && (w.run.km > 0 || w.run.minutes > 0);
    if (!Array.isArray(w.exList)) continue;
    if (ran && !w.exList.includes("runx")) {
      w.exList.unshift("runx");
      w.ex.runx = [{ km: w.run.km, minutes: w.run.minutes, done: true }];
    } else if (RUN_DAYS.includes(wd) && !w.exList.includes("runx")) {
      w.exList.unshift("runx");
      w.ex.runx = [{ km: 0, minutes: 0, done: false }];
    }
  }
  state.seedV = 19;
  save();
}

/* שדרוג 20: מילוי תוכנית הריצה בגאנט — 12 שבועות, 3 ריצות בשבוע, מקושרות
   לאימוני הבנאי: ב׳ קלה Z2 · ד׳ איכות (אינטרוולים/טמפו לסירוגין) · ו׳ קלה + ליבה.
   שבוע המירוץ (העגור 30.10) — טייפר. תאריכים עם צומת קיים לא נדרסים. */
if (state.seedV === 19) {
  if (!state.plan) state.plan = { nodes: [] };
  const base = new Date();
  base.setDate(base.getDate() - base.getDay()); // ראשון של השבוע הנוכחי
  const todayStr = iso(new Date());
  for (let week = 0; week < 12; week++) {
    for (const dow of [1, 3, 5]) {
      const d = new Date(base);
      d.setDate(base.getDate() + week * 7 + dow);
      const dateIso = iso(d);
      if (dateIso <= todayStr) continue;
      if (dateIso === "2026-10-30") continue; // יום מירוץ העגור — אבן הדרך כבר שם
      if (state.plan.nodes.some((n) => n.date === dateIso && (n.lane === "run" || n.lane === "milestone"))) continue; // לא דורסים צומת קיים או יום מבחן/מירוץ
      const raceWeek = dateIso >= "2026-10-25" && dateIso <= "2026-10-29";
      let node;
      if (raceWeek) {
        node = { runWorkoutId: "rw-easy", label: dow === 3 ? "טייפר — קלה קצרה" : "טייפר Z2" };
      } else if (dow === 1) {
        node = { runWorkoutId: "rw-easy", label: "קלה Z2" };
      } else if (dow === 3) {
        node = week % 2 === 0
          ? { runWorkoutId: "rw-int33", label: "אינטרוולים Z4" }
          : { runWorkoutId: "rw-tempo", label: "טמפו Z4" };
      } else {
        node = { runWorkoutId: "rw-easy", label: "קלה + ליבה" };
      }
      state.plan.nodes.push({ id: newId("pl"), date: dateIso, lane: "run", time: "07:00", ...node });
    }
  }
  state.seedV = 20;
  save();
}

/* שדרוג 21: צמתים אדומים לכל ימי הכוח + יעדי מתח + ריצות ימי מבחן/מירוץ.
   נקודה אפורה נשארת רק ליום מתוכנן שאין בו צומת (בעיקר בעבר). */
if (state.seedV === 20) {
  if (!state.plan) state.plan = { nodes: [] };
  if (!state.runWorkouts.some((w) => w.id === "rw-race10k")) {
    state.runWorkouts.push({ id: "rw-race10k", name: "מירוץ 10K", steps: [
      { kind: "warmup", dur: "time", val: 10, zone: 2 },
      { kind: "active", dur: "km", val: 10, zone: 0 },
      { kind: "cooldown", dur: "time", val: 5, zone: 1 },
    ]});
  }
  const base21 = new Date();
  base21.setDate(base21.getDate() - base21.getDay());
  const today21 = iso(new Date());
  for (let week = 0; week < 12; week++) {
    for (const dow of [0, 2, 4]) { // א'/ג'/ה' — כוח
      const d = new Date(base21);
      d.setDate(base21.getDate() + week * 7 + dow);
      const dateIso = iso(d);
      if (dateIso <= today21) continue;
      if (state.plan.nodes.some((n) => n.date === dateIso && n.lane === "strength")) continue;
      state.plan.nodes.push({ id: newId("pl"), date: dateIso, lane: "strength", templateId: "t-strength", label: "כוח + מתח", time: "07:00" });
    }
  }
  // ימי מבחן ומירוץ מקבלים גם צומת ריצה מקושר לבנאי (ל-FIT ולסדר היום)
  if (!state.plan.nodes.some((n) => n.lane === "run" && n.date === "2026-10-02")) {
    state.plan.nodes.push({ id: newId("pl"), date: "2026-10-02", lane: "run", runWorkoutId: "rw-5k", label: "מבחן 5K", time: "07:00" });
  }
  if (!state.plan.nodes.some((n) => n.lane === "run" && n.date === "2026-10-30")) {
    state.plan.nodes.push({ id: newId("pl"), date: "2026-10-30", lane: "run", runWorkoutId: "rw-race10k", label: "מירוץ העגור 10K", time: "07:00" });
  }
  // יעד ביניים לכוח: 5 מתח מלאים בדרך ל"מתח: 7 מלאים" (שכבר קיים ב-8.11)
  if (!state.plan.nodes.some((n) => n.lane === "milestone" && /5 מתח|מתח: 5/.test(n.label || ""))) {
    state.plan.nodes.push({ id: newId("pl"), date: "2026-10-15", lane: "milestone", label: "5 מתח מלאים" });
  }
  state.seedV = 21;
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
