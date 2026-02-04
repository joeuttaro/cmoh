# Team Canada Men's Olympic Hockey ICS Calendar Feed

A subscribe-able ICS calendar feed for **Team Canada Men's Olympic Hockey games** at the **Milano Cortina 2026** Winter Olympics.

## What This Does

This project automatically:
1. Fetches the schedule from Hockey Canada's official 2026 Olympic Men's Hockey schedule page
2. Extracts only Team Canada games
3. Generates a valid `.ics` calendar file
4. Updates it automatically via GitHub Actions every 6 hours

## Subscription

Once this repository is published to GitHub Pages, you can subscribe to the calendar using:

### Subscription URL

```
https://<your-username>.github.io/olympic-hockey/canada-mens-olympic-hockey-2026.ics
```

Or using the `webcal://` protocol:

```
webcal://<your-username>.github.io/olympic-hockey/canada-mens-olympic-hockey-2026.ics
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
- Fetch the schedule from Hockey Canada
- Parse the HTML
- Generate `public/canada-mens-olympic-hockey-2026.ics`

### Custom Source URL

You can override the source URL via environment variable:

```bash
SOURCE_URL=https://example.com/schedule npm run build-ics
```

## GitHub Pages Setup

1. **Enable GitHub Pages** in your repository settings:
   - Go to Settings → Pages
   - Source: Deploy from a branch
   - Branch: `main` / `root`

2. **The GitHub Action will automatically**:
   - Run every 6 hours
   - Fetch the latest schedule
   - Update the ICS file if changes are detected
   - Commit and push changes

3. **Manual trigger**: You can also manually trigger the workflow from the Actions tab

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
├── public/
│   └── canada-mens-olympic-hockey-2026.ics
├── .github/
│   └── workflows/
│       └── update-ics.yml  # GitHub Action workflow
└── package.json
```

## Troubleshooting

### No games found

If the script reports "No games found", the Hockey Canada page structure may have changed. You'll need to update the parsing logic in `lib/parse.js` to match the new HTML structure.

### Timezone issues

The script assumes Italy is in CET (UTC+1) during February 2026. If there are timezone discrepancies, check the `parseDateTime` function in `lib/ics.js`.

### Calendar not updating

- Check GitHub Actions logs to see if the workflow is running
- Verify the ICS file is being generated correctly
- Ensure GitHub Pages is enabled and serving the file

## License

MIT
