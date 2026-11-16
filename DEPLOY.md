# Deploying Kann Knits (for Jake)

Same setup as Kann Smoke Co.: a static site hosted free on **Cloudflare Workers** (static assets only, no server code), built from the private GitHub repo `jmkann15-stack/Kann-knits`. Every `git push` to `main` redeploys it. The live URL will be `https://kann-knits.jmkann15.workers.dev`.

## Before you deploy

1. The gift note is in `src/config.ts` (`GIFT_MESSAGE`).
2. Make sure it builds:
   ```bash
   npm install
   npm run build
   ```

## One-time setup

1. Create an empty **private** repo on GitHub named `Kann-knits` (no README), then push this folder to it.
2. https://dash.cloudflare.com → **Workers & Pages → Create → Import a repository** → `Kann-knits`.
3. Project name **`kann-knits`**. Build command `npm run build`, deploy command `npx wrangler deploy` (the defaults).
4. **Settings → Domains & Routes → workers.dev → Enable**, so the URL above works.

Config that ships with the code:
- `wrangler.jsonc`: serves `dist/` as static files, and sends unknown paths to `index.html` so refreshing on any screen works.
- `public/_headers`: no-cache on `sw.js` and the manifest so updates reach Mom, and long caching for the hashed `assets/`.
- `.nvmrc`: Node 22 for the Cloudflare build.

Updating later: commit, then `git push`. Mom's app picks up the new version the next time she opens it (sometimes it takes two launches).

## Test it on your own iPhone first

1. Open the link in **Safari** → walk through the welcome.
2. Share → **Add to Home Screen** → open it from the icon. It should open full screen with no Safari bars.
3. Turn on Airplane Mode and reopen it. It should still work.
4. Count a few rows, then swipe the app away and reopen it. The count should be exactly where you left it. Leave the counter open for a minute: the screen should stay on.
5. **Settings → Backup & restore → Back up now → Save backup file → Save to Files.** Check the file shows up in the Files app.
6. Open a design, pinch to zoom with two fingers, then **⋯ → Make a picture → Save picture → Save Image**.

## Giving it to Mom

1. Text her the URL.
2. **iPhone:** she must open it in **Safari**. The welcome flow shows her: Share → *Add to Home Screen* → Add.
   **Android:** Chrome shows an *Install* button (or ⋮ → *Install app*).
3. From then on she opens **Kann Knits** from her Home Screen. It works offline.

Tip: install it on her phone yourself on Christmas morning, then hand it over.

## Things to know

- **Her data lives on her phone only.** On iPhone, the Home Screen app keeps its own storage, separate from Safari, so she should use the app from the Home Screen icon. If she deletes the app, its data goes with it.
- **Backups:** the app reminds her every 60 days. Help her save the first one to **Files → iCloud Drive**. On a new phone: install the app, then tap **Restore a backup** on the empty Projects screen.
- Changing the URL later (new project name or host) means a fresh install with empty data, because storage is tied to the URL. Pick the name once. If you must move, back up first and restore on the new URL.
- Don't put anything secret in the code. It's a public static site.
