"use strict";
import { PULLUP_TYPES, RUN_DAYS, STRENGTH_DAYS } from "../core/constants.js";
import { fromIso } from "../core/dates.js";
import { save, state } from "../core/state.js";

/* ---------- אימון ---------- */
export const exLibById = (id) => state.exercises.find((x) => x.id === id);
export const templateById = (id) => state.workoutTemplates.find((t) => t.id === id);

export function defaultSets(lib) {
  if (!lib) return [{ reps: 10 }];
  if (lib.mode === "run") return [{ km: 0, minutes: 0, done: false }];
  if (lib.mode === "weight") return Array.from({ length: 3 }, () => ({ reps: lib.defReps || 10, weight: lib.defWeight || 10 }));
  if (lib.mode === "reps") return Array.from({ length: 3 }, () => ({ reps: lib.defReps || 12, done: false }));
  if (lib.mode === "seconds") return Array.from({ length: 3 }, () => ({ secs: lib.defSecs || 30, done: false }));
  if (lib.mode === "pullup") return [
    { variant: PULLUP_TYPES[0], reps: 4 }, { variant: PULLUP_TYPES[1], reps: 7 }, { variant: PULLUP_TYPES[1], reps: 7 },
  ];
  return [{ reps: 10 }];
}

/* המשכיות פר-תרגיל: הסטים האחרונים של אותו תרגיל, מכל אימון קודם שהוא הופיע בו */
export function lastSetsFor(exId, beforeIso) {
  const keys = Object.keys(state.workouts).filter((k) => k < beforeIso).sort().reverse();
  for (const k of keys) {
    const w = state.workouts[k];
    if (w.ex && w.ex[exId] && w.ex[exId].length) return w.ex[exId];
  }
  return null;
}
export function freshSetsFor(exId, dateIso) {
  const prev = lastSetsFor(exId, dateIso);
  if (prev) return prev.map((s) => ({ ...s, done: false }));
  return defaultSets(exLibById(exId));
}
export function planNodeFor(dateIso) {
  return state.plan && state.plan.nodes.find((n) => n.date === dateIso && n.templateId);
}
export function dayTemplate(dateIso) {
  // צומת תכנון עם אימון מהמאגר גובר על ברירת המחדל של היום
  const node = planNodeFor(dateIso);
  if (node) {
    const tpl = templateById(node.templateId);
    if (tpl) return tpl;
  }
  const wd = fromIso(dateIso).getDay();
  return templateById(STRENGTH_DAYS.includes(wd) ? "t-strength" : "t-run") || state.workoutTemplates[0];
}

export function ensureWorkout(dateIso) {
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
export function lastWorkoutBefore(dateIso) {
  const keys = Object.keys(state.workouts).filter((k) => k < dateIso).sort();
  return keys.length ? state.workouts[keys[keys.length - 1]] : null;
}
export function lastStrengthWorkoutBefore(dateIso) {
  const keys = Object.keys(state.workouts)
    .filter((k) => k < dateIso && STRENGTH_DAYS.includes(fromIso(k).getDay()))
    .sort();
  return keys.length ? state.workouts[keys[keys.length - 1]] : null;
}
export function lastRunWorkoutBefore(dateIso) {
  const keys = Object.keys(state.workouts)
    .filter((k) => k < dateIso && RUN_DAYS.includes(fromIso(k).getDay()))
    .sort();
  return keys.length ? state.workouts[keys[keys.length - 1]] : null;
}

export function normalizeWorkout(w, dateIso) {
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
export function getWorkout(dateIso) {
  return normalizeWorkout(ensureWorkout(dateIso), dateIso);
}

export function rwkById(id) { return (state.runWorkouts || []).find((w) => w.id === id); }
