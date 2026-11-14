"use strict";

export const $ = (sel) => document.querySelector(sel);
export const $$ = (sel) => [...document.querySelectorAll(sel)];

export function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/* גרירה לשינוי סדר — עובד גם במגע (pointer events + touch-action:none על הידית).
   לא מזיזים את האלמנט בזמן הגרירה (זה מנתק את ה-pointer capture) — רק מסמנים
   קו יעד, ומבצעים את הסידור מחדש בשחרור. */
export function enableDrag(handle, block, wrap, onDrop) {
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

/* ---------- צלילים ---------- */
export let audioCtx = null;
export function beep(freq = 880, dur = 0.15) {
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
