"use strict";
/* חיבור ליומן גוגל.
   כתיבה: רק ליומן נפרד שהאפליקציה יוצרת ("המעקב של עידן"). ההרשאה calendar.app.created
   מאפשרת לגעת רק ביומנים שהאפליקציה יצרה — אין גישת כתיבה ליומן הראשי.
   קריאה: אירועי היומן הראשי מוצגים בגאנט כשכבה אפורה (calendar.events.readonly).

   סנכרון = התאמה מלאה (reconcile), בלי טבלת מיפוי מקומית:
   כל אירוע שהאפליקציה יוצרת מסומן ב-extendedProperties.private.edanKey (מקור: t:<מטלה> / n:<צומת>)
   וב-h (hash של התוכן). בכל סנכרון: מושכים את אירועי היומן של האפליקציה, משווים למה שהאפליקציה
   רוצה שיהיה, ויוצרים / מעדכנים / מוחקים. כך אין אירועים יתומים ואין סדרות אינסופיות,
   וכפילות (למשל משני מכשירים) נמחקת לבד בסנכרון הבא. אירוע בלי edanKey לא נוגעים בו.

   הטוקן (שעה) נשמר רק במכשיר (localStorage), לא ב-state ולא ב-Gist. כשפג — מבקשים
   התחברות מחדש בלחיצה (דפדפנים חוסמים חלון קופץ שלא נפתח מלחיצה). */
import { addDays, fromIso, iso, todayIso } from "./dates.js";
import { onSave, save, state } from "./state.js";
import { resolveReminders } from "./reminders.js";

export const GCAL_CLIENT_ID = "866743160010-lvu8uirnda8v9uhgunh8jgqh9bbnjbf4.apps.googleusercontent.com";
// calendarlist.readonly: רק כדי למצוא את היומן של האפליקציה אם המזהה שלו אבד (במקום ליצור יומן שני)
const SCOPES = "https://www.googleapis.com/auth/calendar.app.created https://www.googleapis.com/auth/calendar.events.readonly https://www.googleapis.com/auth/calendar.calendarlist.readonly";
const CAL_MARK = "נוצר ומנוהל על ידי המעקב של עידן";
const OLD_CAL_NAME = "המעקב של עדן"; // שם קודם (שגיאת כתיב) — יומן כזה מזוהה ומקבל את השם הנכון
const OLD_CAL_MARK = "נוצר ומנוהל על ידי המעקב של עדן";
const API = "https://www.googleapis.com/calendar/v3";
const TZ = "Asia/Jerusalem";
const CAL_NAME = "המעקב של עידן";
const TOKEN_KEY = "edan-gcal-token";
const META_KEY = "edan-gcal-meta";
const PAST_DAYS = 30; // אירועים שעברו לפני יותר מזה — לא נוגעים בהם
const ROUTINE_ID = "proj-routine";

/* ---------- מצב ---------- */
const listeners = [];
export function onGcalStatus(fn) { listeners.push(fn); }
let status = { text: "", error: false, busy: false };
function setStatus(text, error = false) {
  status = { ...status, text, error };
  writeJson(META_KEY, { ...readJson(META_KEY), lastStatus: { text, error, at: Date.now() } }); // נשאר גם אחרי רענון
  for (const fn of listeners) { try { fn(status); } catch (e) {} }
}
export const gcalStatus = () => (status.text ? status : (readJson(META_KEY).lastStatus || status));

/* מזהה היומן נשמר גם ב-state (משותף למכשירים דרך ה-Gist) וגם במכשיר עצמו —
   כדי שסנכרון ממכשיר אחר (שעוד לא מכיר את היומן) לא ינתק את החיבור */
const LOCAL_CAL_KEY = "edan-gcal-calendar";
function calendarId() {
  if (state.gcal && state.gcal.calendarId) return state.gcal.calendarId;
  try { return localStorage.getItem(LOCAL_CAL_KEY) || null; } catch (e) { return null; }
}
function setCalendarId(id) {
  state.gcal = { ...(state.gcal || {}) };
  if (id) state.gcal.calendarId = id; else delete state.gcal.calendarId;
  try { id ? localStorage.setItem(LOCAL_CAL_KEY, id) : localStorage.removeItem(LOCAL_CAL_KEY); } catch (e) {}
  save();
}
export const gcalConnected = () => !!calendarId();
function readJson(key) { try { return JSON.parse(localStorage.getItem(key)) || {}; } catch (e) { return {}; } }
function writeJson(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch (e) {} }
function validToken() {
  const t = readJson(TOKEN_KEY);
  return t.token && t.exp > Date.now() + 60000 ? t.token : null;
}
export const gcalNeedsAuth = () => gcalConnected() && !validToken();
export const gcalMeta = () => readJson(META_KEY);

