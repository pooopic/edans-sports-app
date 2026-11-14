"use strict";
import { STORE_KEY } from "./constants.js";
import { todayIso } from "./dates.js";
import { onSave, save, state } from "./state.js";
import { $ } from "./ui.js";

/* ---------- גיבוי והעברה בין מכשירים ---------- */
$("#data-export").addEventListener("click", () => {
  // הטוקן של GitHub לא נכנס לקובץ הגיבוי — קובץ שנשלח/נשמר בענן לא חושף גישה לחשבון
  const payload = JSON.stringify({ app: "edan-tracker", exportedAt: new Date().toISOString(), state: stateWithoutToken() }, null, 1);
  const blob = new Blob([payload], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `edan-tracker-${todayIso()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
});
$("#data-import").addEventListener("click", () => $("#data-import-file").click());
$("#data-import-file").addEventListener("change", (e) => {
  const file = e.target.files && e.target.files[0];
  e.target.value = "";
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      const incoming = data.app === "edan-tracker" ? data.state : data;
      if (!incoming || (!incoming.weeks && !incoming.seedV)) throw new Error("not a backup");
      if (!confirm(`לייבא נתונים מ-${data.exportedAt ? data.exportedAt.slice(0, 10) : "קובץ"}? כל הנתונים במכשיר הזה יוחלפו.`)) return;
      // חיבור הסנכרון של המכשיר הזה נשמר, והנתונים המיובאים יידחפו למכשיר השני
      incoming.settings = incoming.settings || {};
      const cfg = syncCfg();
      if (cfg) { incoming.settings.sync = cfg; setSyncMeta({ ...syncMeta(), dirty: true }); }
      else delete incoming.settings.sync;
      localStorage.setItem(STORE_KEY, JSON.stringify(incoming));
      location.reload();
    } catch (err) {
      alert("הקובץ לא נראה כמו גיבוי של האפליקציה.");
    }
  };
  reader.readAsText(file);
});

/* ---------- סנכרון אוטומטי בין מכשירים (GitHub Gist פרטי) ----------
   ה"משתמש" הוא חשבון ה-GitHub הקיים: הנתונים נשמרים ב-Gist סודי בחשבון שלו,
   כל מכשיר מחובר עם אותו טוקן. פתיחת האפליקציה מושכת את הגרסה האחרונה,
   וכל שינוי נדחף אוטומטית (עם השהיה קצרה). הטוקן לא נכלל בנתונים שנדחפים.

   meta (במכשיר בלבד, edan-sync-meta):
   - lastSyncedAt: ה-changedAt של הגרסה האחרונה שהמכשיר הזה דחף או אימץ. גרסה מרוחקת
     "חדשה" אם ה-changedAt שלה שונה ממנו (השוואת שוויון — לא תלויה בשעונים של המכשירים).
   - dirty: יש כאן שינוי שעוד לא הגיע ל-Gist (דחיפה נכשלה / האפליקציה נסגרה לפני הדחיפה).
     כל עוד dirty — משיכה לא דורסת את הנתונים המקומיים, אלא דוחפת אותם. */
const SYNC_FILE = "edan-tracker.json";
const SYNC_META_KEY = "edan-sync-meta";
let syncPushTimer = null;
let syncBusy = false;
let syncReady = false; // דחיפות מתחילות רק אחרי המשיכה הראשונית — שלא נדרוס גרסה חדשה ממכשיר אחר
let lastLocalChange = 0;

export function syncCfg() { return (state.settings && state.settings.sync) || null; }
function syncMeta() {
  try { return JSON.parse(localStorage.getItem(SYNC_META_KEY)) || {}; } catch (e) { return {}; }
}
function setSyncMeta(m) { try { localStorage.setItem(SYNC_META_KEY, JSON.stringify(m)); } catch (e) {} }

function stateWithoutToken() {
  const clean = JSON.parse(JSON.stringify(state));
  if (clean.settings) delete clean.settings.sync; // הטוקן נשאר במכשיר בלבד
  return clean;
}

async function ghApi(path, opts = {}, token) {
  const res = await fetch("https://api.github.com" + path, {
    ...opts,
    headers: {
      Authorization: "Bearer " + token,
      Accept: "application/vnd.github+json",
      ...(opts.body ? { "Content-Type": "application/json" } : {}),
    },
  });
  if (!res.ok) throw new Error("GitHub " + res.status);
  return res.json();
}

function syncPayloadStr(changedAt) {
  return JSON.stringify({ app: "edan-tracker", changedAt, state: stateWithoutToken() });
}

function syncStatusMsg(text, isError) {
  const el = $("#sync-status");
  if (el) { el.textContent = text; el.style.color = isError ? "var(--danger, #e5484d)" : "var(--muted)"; }
}

/* נקרא אחרי כל save() */
function onLocalChange() {
  if (!syncReady || !syncCfg()) return;
  lastLocalChange = Date.now();
  const meta = syncMeta();
  if (!meta.dirty) setSyncMeta({ ...meta, dirty: true });
  queueSyncPush();
}
onSave(onLocalChange);

export function queueSyncPush() {
  if (!syncReady || !syncCfg()) return;
  clearTimeout(syncPushTimer);
  syncPushTimer = setTimeout(() => { syncPushTimer = null; syncPushNow(); }, 4000);
}

async function syncPushNow() {
  const cfg = syncCfg();
  if (!cfg) return;
  if (syncBusy) { queueSyncPush(); return; } // משיכה/דחיפה באמצע — מנסים שוב אחרי ההשהיה
  syncBusy = true;
  const startedAt = Date.now();
  try {
    const changedAt = Date.now();
    await ghApi("/gists/" + cfg.gistId, {
      method: "PATCH",
      body: JSON.stringify({ files: { [SYNC_FILE]: { content: syncPayloadStr(changedAt) } } }),
    }, cfg.token);
    // שינוי שנעשה בזמן הדחיפה עדיין לא נדחף — נשארים dirty והוא יידחף בתור
    const stillDirty = lastLocalChange > startedAt;
    setSyncMeta({ ...syncMeta(), lastSyncedAt: changedAt, dirty: stillDirty });
    syncStatusMsg("מסונכרן ✓ " + new Date(changedAt).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" }));
  } catch (e) {
    syncStatusMsg("שגיאת סנכרון: " + e.message + " — ינוסה שוב אוטומטית", true);
  }
  syncBusy = false;
}

function adoptRemoteState(remoteState) {
  const cfg = syncCfg();
  remoteState.settings = remoteState.settings || {};
  if (cfg) remoteState.settings.sync = cfg; // שומרים את חיבור הסנכרון של המכשיר הזה
  if (state.gcal && state.gcal.calendarId && !(remoteState.gcal && remoteState.gcal.calendarId)) {
    remoteState.gcal = { ...(remoteState.gcal || {}), calendarId: state.gcal.calendarId }; // וגם את חיבור יומן גוגל
  }
  localStorage.setItem(STORE_KEY, JSON.stringify(remoteState));
  location.reload();
}

async function syncPull(manual) {
  const cfg = syncCfg();
  if (!cfg || syncBusy) return;
  syncBusy = true;
  try {
    const gist = await ghApi("/gists/" + cfg.gistId, {}, cfg.token);
    const file = gist.files && gist.files[SYNC_FILE];
    const payload = file && JSON.parse(file.truncated ? await (await fetch(file.raw_url)).text() : file.content);
    syncBusy = false;
    const meta = syncMeta();
    if (!payload || !payload.state) { if (manual || meta.dirty) syncPushNow(); return; }
    if (meta.dirty || syncPushTimer) {
      // יש כאן שינויים שעוד לא נדחפו — הם מנצחים ונדחפים עכשיו (במקום להימחק במשיכה)
      syncPushNow();
      return;
    }
    // meta מגרסה קודמת (בלי dirty) — פעם אחת לפי הכלל הישן (חדש יותר = גדול יותר), כדי לא לאבד שינוי מקומי במעבר
    const remoteIsNew = meta.dirty === undefined
      ? payload.changedAt > (meta.lastSyncedAt || 0)
      : payload.changedAt !== meta.lastSyncedAt;
    if (meta.dirty === undefined) { meta.dirty = false; setSyncMeta(meta); }
    if (remoteIsNew) {
      // מכשיר אחר דחף גרסה מאז הסנכרון האחרון שלנו
      const localClean = JSON.parse(syncPayloadStr(0)).state;
      setSyncMeta({ ...meta, lastSyncedAt: payload.changedAt });
      if (JSON.stringify(localClean) === JSON.stringify(payload.state)) {
        syncStatusMsg("מסונכרן ✓"); // אותו תוכן בדיוק — בלי רענון מיותר
        return;
      }
      adoptRemoteState(payload.state);
    } else if (manual) {
      syncPushNow();
    } else {
      syncStatusMsg("מסונכרן ✓");
    }
  } catch (e) {
    syncBusy = false;
    syncStatusMsg("שגיאת סנכרון: " + e.message, true);
  }
}

async function syncConnect(token) {
  syncStatusMsg("מתחבר...");
  try {
    const gists = await ghApi("/gists?per_page=100", {}, token);
    let existing = gists.find((g) => g.files && g.files[SYNC_FILE]);
    if (existing) {
      const full = await ghApi("/gists/" + existing.id, {}, token);
      const file = full.files[SYNC_FILE];
      const payload = JSON.parse(file.truncated ? await (await fetch(file.raw_url)).text() : file.content);
      state.settings.sync = { token, gistId: existing.id };
      save();
      if (payload && payload.state && confirm(
        "נמצאו נתונים מסונכרנים מהמכשיר השני (עדכון אחרון: " +
        new Date(payload.changedAt).toLocaleString("he-IL") +
        ").\nלטעון אותם למכשיר הזה? (ביטול = הנתונים במכשיר הזה יידחפו במקום)")) {
        setSyncMeta({ lastSyncedAt: payload.changedAt, dirty: false });
        adoptRemoteState(payload.state);
        return;
      }
      await syncPushNow();
    } else {
      const created = await ghApi("/gists", {
        method: "POST",
        body: JSON.stringify({
          description: "המעקב של עידן — סנכרון בין מכשירים",
          public: false,
          files: { [SYNC_FILE]: { content: syncPayloadStr(Date.now()) } },
        }),
      }, token);
      state.settings.sync = { token, gistId: created.id };
      save();
      const pushed = JSON.parse(created.files[SYNC_FILE].content || "{}").changedAt;
      setSyncMeta({ lastSyncedAt: pushed || Date.now(), dirty: false });
    }
    renderSyncBox();
    syncStatusMsg("מחובר ✓ — הנתונים יסתנכרנו אוטומטית");
  } catch (e) {
    syncStatusMsg("החיבור נכשל: " + e.message + " — בדוק שהטוקן תקין ושיש לו הרשאת gist", true);
  }
}

export function renderSyncBox() {
  const connected = !!syncCfg();
  $("#sync-off").classList.toggle("hidden", connected);
  $("#sync-on").classList.toggle("hidden", !connected);
  if (connected) {
    const m = syncMeta();
    syncStatusMsg((m.lastSyncedAt ? "סנכרון אחרון: " + new Date(m.lastSyncedAt).toLocaleString("he-IL") : "מחובר") +
      (m.dirty ? " · יש שינויים שממתינים לדחיפה" : ""));
  }
}

$("#sync-connect").addEventListener("click", () => {
  const token = $("#sync-token").value.trim();
  if (!token) { alert("צריך להדביק טוקן של GitHub (עם הרשאת gist)."); return; }
  $("#sync-token").value = "";
  syncConnect(token);
});
$("#sync-now").addEventListener("click", () => syncPull(true));
$("#sync-disconnect").addEventListener("click", () => {
  if (!confirm("לנתק את הסנכרון במכשיר הזה? הנתונים יישארו, רק יפסיקו להתעדכן אוטומטית.")) return;
  delete state.settings.sync;
  save();
  renderSyncBox();
});
renderSyncBox();
if (syncCfg()) {
  syncPull(false).finally(() => { syncReady = true; });
} else {
  syncReady = true;
}
document.addEventListener("visibilitychange", () => {
  if (!syncCfg()) return;
  if (document.visibilityState === "visible") syncPull(false);
  else if (syncPushTimer) { clearTimeout(syncPushTimer); syncPushTimer = null; syncPushNow(); } // יוצאים מהאפליקציה — דוחפים מיד
});
window.addEventListener("online", () => { if (syncCfg() && syncMeta().dirty) syncPushNow(); });
