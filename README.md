# Agenda Mover

A lightweight React + TypeScript web app for planning and adjusting daily agendas. Enter activities (with owner, slide number, duration, files, details, notes), set day start/end, and the app computes start/end times per activity. It supports drag-and-drop reordering across sections and auto-inserts breaks and lunch according to your settings.

## Features

- Sections (e.g., "Day 1: Morning", "Day 1: Afternoon")
- Activities with inline editing in a table format
- Day config: start/end time, break interval/duration, lunch target/duration
- Auto-calculated start/end times; auto-inserted Break/Lunch rows
- Drag and drop activities within and across sections

## Quick start

```powershell
npm install
npm run dev
```

Open the local URL printed by Vite (usually http://localhost:5173).

## Build

```powershell
npm run build
npm run preview
```

## Deployment (GitHub Pages)

- URL: https://kiki-lee.github.io/agenda_mover/
- Deploys: automatically on every push to `main` via GitHub Actions.
- Vite base: configured as `/agenda_mover/` in `vite.config.ts` for correct asset paths.

### How it works
- Workflow: see .github/workflows/deploy.yml — it builds the app and publishes the `dist` folder to GitHub Pages.
- First deployment can take 1–2 minutes after a push; check the Actions tab for status.

### Local tips
- Dev: `npm run dev` then visit http://localhost:5173/agenda_mover/
- Preview prod: `npm run build && npm run preview`

## Notes

- Break and Lunch rows are computed from settings and are not draggable. Change the break/lunch settings to see them move.
- If the plan exceeds end-of-day, an overflow indicator appears.
