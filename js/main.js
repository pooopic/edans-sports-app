"use strict";
/* ============================================================
   המעקב של עדן — נקודת כניסה.
   סדר ה-import חשוב: state ← מיגרציות ← מסכים. כל מסך נרשם לניווט בעצמו.
   כל הנתונים נשמרים מקומית ב-localStorage (המפתח edan-tracker-v1).
   ============================================================ */
import "./core/state.js";
import "./core/migrations.js";
import "./core/sync.js";
import "./core/settings.js";
import "./nutrition/menu.js";
import "./nutrition/food.js";
import "./nutrition/shopping.js";
import "./fitness/workout.js";
import "./fitness/runbuilder.js";
import "./fitness/progress.js";
import "./projects/projects.js";
import "./gantt/plan.js";
import { initNav } from "./core/nav.js";

initNav("menu");

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").then((reg) => {
      reg.update();
      // חלון שנשאר פתוח (בעיקר במחשב) לא נטען מחדש ולכן לא בודק עדכונים —
      // בודקים בכל חזרה לאפליקציה ואחת לשעה; עדכון שנמצא מפעיל רענון אוטומטי דרך controllerchange
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") reg.update().catch(() => {});
      });
      setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000);
    }).catch(() => {});
  });
  // כשגרסה חדשה נטענה ברקע והשתלטה — רענון אוטומטי חד-פעמי כדי להציג אותה מיד
  let reloadedForUpdate = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloadedForUpdate) return;
    reloadedForUpdate = true;
    location.reload();
  });
}
