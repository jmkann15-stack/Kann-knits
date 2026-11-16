# Kann Knits

A cozy, offline-first Progressive Web App for knitting and needlepoint: projects, a row counter, a yarn stash, and a "Made with Love" family gallery. A Christmas gift; everything stays on the phone, with no accounts or backend.

**Stack:** Vite · React · TypeScript · Tailwind CSS v4 · Dexie (IndexedDB) · vite-plugin-pwa (Workbox)

```bash
npm install
npm run dev       # local dev server
npm run build     # type-check + production build into dist/
npm run preview   # serve the production build (service worker active)
npm run icons     # regenerate app icons from scripts/gen-icons.mjs
```

Deployment steps: see [DEPLOY.md](DEPLOY.md).

## Build status

| Phase | Scope | Status |
| --- | --- | --- |
| 1 | Scaffold, PWA (manifest, offline service worker, icons), theme, DB schema, tab bar, welcome + intro + install guide, Settings (family list, larger text, About), Cloudflare deploy config | ✅ Done |
| 2 | Projects (create/edit/delete, status filters, progress, cover + dated progress photos with client-side compression, pattern photo/PDF) + Row Counter (multiple named counters, row reminders, wake lock, haptics, instant saves) | ✅ Done |
| 3 | Stash (inventory, search/filter, reserve for project) + Made with Love gallery (per-person, stats) | ✅ Done |
| 4 | Backup export/restore (JSON, base64 photos), 60-day reminder, QA pass | ✅ Done |
| 5 | Design Grid (paint, eraser, undo, zoom/pan, text stamp, PNG export) | ✅ Done |

## Where to edit things

- **Gift message, family list, project types, yarn weights and fiber suggestions:** `src/config.ts`
- **Colors and fonts:** the `@theme` block in `src/index.css`
- **Icons:** `scripts/gen-icons.mjs`, then `npm run icons`

## Data model (IndexedDB via Dexie, `src/db.ts`)

All IDs are UUID strings so backups can be restored without collisions.

| Table | Key / indexes | Holds |
| --- | --- | --- |
| `projects` | `id`, status, madeFor, finishDate, updatedAt | Name, type, craft, status, pattern {name, source, detail, fileId}, materials {stashIds, yarnText, needleSize, meshCount, gauge}, madeFor, dates, notes, cover photo, progress (percent or rows done/total) |
| `files` | `id`, [ownerType+ownerId], ownerId | Photos and PDFs as Blobs (progress photos, pattern files, stash photos), with date, dimensions and a ~480px `thumb`. Photos are resized to 1600px / JPEG 0.8 before saving (patterns: 2400px). Stored apart from records so lists stay fast. |
| `counters` | `id`, projectId | Named row counters per project with `count`, ordering, and row reminders `{atRow, message, dismissed}`. Every new project gets a "Rows" counter; in "rows" progress mode, rows done = the first counter's count. Taps are written immediately with an atomic `modify`. |
| `stash` | `id`, weight, fiber, reservedForProjectId | Yarn/thread/canvas: name/brand, color, fiber, weight, quantity + unit, dye lot, location, notes, photo, reservation. Picking stash yarn in a project reserves it (if free); unpicking releases it; reserving from the stash side adds it to the project's materials. Deleting an item unlinks it from projects. |
| `designs` | `id`, projectId | Grid designs: cols × rows (up to 400 × 400), palette (index 0 = empty, up to 35 colors), cells (one base-36 char per cell, row by row). Optional `projectId` attaches it to a project. |
| `settings` | `key` | Key/value: onboarded, family, projectTypes, largerText, firstLaunchAt, lastBackupAt, storagePersisted, … |

## Design Grid (`src/screens/DesignEditor.tsx`)

Reached from the **Designs** button on Projects, or from a project's page.

- **Canvas:** draws only the visible squares, so big grids (a 200 × 20 belt, a 400 × 400 chart) stay fast. Graph-paper lines with every 10th line darker; a readout shows the row and square being painted.
- **Tools:** Paint (drag to paint a line), Erase, Move (one-finger pan), and Text. Two fingers always pinch-zoom and pan; if the first finger had already painted a square, that's undone. Zoom +/−/fit buttons for anyone who'd rather not pinch.
- **Undo/redo:** up to 60 steps (snapshots of the cells).
- **Text:** a built-in 7-row block font (`src/lib/blockFont.ts`: A–Z, 0–9, . , ! ? ' - + / & ♥) in Regular or Big (2×). Stamp it centered, or tap where it should start (with a live preview while the finger is down).
- **Colors:** 9 starter colors; change any color, add up to 35, or remove one (its squares are cleared, after a confirm).
- **Saving:** half a second after each change, and immediately when the app is hidden or the screen is left.
- **PNG export:** a chart with grid lines, about 3000px on its long side, via the Share sheet (iPhone: Save Image) or a download.

## Backup format (`src/lib/backup.ts`)

One file, `kann-knits-backup-YYYY-MM-DD.json`:

```json
{ "app": "kann-knits", "version": 1, "exportedAt": 1794625025559,
  "data": { "projects": [...], "counters": [...], "stash": [...], "designs": [...],
            "settings": { "family": [...], "projectTypes": [...], ... },
            "files": [{ "id": "...", "ownerType": "project", ..., "blob": { "mime": "image/jpeg", "base64": "..." }, "thumb": { ... } }] } }
```

- **Export** (Settings → Backup & restore) builds the file in pieces, then hands it to the Share sheet where the browser supports sharing files (iPhone: Save to Files, Mail, AirDrop), otherwise downloads it. Phone-specific settings (storage status, dismissed banners, snooze) aren't included.
- **Restore** merges, in one all-or-nothing transaction: nothing already on the phone is deleted; for projects, counters, stash and designs the record with the newer `updatedAt` wins (so an old backup can't roll back a row count); missing photos are added; family and project-type lists are combined. Files from a newer app version are refused with a friendly message.
- **Reminder:** a card on the Projects screen once it's been 60 days (`BACKUP_REMINDER_DAYS`) since the last backup (or first launch), only if there's data. "Later" hides it for 14 days.

## Notes

- On launch the app calls `navigator.storage.persist()` to reduce the chance of the OS evicting data.
- The service worker uses `autoUpdate`: new deploys install in the background and apply on next open.
- On iOS, the Home Screen app's storage is separate from Safari's, so the welcome flow runs again the first time it's opened from the Home Screen. That's intentional: the gift moment happens in the real app.
