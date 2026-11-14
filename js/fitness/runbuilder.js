"use strict";
import { newId } from "../core/model.js";
import { save, state, view } from "../core/state.js";
import { $, enableDrag, escapeHtml } from "../core/ui.js";
import { defaultSets, exLibById, getWorkout, rwkById } from "./model.js";
import { renderWorkout } from "./workout.js";

/* ================== בנאי אימוני ריצה + ייצוא FIT לגרמין ================== */

export const HR_ZONES = () => (state.settings.hrZones || { 1: [93, 112], 2: [112, 130], 3: [130, 149], 4: [149, 167], 5: [167, 186] });
export const RWK_KINDS = { warmup: "חימום", active: "עבודה", rest: "התאוששות", cooldown: "שחרור" };
export const RWK_DURS = { time: "דקות", km: "ק״מ", open: "חופשי" };



export function rwkStepText(s, i) {
  if (s.kind === "repeat") return `חזרה על צעדים ${s.from + 1}–${i} ×${s.reps}`;
  const dur = s.dur === "open" ? "חופשי" : `${s.val} ${RWK_DURS[s.dur]}`;
  const tgt = s.zone ? `Z${s.zone} (${HR_ZONES()[s.zone][0]}–${HR_ZONES()[s.zone][1]})` : "חופשי";
  return `${RWK_KINDS[s.kind]} ${dur} @ ${tgt}`;
}

/* ---------- מקודד FIT (פורמט האימונים של Garmin) ---------- */
export const FIT_CRC_TABLE = [0x0000, 0xCC01, 0xD801, 0x1400, 0xF001, 0x3C00, 0x2800, 0xE401,
  0xA001, 0x6C00, 0x7800, 0xB401, 0x5000, 0x9C01, 0x8801, 0x4400];
