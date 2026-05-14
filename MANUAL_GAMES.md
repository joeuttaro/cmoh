# Manual Game Entry (Fallback)

If the IIHF API and HTML fallback both fail, update the fallback games in `generate.js`.

## Current Fallback Games

`getFallbackGames()` in `generate.js` holds placeholder preliminary games for WM 2026. Replace them with real rows if needed.

## How to Update

1. Open `generate.js`
2. Find `getFallbackGames()`
3. Update the `games` array:

```javascript
const games = [
  {
    dateStr: '15/05/2026', // DD/MM/YYYY
    timeStr: '16:20', // 24h local (CEST for Switzerland, May 2026)
    opponent: 'Sweden',
    venue: 'BCF Arena',
    round: 'Preliminary',
    rawText: 'Canada vs Sweden'
  }
];
```

## Game Format

- **dateStr**: `DD/MM/YYYY`
- **timeStr**: `HH:MM` (24-hour, **local arena time**; script maps using CEST for WM)
- **opponent**: Display name or `TBD`
- **venue**: Arena or general label
- **round**: `Preliminary`, `Qualifying`, `Quarterfinal`, `Semifinal`, `Final`
- **rawText**: Optional note

## Timezone Note

Fallback **times** are interpreted as **CEST (UTC+2)** for May 2026 in Switzerland, consistent with the IIHF schedule. API-sourced games use UTC from `GameDateTimeUTC` and do not use this path.

## After Updating

Commit, push; the Action will regenerate the ICS when the pipeline runs.
