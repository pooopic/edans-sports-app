# CLAUDE.md — תמלילי

אפליקציית אנדרואיד native (Kotlin + Jetpack Compose) שמקליטה שיחות, מתמללת מקומית ומפיקה פריטי פעולה ל-Google.

- **לפני כל עבודה:** לקרוא `PROGRESS.md` (סטטוס, החלטות, מה נבדק במכשיר) ו-`docs/SPEC.md` (האפיון המלא).
- **בסוף כל שלב/סשן:** לעדכן `PROGRESS.md` (טבלת שלבים + יומן סשנים) ולעשות commit + push.
- עובדים בשלבים לפי סעיף 13 באפיון. לא מדלגים קדימה לפני שהשלב הקודם נבדק במכשיר.
- מכשיר יעד: Redmi Note 13 Pro 5G, HyperOS 3 Global, Android 16, 12GB RAM.
- בנייה: אין Android SDK בסביבת הענן — הבנייה נעשית ב-GitHub Actions (`.github/workflows/tamlili-android.yml`).
  אחרי push לבדוק שה-workflow ירוק; אם נכשל, לקרוא את הלוג ולתקן.
- כל הטקסטים בממשק בעברית; RTL כפוי ב-`TamliliTheme`; טקסט גדול (להשתמש בסגנונות של `MaterialTheme.typography`, לא בגדלים קטנים ידניים).
- הכל מקומי על המכשיר; ענן רק לשירותי Google של המשתמש (OAuth).
- package: `com.tamlili.app` · minSdk 30 · targetSdk 35 · compileSdk 36.
