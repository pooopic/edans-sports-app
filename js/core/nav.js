"use strict";
/* ניווט: 4 עצים, ובכל עץ תתי-מסכים.
   טלפון: סרגל תחתון של העצים + שורת לשוניות בראש המסך.
   מחשב (≥900px): אותו סרגל הופך לעמודת צד בימין (CSS בלבד). */
import { $, $$ } from "./ui.js";

export const TREES = [
  { id: "fitness", icon: "🏋️", label: "כושר", screens: [["workout", "אימונים"], ["progress", "התקדמות"]] },
  { id: "nutrition", icon: "🍽️", label: "תזונה", screens: [["menu", "תפריט"], ["food", "מזון וארוחות"], ["shopping", "קניות"]] },
  { id: "projects", icon: "📁", label: "פרויקטים", screens: [["projects", "פרויקטים"]] },
  { id: "gantt", icon: "🗓️", label: "גאנט", screens: [["plan", "גאנט"]] },
];
const SETTINGS = "settings";

const renderers = {};
const lastInTree = {}; // לחיצה על עץ חוזרת לתת-המסך האחרון שהיה פתוח בו
let current = null;

export function registerScreen(name, render) { renderers[name] = render; }

const treeOf = (screen) => TREES.find((t) => t.screens.some(([s]) => s === screen));

export function showScreen(name) {
  if (!$("#screen-" + name)) return;
  current = name;
  const tree = treeOf(name);
  if (tree) lastInTree[tree.id] = name;
  $$(".screen").forEach((s) => s.classList.add("hidden"));
  $("#screen-" + name).classList.remove("hidden");
  $$(".navbtn").forEach((b) => b.classList.toggle("active", tree ? b.dataset.tree === tree.id : b.dataset.tree === SETTINGS));
  renderSubtabs(tree);
  if (renderers[name]) renderers[name]();
}

function renderSubtabs(tree) {
  const bar = $("#subtabs");
  bar.innerHTML = "";
  const title = document.createElement("span");
  title.className = "subtabs-title";
  title.textContent = tree ? `${tree.icon} ${tree.label}` : "⚙️ הגדרות";
  bar.appendChild(title);
  if (tree && tree.screens.length > 1) {
    for (const [screen, label] of tree.screens) {
      const b = document.createElement("button");
      b.className = "subtab" + (screen === current ? " active" : "");
      b.textContent = label;
      b.addEventListener("click", () => showScreen(screen));
      bar.appendChild(b);
    }
  }
}

export function initNav(startScreen) {
  const nav = $("#treenav");
  nav.innerHTML = "";
  for (const t of TREES) {
    const b = document.createElement("button");
    b.className = "navbtn";
    b.dataset.tree = t.id;
    b.innerHTML = `<span>${t.icon}</span>${t.label}`;
    b.addEventListener("click", () => showScreen(lastInTree[t.id] || t.screens[0][0]));
    nav.appendChild(b);
  }
  const gear = document.createElement("button");
  gear.className = "navbtn navbtn-settings";
  gear.dataset.tree = SETTINGS;
  gear.title = "הגדרות, סנכרון וגיבוי";
  gear.innerHTML = "<span>⚙️</span>הגדרות";
  gear.addEventListener("click", () => showScreen(SETTINGS));
  nav.appendChild(gear);
  showScreen(startScreen);
}