/* ---------- Google Identity Services ---------- */
let gisPromise = null;
export function loadGis() {
  if (window.google && window.google.accounts && window.google.accounts.oauth2) return Promise.resolve();
  if (!gisPromise) {
    gisPromise = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://accounts.google.com/gsi/client";
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => { gisPromise = null; reject(new Error("לא הצלחתי לטעון את ההתחברות של גוגל (אין רשת?)")); };
      document.head.appendChild(s);
    });
  }
  return gisPromise;
}
let tokenClient = null;
function requestToken() {
  return new Promise((resolve, reject) => {
    if (!tokenClient) {
      tokenClient = window.google.accounts.oauth2.initTokenClient({ client_id: GCAL_CLIENT_ID, scope: SCOPES, callback: () => {} });
    }
    tokenClient.callback = (resp) => {
      if (resp.error) { reject(new Error(resp.error_description || resp.error)); return; }
      writeJson(TOKEN_KEY, { token: resp.access_token, exp: Date.now() + (resp.expires_in || 3600) * 1000 });
      resolve(resp.access_token);
    };
    tokenClient.error_callback = (err) => reject(new Error(err && err.type === "popup_closed" ? "חלון ההתחברות נסגר" : "ההתחברות נכשלה"));
    tokenClient.requestAccessToken({ prompt: gcalConnected() ? "" : "consent" });
  });
}

/* ---------- API ---------- */
class NeedAuth extends Error {}
async function api(path, opts = {}) {
  const token = validToken();
  if (!token) throw new NeedAuth("צריך להתחבר מחדש");
  const res = await fetch(API + path, {
    ...opts,
    headers: { Authorization: "Bearer " + token, ...(opts.body ? { "Content-Type": "application/json" } : {}) },
  });
  if (res.status === 401) { writeJson(TOKEN_KEY, {}); throw new NeedAuth("צריך להתחבר מחדש"); }
  if (res.status === 204) return null;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const err = new Error((data && data.error && data.error.message) || "Google " + res.status);
    err.status = res.status;
    throw err;
  }
  return data;
}

/* יומן שנוצר בשם הישן — משנים לשם הנכון (פעם אחת) */
async function fixOldName(id) {
  const meta = readJson(META_KEY);
  if (meta.renamed === id) return;
  try {
    const cal = await api("/calendars/" + encodeURIComponent(id));
    if (cal.summary === OLD_CAL_NAME || (cal.description || "").startsWith(OLD_CAL_MARK)) {
      await api("/calendars/" + encodeURIComponent(id), {
        method: "PATCH",
        body: JSON.stringify({ summary: CAL_NAME, description: CAL_MARK + ". שינויים — באפליקציה." }),
      });
    }
    writeJson(META_KEY, { ...readJson(META_KEY), renamed: id });
  } catch (e) { /* לא קריטי */ }
}
async function ensureCalendar() {
  const known = calendarId();
  if (known) {
    try {
      await api("/calendars/" + encodeURIComponent(known));
      if (!(state.gcal && state.gcal.calendarId === known)) setCalendarId(known); // משלים ב-state אם חסר
      await fixOldName(known);
      return;
    } catch (e) {
      if (e.status !== 404 && e.status !== 403) throw e; // היומן נמחק בגוגל — מחפשים / יוצרים
    }
  }
  // יומן שהאפליקציה כבר יצרה (למשל כשהחיבור נקטע באמצע) — משתמשים בו, לא יוצרים שני
  try {
    const list = await api("/users/me/calendarList?minAccessRole=owner&maxResults=250");
    const isMine = (c) => [CAL_MARK, OLD_CAL_MARK].some((m) => (c.description || "").startsWith(m)) && [CAL_NAME, OLD_CAL_NAME].includes(c.summary);
    const mine = (list.items || []).find(isMine);
    if (mine) {
      await api("/calendars/" + encodeURIComponent(mine.id)); // מוודא שיש לנו גישה אליו
      setCalendarId(mine.id);
      await fixOldName(mine.id);
      return;
    }
  } catch (e) {
    if (e instanceof NeedAuth) throw e; // בלי הרשאת רשימה — ממשיכים ליצירה
  }
  const cal = await api("/calendars", {
    method: "POST",
    body: JSON.stringify({ summary: CAL_NAME, timeZone: TZ, description: CAL_MARK + ". שינויים — באפליקציה." }),
  });
  setCalendarId(cal.id);
}

