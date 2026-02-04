# Team Canada Men's Olympic Hockey ICS Calendar Feed

A subscribe-able ICS calendar feed for **Team Canada Men's Olympic Hockey games** at the **Milano Cortina 2026** Winter Olympics.

## What This Does

This project automatically:
1. Fetches the schedule from Hockey Canada's official 2026 Olympic Men's Hockey schedule page
2. Extracts only Team Canada games
3. Generates a valid `.ics` calendar file
4. Updates it automatically via GitHub Actions every 6 hours

## Subscription

Once GitHub Pages is enabled, you can subscribe to the calendar using:

### Subscription URL

**HTTPS:**
```
https://joeuttaro.github.io/cmoh/canada-mens-olympic-hockey-2026.ics
```

**Webcal (alternative):**
```
webcal://joeuttaro.github.io/cmoh/canada-mens-olympic-hockey-2026.ics
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
- Fetch the schedule from Hockey Canada (with IIHF as backup)
- Parse the HTML using multiple strategies
- Extract all Team Canada games across all rounds
- Generate `canada-mens-olympic-hockey-2026.ics` in the root directory

### Debug Parsing

To test the parser without generating an ICS file:

```bash
node debug-parse.js
```

Or test a specific URL:

```bash
node debug-parse.js https://www.iihf.com/en/events/2026/olympic-m/schedule
```

### Custom Source URL

You can override the source URL via environment variable:

```bash
SOURCE_URL=https://example.com/schedule npm run build-ics
```

## GitHub Pages Setup (Step-by-Step)

### Step 1: Push Your Code to GitHub

If you haven't already, push this repository to GitHub:

```bash
git init
git add .
git commit -m "Initial commit: Olympic Hockey ICS feed"
git remote add origin https://github.com/joeuttaro/cmoh.git
git branch -M main
git push -u origin main
```

### Step 2: Enable GitHub Pages

1. Go to your repository on GitHub: `https://github.com/joeuttaro/cmoh`
2. Click on **Settings** (top menu bar)
3. Scroll down to **Pages** in the left sidebar (under "Code and automation")
4. Under **Source**, select:
   - **Deploy from a branch**
   - **Branch**: `main`
   - **Folder**: `/ (root)` or `/public` (if available)
   - Click **Save**

   **Note:** If `/public` is not available as an option, use `/ (root)`. GitHub Pages will serve files from the root, and the `public/` folder will be accessible.

5. Wait a few minutes for GitHub to build and deploy your site
6. Your site will be available at: `https://joeuttaro.github.io/cmoh/`

### Step 3: Verify the ICS File is Accessible

After GitHub Pages is enabled, test that the file is accessible:

1. Open: `https://joeuttaro.github.io/cmoh/canada-mens-olympic-hockey-2026.ics`
2. You should see the ICS calendar content (or download the file)
3. If you get a 404, wait a few more minutes and try again

### Step 4: Test the GitHub Action

1. Go to the **Actions** tab in your repository
2. You should see the "Update ICS Calendar" workflow
3. You can manually trigger it by clicking "Run workflow"
4. Check the logs to ensure it runs successfully

### Step 5: Subscribe to the Calendar

Once verified, use this URL to subscribe:

```
https://joeuttaro.github.io/cmoh/canada-mens-olympic-hockey-2026.ics
```

### Automatic Updates

The GitHub Action will automatically:
- Run every 6 hours
- Fetch the latest schedule from Hockey Canada
- Update the ICS file if changes are detected
- Commit and push changes back to the repository
- GitHub Pages will automatically serve the updated file

### Manual Trigger

You can also manually trigger the workflow:
1. Go to **Actions** tab
2. Click on "Update ICS Calendar" workflow
3. Click "Run workflow" → "Run workflow" button

## Features

- ✅ **Stable UIDs**: Each game has a deterministic UID that doesn't change between updates
- ✅ **Automatic updates**: GitHub Action refreshes the calendar every 6 hours
- ✅ **Timezone handling**: Converts Italy time (Europe/Rome) to UTC
- ✅ **Event details**: Includes opponent, venue, round, and source link
- ✅ **Standard ICS format**: Compatible with all major calendar applications

## File Structure

```
.
├── generate.js              # Main CLI script
├── lib/
│   ├── parse.js            # HTML parsing logic
│   └── ics.js              # ICS generation logic
├── canada-mens-olympic-hockey-2026.ics  # Generated ICS file (in root for GitHub Pages)
├── .github/
│   └── workflows/
│       └── update-ics.yml  # GitHub Action workflow
└── package.json
```

## Troubleshooting

### No games found

If the script reports "No games found", try these steps:

1. **Check the debug script**: Run `node debug-parse.js` to see detailed parsing output
2. **Try alternative source**: The script automatically tries IIHF schedule as a backup
3. **Check HTML structure**: If parsing fails, the HTML is saved to `/tmp/hockey-schedule.html` for inspection
4. **JavaScript-rendered content**: If the schedule loads via JavaScript, cheerio can't parse it. You may need to use Puppeteer or Playwright for dynamic content
5. **Update parser**: If the page structure changed, update the parsing logic in `lib/parse.js`

The parser now supports:
- Multiple HTML structures (tables, divs, structured data)
- All tournament rounds (Preliminary, Qualifying, Quarterfinal, Semifinal, Final)
- Multiple data sources (Hockey Canada and IIHF)
- Better opponent and date/time extraction

### Timezone issues

The script assumes Italy is in CET (UTC+1) during February 2026. If there are timezone discrepancies, check the `parseDateTime` function in `lib/ics.js`.

### Calendar not updating

- Check GitHub Actions logs to see if the workflow is running
- Verify the ICS file is being generated correctly
- Ensure GitHub Pages is enabled and serving the file

## License

MIT
