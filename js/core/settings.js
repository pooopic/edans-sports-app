"use strict";
/* מסך הגדרות: שעת אימון ברירת מחדל (משמשת את "סדר היום" בגאנט), סנכרון וגיבוי (ב-sync.js). */
import { registerScreen } from "./nav.js";
import { renderSyncBox } from "./sync.js";
import { save, state } from "./state.js";
import { $ } from "./ui.js";

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
}

registerScreen("settings", renderSettings);