/* ---------- מה צריך להיות ביומן ---------- */
function timeFields(date, time, durMin) {
  if (!time) return { start: { date }, end: { date: addDays(date, 1) } };
  const [h, m] = time.split(":").map(Number);
  const d = fromIso(date);
  d.setHours(h, m + (durMin || 60), 0, 0);
  const end = `${iso(d)}T${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:00`;
  return { start: { dateTime: `${date}T${time}:00`, timeZone: TZ }, end: { dateTime: end, timeZone: TZ } };
}
function hashOf(obj) {
  const s = JSON.stringify(obj);
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}
const WORKOUT_LANES = { strength: "💪", run: "🏃" };

export function desiredEvents() {
  const from = addDays(todayIso(), -PAST_DAYS);
  const out = {};
  const add = (key, body) => {
    const h = hashOf(body);
    out[key] = { ...body, extendedProperties: { private: { edanKey: key, h } } };
  };
  for (const t of state.tasks || []) {
    if (!t.date || t.done || t.date < from) continue;
    const proj = (state.projects || []).find((p) => p.id === t.projectId);
    if (!proj || proj.status === "dropped") continue;
    const routine = proj.id === ROUTINE_ID;
    add("t:" + t.id, {
      summary: (routine ? "🔁 " : "📁 ") + t.title + (routine ? "" : ` · ${proj.name}`),
      description: (routine ? "שוטף" : `פרויקט: ${proj.name}`) + "\nמהמעקב של עידן — עריכה באפליקציה.",
      ...timeFields(t.date, t.time, t.duration),
      reminders: { useDefault: false, overrides: resolveReminders(t.reminders, !!t.time).map((minutes) => ({ method: "popup", minutes })) },
    });
  }
  const s = state.settings || {};
  for (const n of (state.plan && state.plan.nodes) || []) {
    if (!WORKOUT_LANES[n.lane] || !n.date || n.date < from) continue;
    add("n:" + n.id, {
      summary: `${WORKOUT_LANES[n.lane]} ${n.label}`,
      description: "אימון מהתכנון במעקב של עידן — עריכה באפליקציה.",
      ...timeFields(n.date, n.time || s.workoutTime || "07:00", s.workoutDur || 45),
      reminders: { useDefault: false, overrides: resolveReminders(n.reminders, true).map((minutes) => ({ method: "popup", minutes })) },
    });
  }
  return out;
}

/* ---------- סנכרון ---------- */
let syncTimer = null;
let syncing = false;
let again = false;

export async function gcalSync(force) {
  if (!gcalConnected()) return;
  if (!validToken()) { setStatus("החיבור ליומן פג — לחץ \"התחבר מחדש\" כדי לעדכן את היומן", true); return; }
  if (syncing) { again = true; return; }
  const want = desiredEvents();
  const wantHash = hashOf(Object.keys(want).sort().map((k) => k + want[k].extendedProperties.private.h));
  const meta = gcalMeta();
  if (!force && meta.wantHash === wantHash && meta.calendarId === calendarId()) return; // שום דבר לא השתנה
  syncing = true;
  setStatus("מעדכן את היומן...");
  try {
    await ensureCalendar();
    const cal = encodeURIComponent(calendarId());
    const timeMin = new Date(fromIso(addDays(todayIso(), -PAST_DAYS))).toISOString();
    const have = {};
    let pageToken = "";
    do {
      const q = `?maxResults=2500&showDeleted=false&timeMin=${encodeURIComponent(timeMin)}` + (pageToken ? `&pageToken=${pageToken}` : "");
      const page = await api(`/calendars/${cal}/events${q}`);
      for (const ev of page.items || []) {
        const key = ev.extendedProperties && ev.extendedProperties.private && ev.extendedProperties.private.edanKey;
        if (key) (have[key] = have[key] || []).push(ev);
      }
      pageToken = page.nextPageToken || "";
    } while (pageToken);
    let created = 0, updated = 0, removed = 0;
    for (const [key, body] of Object.entries(want)) {
      const list = have[key] || [];
      const [first, ...dups] = list;
      if (!first) {
        await api(`/calendars/${cal}/events`, { method: "POST", body: JSON.stringify(body) });
        created++;
      } else if (first.extendedProperties.private.h !== body.extendedProperties.private.h) {
        await api(`/calendars/${cal}/events/${encodeURIComponent(first.id)}`, { method: "PUT", body: JSON.stringify(body) });
        updated++;
      }
      for (const d of dups) { await api(`/calendars/${cal}/events/${encodeURIComponent(d.id)}`, { method: "DELETE" }); removed++; }
    }
    for (const [key, list] of Object.entries(have)) {
      if (want[key]) continue;
      for (const ev of list) { await api(`/calendars/${cal}/events/${encodeURIComponent(ev.id)}`, { method: "DELETE" }); removed++; }
    }
    writeJson(META_KEY, { ...readJson(META_KEY), wantHash, calendarId: calendarId(), lastSync: Date.now() });
    const changes = created + updated + removed;
    setStatus(`היומן מעודכן ✓ ${new Date().toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })}` +
      (changes ? ` (${created} חדשים · ${updated} עודכנו · ${removed} נמחקו)` : ""));
  } catch (e) {
    setStatus((e instanceof NeedAuth ? "החיבור ליומן פג — לחץ \"התחבר מחדש\"" : "שגיאה ביומן: " + e.message), true);
  }
  syncing = false;
  if (again) { again = false; gcalSync(); }
}

