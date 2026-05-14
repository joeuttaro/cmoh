# Team Canada Men's Hockey — IIHF World Championship 2026 ICS Feed

A subscribe-able ICS calendar feed for **Team Canada men's games** at the **2026 IIHF Ice Hockey World Championship** (Switzerland).

## What This Does

This project automatically:

1. Fetches the schedule from the **IIHF realtime JSON API** (event `969`, same tournament as [stats.iihf.com/Hydra/969](https://stats.iihf.com/Hydra/969/)), with HTML fallback to the official [WM 2026 schedule](https://www.iihf.com/en/events/2026/wm/schedule)
2. Keeps only games involving **Canada**
3. Generates a valid `.ics` calendar file
4. Updates it via **GitHub Actions** every 6 hours

## Subscription

Once GitHub Pages is enabled, you can subscribe using:

### Subscription URL

**HTTPS:**

```
https://joeuttaro.github.io/cmoh/canada-mens-world-championship-2026.ics
```

**Webcal (alternative):**

```
webcal://joeuttaro.github.io/cmoh/canada-mens-world-championship-2026.ics
```

### How to Subscribe

#### Apple Calendar (macOS/iOS)

1. Open Calendar app
2. File → New Calendar Subscription
3. Paste the subscription URL
4. Choose update frequency (every 6 hours recommended)
5. Click Subscribe

#### Google Calendar

1. Open Google Calendar
2. Click the "+" next to "Other calendars"
3. Select "From URL"
4. Paste the subscription URL
5. Click "Add calendar"

#### Outlook

1. Open Outlook Calendar
2. Right-click "Other calendars" → "Add calendar" → "From Internet"
3. Paste the subscription URL
4. Click "OK"

## Setup

### Prerequisites

- Node.js 20+
- npm

### Installation

```bash
npm install
```

### Generate ICS File Locally

```bash
npm run build-ics
```

This will:

- Call the IIHF API (`GetLatestScoresState/969`) first, then fall back to scraping the WM schedule page if needed
- Extract all Team Canada games across rounds returned by the API
- Write `canada-mens-world-championship-2026.ics` in the project root

### Debug Parsing

To test the HTML parser without generating an ICS file:

```bash
node debug-parse.js
```

Or test a specific URL:

```bash
node debug-parse.js https://www.iihf.com/en/events/2026/wm/schedule
```

### Custom Source URL

Override the HTML fallback URL (API URL is separate):

```bash
SOURCE_URL=https://www.iihf.com/en/events/2026/wm/schedule npm run build-ics
```

Override the IIHF API tournament id (default `969`):

```bash
IIHF_API_URL=https://realtime.iihf.com/gamestate/GetLatestScoresState/969 npm run build-ics
```

## GitHub Pages Setup (Step-by-Step)

### Step 1: Push Your Code to GitHub

If you haven't already:

```bash
git init
git add .
git commit -m "Initial commit: IIHF Worlds 2026 ICS feed"
git remote add origin https://github.com/joeuttaro/cmoh.git
git branch -M main
git push -u origin main
```

### Step 2: Enable GitHub Pages

1. Go to your repository on GitHub: `https://github.com/joeuttaro/cmoh`
2. Click **Settings** → **Pages**
3. Under **Source**, choose **Deploy from a branch**, branch `main`, folder `/ (root)`, then **Save**
4. After deployment, the site base URL is `https://joeuttaro.github.io/cmoh/`

### Step 3: Verify the ICS File

Open:

`https://joeuttaro.github.io/cmoh/canada-mens-world-championship-2026.ics`

You should see ICS text or a download.

### Step 4: GitHub Action

Under **Actions**, use **Update ICS Calendar**; you can run it manually with **Run workflow**.

### Step 5: Subscribe

Use the HTTPS URL above in your calendar app.

### Automatic Updates

The workflow runs every 6 hours, regenerates the ICS file, commits changes when the file differs, and GitHub Pages serves the updated file.

## Features

- **Stable UIDs**: Deterministic IDs per game (`wm2026-can-men-…`) for stable subscriptions
- **Automatic updates**: Scheduled Action every 6 hours
- **Timezone handling**: API uses `GameDateTimeUTC`; scraped times use **CEST (UTC+2)** as local default for May 2026 in Switzerland
- **Event details**: Opponent, venue, round, source link
- **Standard ICS**: Works with major calendar apps

## File Structure

```
.
├── generate.js              # Main CLI script
├── lib/
│   ├── parse.js             # HTML parsing (IIHF schedule fallback)
│   ├── parse-api.js         # IIHF JSON API parsing
│   └── ics.js               # ICS generation
├── canada-mens-world-championship-2026.ics  # Generated (root, for Pages)
├── .github/workflows/update-ics.yml
└── package.json
```

## Troubleshooting

### No games found

1. Run `node debug-parse.js` for parser diagnostics
2. Confirm the API responds: `curl -sS 'https://realtime.iihf.com/gamestate/GetLatestScoresState/969' | head -c 200`
3. Inspect saved HTML: `/tmp/hockey-schedule.html` after `debug-parse.js`
4. If the IIHF site blocks automated requests, rely on the API path or run locally with a normal browser user agent

### Timezone issues

API-sourced games use UTC from IIHF. HTML fallback assumes **Europe/Zurich summer time (CEST, UTC+2)** for May 2026; see `parseDateTime` in `lib/ics.js`.

### Calendar not updating

Check Actions logs, confirm the ICS file has `BEGIN:VEVENT` entries, and that Pages is enabled.

## License

MIT