export function fitCrc(bytes, crc = 0) {
  for (const b of bytes) {
    let tmp = FIT_CRC_TABLE[crc & 0xF];
    crc = (crc >> 4) & 0x0FFF;
    crc = crc ^ tmp ^ FIT_CRC_TABLE[b & 0xF];
    tmp = FIT_CRC_TABLE[crc & 0xF];
    crc = (crc >> 4) & 0x0FFF;
    crc = crc ^ tmp ^ FIT_CRC_TABLE[(b >> 4) & 0xF];
  }
  return crc;
}
export function buildRunFit(w) {
  const bytes = [];
  const u8 = (v) => bytes.push(v & 0xFF);
  const u16 = (v) => { bytes.push(v & 0xFF, (v >> 8) & 0xFF); };
  const u32 = (v) => { bytes.push(v & 0xFF, (v >>> 8) & 0xFF, (v >>> 16) & 0xFF, (v >>> 24) & 0xFF); };
  const str = (text, size) => {
    let enc = new TextEncoder().encode(text);
    if (enc.length > size - 1) {
      let end = size - 1;
      while (end > 0 && (enc[end] & 0xC0) === 0x80) end--; // לא חותכים תו UTF-8 באמצע
      enc = enc.slice(0, end);
    }
    for (const b of enc) u8(b);
    for (let i = enc.length; i < size; i++) u8(0);
  };
  const defn = (local, globalNum, fields) => {
    u8(0x40 | local); u8(0); u8(0); u16(globalNum); u8(fields.length);
    for (const [num, size, type] of fields) { u8(num); u8(size); u8(type); }
  };
  const INV = 0xFFFFFFFF;
  // file_id
  defn(0, 0, [[0, 1, 0x00], [1, 2, 0x84], [2, 2, 0x84], [3, 4, 0x8C], [4, 4, 0x86]]);
  u8(0); u8(5); u16(255); u16(0); u32(Date.now() % 0xFFFFFF + 1); u32(Math.floor(Date.now() / 1000) - 631065600);
  // workout
  defn(1, 26, [[8, 48, 0x07], [4, 1, 0x00], [6, 2, 0x84]]);
  u8(1); str(w.name, 48); u8(1); u16(w.steps.length);
  // steps
  defn(2, 27, [[254, 2, 0x84], [1, 1, 0x00], [2, 4, 0x86], [3, 1, 0x00], [4, 4, 0x86], [5, 4, 0x86], [6, 4, 0x86], [7, 1, 0x00]]);
  const INT = { warmup: 2, active: 0, rest: 1, cooldown: 3 };
  w.steps.forEach((s, i) => {
    u8(2); u16(i);
    if (s.kind === "repeat") {
      u8(6); u32(s.from); u8(0xFF); u32(s.reps); u32(INV); u32(INV); u8(0);
    } else {
      if (s.dur === "time") { u8(0); u32(Math.round(s.val * 60 * 1000)); }
      else if (s.dur === "km") { u8(1); u32(Math.round(s.val * 100000)); }
      else { u8(5); u32(0); }
      if (s.zone) {
        const [lo, hi] = HR_ZONES()[s.zone];
        u8(1); u32(0); u32(lo + 100); u32(hi + 100);
      } else {
        u8(2); u32(0); u32(INV); u32(INV);
      }
      u8(INT[s.kind] != null ? INT[s.kind] : 0);
    }
  });
  const body = new Uint8Array(bytes);
  // כותרת 14 בייט + CRC כותרת
  const header = new Uint8Array(14);
  const hv = new DataView(header.buffer);
  hv.setUint8(0, 14); hv.setUint8(1, 0x10); hv.setUint16(2, 2194, true); hv.setUint32(4, body.length, true);
  header.set(new TextEncoder().encode(".FIT"), 8);
  hv.setUint16(12, fitCrc(header.slice(0, 12)), true);
  const all = new Uint8Array(header.length + body.length + 2);
  all.set(header, 0);
  all.set(body, header.length);
  const crc = fitCrc(all.slice(0, header.length + body.length));
  new DataView(all.buffer).setUint16(header.length + body.length, crc, true);
  return all;
}
export function exportRunFit(w) {
  const blob = new Blob([buildRunFit(w)], { type: "application/octet-stream" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = w.name.replace(/[^\w֐-׿a-zA-Z0-9 -]/g, "").replace(/\s+/g, "-") + ".fit";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/* ---------- רשימת אימוני הריצה ---------- */
export function renderRunWorkouts() {
  const wrap = $("#rwk-list");
  wrap.innerHTML = "";
  for (const w of state.runWorkouts || []) {
    const row = document.createElement("div");
    row.className = "food-item";
    const summary = w.steps.map((s, i) => rwkStepText(s, i)).join(" ← ");
    const body = document.createElement("div");
    body.style.flex = "1";
    body.innerHTML = `<div class="food-item-name">${escapeHtml(w.name)}</div><div class="rwk-summary">${escapeHtml(summary)}</div>`;
    body.addEventListener("click", () => openRwkEditor(w.id));
    const todayBtn = document.createElement("button");
    todayBtn.className = "btn small ghost";
    todayBtn.textContent = "➕ ליום";
    todayBtn.title = "שבץ את האימון הזה ברישום של היום המוצג";
    todayBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const day = getWorkout(view.workoutDate);
      if (!day.exList.includes("runx")) {
        day.exList.unshift("runx");
        if (!day.ex.runx) day.ex.runx = defaultSets(exLibById("runx"));
      }
      day.runPlanName = w.name;
      save();
      renderWorkout();
      const blockEl = document.querySelector('#day-ex-list .exercise[data-ex-id="runx"], #day-ex-list .exercise');
      if (blockEl) blockEl.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    const exportBtn = document.createElement("button");
    exportBtn.className = "btn small";
    exportBtn.textContent = "⬇️ FIT";
    exportBtn.addEventListener("click", (e) => { e.stopPropagation(); exportRunFit(w); });
    row.append(body, todayBtn, exportBtn);
    wrap.appendChild(row);
  }
}

/* ---------- עורך אימון ריצה ---------- */
export let editingRwk = null;
export function openRwkEditor(id) {
  const existing = id ? rwkById(id) : null;
  editingRwk = existing
    ? JSON.parse(JSON.stringify(existing))
    : { id: null, name: "", steps: [{ kind: "warmup", dur: "time", val: 10, zone: 2 }] };
  $("#rwk-title").textContent = existing ? `עריכת ${existing.name}` : "אימון ריצה חדש";
  $("#rwk-name").value = editingRwk.name;
  $("#rwk-delete").classList.toggle("hidden", !existing);
  renderRwkSteps();
  $("#rwk-modal").classList.remove("hidden");
}
export function renderRwkSteps() {
  const wrap = $("#rwk-steps");
  wrap.innerHTML = "";
  editingRwk.steps.forEach((s, i) => {
    if (!s._id) s._id = newId("st");
    const row = document.createElement("div");
    row.className = "rwk-step";
    row.dataset.itemId = s._id;
    const handle = document.createElement("span");
    handle.className = "drag-handle";
    handle.textContent = "≡";
    const num = document.createElement("span");
    num.className = "rwk-step-num";
    num.textContent = i + 1;
    row.append(handle, num);

    const mkSel = (options, value, onChange) => {
      const sel = document.createElement("select");
      for (const [v, label] of options) {
        const opt = document.createElement("option");
        opt.value = v; opt.textContent = label;
        if (String(value) === String(v)) opt.selected = true;
        sel.appendChild(opt);
      }
      sel.addEventListener("change", () => onChange(sel.value));
      return sel;
    };
    const mkNum = (value, onChange, step) => {
      const inp = document.createElement("input");
      inp.type = "number"; inp.min = 0; inp.step = step || 1; inp.inputMode = "decimal"; inp.value = value;
      inp.addEventListener("input", () => onChange(parseFloat(inp.value) || 0));
      return inp;
    };

    if (s.kind === "repeat") {
      row.appendChild(document.createTextNode("🔁 חזור מצעד"));
      row.appendChild(mkNum(s.from + 1, (v) => { s.from = Math.max(0, Math.round(v) - 1); }));
      row.appendChild(document.createTextNode("×"));
      row.appendChild(mkNum(s.reps, (v) => { s.reps = Math.max(1, Math.round(v)); }));
    } else {
      row.appendChild(mkSel(Object.entries(RWK_KINDS), s.kind, (v) => { s.kind = v; }));
      row.appendChild(mkSel(Object.entries(RWK_DURS), s.dur, (v) => { s.dur = v; renderRwkSteps(); }));
      if (s.dur !== "open") row.appendChild(mkNum(s.val, (v) => { s.val = v; }, s.dur === "km" ? 0.5 : 1));
      row.appendChild(mkSel(
        [["0", "ללא יעד"], ["1", "Z1"], ["2", "Z2"], ["3", "Z3"], ["4", "Z4"], ["5", "Z5"]],
        s.zone || 0, (v) => { s.zone = parseInt(v, 10) || 0; }
      ));
    }
    const del = document.createElement("button");
    del.className = "del-set";
    del.textContent = "✕";
    del.addEventListener("click", () => { editingRwk.steps.splice(i, 1); renderRwkSteps(); });
    row.appendChild(del);

    enableDrag(handle, row, wrap, (orderIds) => {
      editingRwk.steps.sort((a, b) => orderIds.indexOf(a._id) - orderIds.indexOf(b._id));
      renderRwkSteps();
    });
    wrap.appendChild(row);
  });
}
$("#rwk-add").addEventListener("click", () => openRwkEditor(null));
$("#rwk-step-add").addEventListener("click", () => {
  editingRwk.steps.push({ kind: "active", dur: "time", val: 3, zone: 4 });
  renderRwkSteps();
});
$("#rwk-repeat-add").addEventListener("click", () => {
  editingRwk.steps.push({ kind: "repeat", from: Math.max(0, editingRwk.steps.length - 2), reps: 3 });
  renderRwkSteps();
});
$("#rwk-cancel").addEventListener("click", () => $("#rwk-modal").classList.add("hidden"));
$("#rwk-delete").addEventListener("click", () => {
  if (!confirm("למחוק את האימון?")) return;
  state.runWorkouts = state.runWorkouts.filter((w) => w.id !== editingRwk.id);
  save();
  $("#rwk-modal").classList.add("hidden");
  renderRunWorkouts();
});
$("#rwk-save").addEventListener("click", () => {
  editingRwk.name = $("#rwk-name").value.trim();
  if (!editingRwk.name) { alert("חסר שם לאימון."); return; }
  if (!editingRwk.steps.length) { alert("אין צעדים באימון."); return; }
  editingRwk.steps.forEach((s) => delete s._id);
  if (!editingRwk.id) editingRwk.id = newId("rw");
  const idx = state.runWorkouts.findIndex((w) => w.id === editingRwk.id);
  if (idx >= 0) state.runWorkouts[idx] = editingRwk; else state.runWorkouts.push(editingRwk);
  save();
  $("#rwk-modal").classList.add("hidden");
  renderRunWorkouts();
});