onSave(() => {
  if (!gcalConnected() || !validToken()) return;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => gcalSync(), 3000);
});

/* ---------- חיבור / ניתוק (מלחיצה) ---------- */
export async function gcalConnect() {
  // בזמן ההתחברות אסור לרענן את הדף (עדכון גרסה ברקע) — זה מה שקטע חיבור באמצע
  document.documentElement.dataset.busy = "gcal";
  try {
    setStatus("מתחבר לגוגל...");
    await loadGis();
    await requestToken();
    setStatus("מחובר — מכין את היומן...");
    await ensureCalendar();
    await gcalSync(true);
    return true;
  } catch (e) {
    setStatus("ההתחברות ליומן נכשלה: " + e.message, true);
    return false;
  } finally {
    delete document.documentElement.dataset.busy;
  }
}
export function gcalDisconnect() {
  const t = validToken();
  if (t && window.google && window.google.accounts) { try { window.google.accounts.oauth2.revoke(t, () => {}); } catch (e) {} }
  writeJson(TOKEN_KEY, {});
  writeJson(META_KEY, {});
  setCalendarId(null);
  readCache.clear();
  setStatus("היומן נותק. האירועים שכבר נוצרו נשארו ביומן \"" + CAL_NAME + "\" בגוגל.");
}
/* מחיקת היומן של האפליקציה מגוגל — כל האירועים שלה נעלמים בבת אחת */
export async function gcalDeleteCalendar() {
  try {
    await api("/calendars/" + encodeURIComponent(calendarId()), { method: "DELETE" });
    writeJson(META_KEY, {});
    setCalendarId(null);
    setStatus("היומן \"" + CAL_NAME + "\" נמחק מגוגל עם כל האירועים שלו.");
    return true;
  } catch (e) {
    setStatus("מחיקת היומן נכשלה: " + e.message, true);
    return false;
  }
}

/* ---------- קריאה: היומן הראשי כשכבה אפורה ---------- */
const readCache = new Map(); // "from|to" → { at, events }
export function primaryEventsCached(from, to) {
  const c = readCache.get(from + "|" + to);
  return c ? c.events : null;
}
export async function fetchPrimaryEvents(from, to) {
  if (!gcalConnected() || !validToken()) return null;
  const key = from + "|" + to;
  const c = readCache.get(key);
  if (c && Date.now() - c.at < 5 * 60000) return c.events;
  const timeMin = new Date(fromIso(from)).toISOString();
  const timeMax = new Date(fromIso(addDays(to, 1))).toISOString();
  try {
    const data = await api(`/calendars/primary/events?singleEvents=true&orderBy=startTime&maxResults=250&timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}`);
    const events = [];
    for (const ev of data.items || []) {
      if (ev.status === "cancelled") continue;
      const title = ev.summary || "(ללא כותרת)";
      if (ev.start.date) {
        // כל היום (אולי כמה ימים) — מופע לכל יום בטווח
        for (let d = ev.start.date; d < ev.end.date; d = addDays(d, 1)) {
          if (d >= from && d <= to) events.push({ date: d, time: "", title, link: ev.htmlLink });
        }
      } else {
        const st = new Date(ev.start.dateTime);
        events.push({ date: iso(st), time: `${String(st.getHours()).padStart(2, "0")}:${String(st.getMinutes()).padStart(2, "0")}`, title, link: ev.htmlLink });
      }
    }
    readCache.set(key, { at: Date.now(), events });
    return events;
  } catch (e) {
    return null;
  }
}

/* בפתיחה: אם יש טוקן בתוקף — סנכרון שקט (תופס שינויים ממכשיר אחר) */
if (gcalConnected() && validToken()) setTimeout(() => gcalSync(), 1500);
