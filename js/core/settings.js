"use strict";
/* מסך הגדרות: שעת אימון ברירת מחדל (משמשת את "סדר היום" בגאנט), סנכרון וגיבוי (ב-sync.js). */
import { registerScreen } from "./nav.js";
import { renderSyncBox } from "./sync.js";
import { save, state } from "./state.js";
import { $ } from "./ui.js";
import {
  gcalConnect, gcalConnected, gcalDeleteCalendar, gcalDisconnect, gcalNeedsAuth, gcalStatus, gcalSync,
  loadGis, onGcalStatus,
} from "./gcal.js";
import { DEFAULT_REMINDERS, reminderEditor } from "./reminders.js";

/* ---------- יומן גוגל ---------- */
function renderGcal() {
  const on = gcalConnected();
  $("#gcal-off").classList.toggle("hidden", on);
  $("#gcal-on").classList.toggle("hidden", !on);
  $("#gcal-reauth").classList.toggle("hidden", !gcalNeedsAuth());
  $("#gcal-sync").classList.toggle("hidden", gcalNeedsAuth());
  const st = gcalStatus();
  $("#gcal-status").textContent = st.text || (on ? (gcalNeedsAuth() ? "החיבור פג — לחץ \"התחבר מחדש\" כדי לעדכן את היומן" : "מחובר") : "");
  $("#gcal-status").style.color = st.error ? "var(--warn)" : "var(--muted)";
  if (on) {
    const cur = state.settings.gcalReminders || DEFAULT_REMINDERS;
    const store = (key) => (ed) => () => {
      state.settings.gcalReminders = { ...(state.settings.gcalReminders || DEFAULT_REMINDERS), [key]: ed.get() };
      save();
    };
    const timed = reminderEditor($("#gcal-rem-timed"), cur.timed, { isTimed: () => true, allowDefault: false });
    const allDay = reminderEditor($("#gcal-rem-allday"), cur.allDay, { isTimed: () => false, allowDefault: false });
    // שמירה בכל שינוי בעורך
    for (const [el, ed, key] of [["#gcal-rem-timed", timed, "timed"], ["#gcal-rem-allday", allDay, "allDay"]]) {
      $(el).oninput = store(key)(ed);
      $(el).onchange = store(key)(ed);
      $(el).onclick = (e) => { if (e.target.tagName === "BUTTON") setTimeout(store(key)(ed), 0); };
    }
  }
}
onGcalStatus(() => { if (!$("#screen-settings").classList.contains("hidden")) renderGcal(); });
$("#gcal-connect").addEventListener("click", async () => { await gcalConnect(); renderGcal(); });
$("#gcal-reauth").addEventListener("click", async () => { await gcalConnect(); renderGcal(); });
$("#gcal-sync").addEventListener("click", () => gcalSync(true));
$("#gcal-disconnect").addEventListener("click", () => {
  if (!confirm("לנתק את יומן גוגל? האירועים שכבר נוצרו יישארו ביומן \"המעקב של עדן\" (אפשר למחוק אותו בכפתור 🗑️).")) return;
  gcalDisconnect();
  renderGcal();
});
$("#gcal-delete").addEventListener("click", async () => {
  if (!confirm("למחוק מגוגל את היומן \"המעקב של עדן\" עם כל האירועים שהאפליקציה יצרה? היומן הראשי שלך לא מושפע.")) return;
  if (gcalNeedsAuth() && !(await gcalConnect())) return;
  await gcalDeleteCalendar();
  renderGcal();
});

$("#set-workout-time").addEventListener("input", () => { state.settings.workoutTime = $("#set-workout-time").value || "07:00"; save(); });
$("#set-workout-dur").addEventListener("input", () => { state.settings.workoutDur = parseInt($("#set-workout-dur").value, 10) || 45; save(); });

$("#set-active-limit").addEventListener("input", () => {
  state.settings.activeLimit = Math.max(0, parseInt($("#set-active-limit").value, 10) || 0);
  save();
});

function renderSettings() {
  $("#set-active-limit").value = state.settings.activeLimit || "";
  $("#set-workout-time").value = state.settings.workoutTime || "07:00";
  $("#set-workout-dur").value = state.settings.workoutDur || 45;
  renderSyncBox();
  renderGcal();
  loadGis().catch(() => {}); // טוענים מראש — כדי שהחלון הקופץ ייפתח מיד בלחיצה
}

registerScreen("settings", renderSettings);
