# 🍳 Recipe Manager

A clean, mobile-friendly recipe manager built with **React + TypeScript + Vite + Tailwind CSS**. Browse a filterable recipe library, build an aggregated grocery list, and cook with a focused step-by-step view complete with countdown timers. Upload a recipe PDF and **Google Gemini's free tier** extracts it into structured data automatically — or add recipes by hand (with an optional "paste & parse" helper).

## Features

- **Repository** — searchable, filterable recipe library with responsive cards and a full recipe-detail modal.
- **Shopping** — grocery checklist grouped by category, with quantities auto-combined across recipes, source tags, a servings multiplier (1×/2×/3×), and a `12 items · 4 remaining` count badge. Remove an individual recipe's ingredients any time from the "From N recipes" chips.
- **Cook** — two-pane cooking view (ingredients + steps) with checkable items, a servings rescaler, per-step countdown timers (progress ring + audible alert), and a one-tap **Mark cooked** button that logs to your journal. Adding a recipe to the shopping list also queues it here.
- **Journal** — a cooking log: record the date you made each recipe, give it a star rating, and jot notes for next time. Add, edit, and delete entries; see your total cooks and average rating.
- **PDF extraction (free)** — upload a recipe PDF and it's sent to **Google Gemini** (`gemini-2.5-flash`, free tier) to be extracted into structured JSON. A single PDF can hold **one recipe or many** (e.g. a full cookbook) — every recipe found is extracted and added as its own card. **Long PDFs work too:** the app splits them into ~10-page sections in the browser (so each request's JSON output stays under the token budget), extracts each, and merges the results — showing "Reading section 3 of 12…" as it goes. If one section can't be read, it's skipped and reported rather than failing the whole import.
- **Manual entry** — an "Add manually" form lets you type in a recipe with add/remove ingredient and step rows. It also has a **"paste & parse"** box: paste a recipe copied from anywhere and Gemini fills in the fields for you to review and save. The form works fully by hand if you'd rather not use AI at all.
- **Offline-friendly** — all data lives in `localStorage` and a service worker caches the app shell, so your grocery list survives a refresh and a flaky in-store signal.
- **Mobile-first** — responsive down to 375px, 44px+ tap targets, no hover-only interactions.

## Local development

> Requires **Node.js 18+**.

```bash
cd recipe-manager
npm install

# Add your FREE Gemini API key for PDF extraction & paste-and-parse
cp .env.example .env.local
# then edit .env.local and set VITE_GEMINI_API_KEY
# (get a key at https://aistudio.google.com/apikey)

npm run dev
```

Open the printed `http://localhost:5173`. The app seeds 2–3 sample recipes on first load, so every section is demonstrable immediately — even without an API key. (The key is only needed for PDF upload and the "paste & parse" helper; manual entry by hand needs no key.)

### Available scripts

| Command           | What it does                          |
| ----------------- | ------------------------------------- |
| `npm run dev`     | Start the Vite dev server             |
| `npm run build`   | Type-check and build to `dist/`       |
| `npm run preview` | Preview the production build locally   |

## Deploying to Vercel

### 1. Push to a GitHub repo

```bash
cd recipe-manager
git init
git add .
git commit -m "Initial commit: Recipe Manager"
git branch -M main
git remote add origin https://github.com/<your-username>/recipe-manager.git
git push -u origin main
```

### 2. Connect to Vercel and set the environment variable

1. Go to [vercel.com/new](https://vercel.com/new) and import your GitHub repository.
2. Vercel auto-detects Vite — leave the defaults:
   - **Framework Preset:** Vite
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
   - **Root Directory:** `recipe-manager` (set this if the repo root is the parent folder)
3. Under **Settings → Environment Variables**, add:
   - **Name:** `VITE_GEMINI_API_KEY`
   - **Value:** your free Gemini API key from [aistudio.google.com/apikey](https://aistudio.google.com/apikey)
   - Apply to **Production**, **Preview**, and **Development**.

### 3. Deploy

Click **Deploy**. When it finishes, your app is live at a public Vercel URL (e.g. `https://recipe-manager-xyz.vercel.app`) accessible from any device — phone, tablet, or desktop.

The included `vercel.json` rewrites all routes to `index.html` so client-side navigation works on refresh.

## ⚠️ A note on the API key & security

This app reads `import.meta.env.VITE_GEMINI_API_KEY` and calls the Gemini API **directly from the browser**. Anything prefixed with `VITE_` is bundled into the client, so **the key is visible to anyone who uses the deployed site.** For a *free* key that's low-stakes — the worst case is someone using up your free daily quota, which you fix by regenerating the key in Google AI Studio. Fine for a personal/demo deployment.

For a hardened public deployment, move the API call behind a serverless function so the key stays on the server:

1. Create `api/extract.ts` (a [Vercel Serverless Function](https://vercel.com/docs/functions)) that reads `process.env.GEMINI_API_KEY` (no `VITE_` prefix) and forwards the request to Gemini.
2. Point `src/lib/extraction.ts` at `/api/extract` instead of `https://generativelanguage.googleapis.com/...` and drop the key from the URL.
3. Set `GEMINI_API_KEY` (server-only) in Vercel instead of `VITE_GEMINI_API_KEY`.

## Tech stack

- [Vite](https://vitejs.dev/) + [React 18](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Google Gemini API](https://ai.google.dev/) (free tier) for PDF & text recipe extraction
- `localStorage` + a service worker for persistence and offline support

## Project structure

```
recipe-manager/
├─ public/
│  ├─ sw.js                 # offline service worker (app-shell cache)
│  ├─ manifest.webmanifest
│  └─ favicon.svg
├─ src/
│  ├─ components/
│  │  ├─ repository/        # Repository, RecipeCard, RecipeDetailModal, PdfUpload, AddRecipeModal, Thumbnail
│  │  ├─ shopping/          # Shopping list
│  │  ├─ cook/              # Cook view + Timer
│  │  ├─ journal/           # Cooking journal + CookLogModal + StarRating
│  │  ├─ ui/                # Spinner, Toaster, icons
│  │  └─ NavBar.tsx
│  ├─ context/AppContext.tsx  # global state + localStorage persistence
│  ├─ data/                   # seed recipes + storage helpers
│  ├─ lib/                    # extraction.ts (Gemini client) + utilities
│  ├─ types.ts
│  ├─ App.tsx
│  └─ main.tsx
├─ vercel.json              # SPA routing
└─ .env.example
```
