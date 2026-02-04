# Manual Game Entry (Fallback)

If the automatic scraping fails to find games, you can manually update the fallback games in `generate.js`.

## Current Fallback Games

The fallback function `getFallbackGames()` in `generate.js` currently has 3 placeholder preliminary round games. These need to be updated with the actual schedule when it's published.

## How to Update

1. Open `generate.js`
2. Find the `getFallbackGames()` function
3. Update the games array with actual schedule data:

```javascript
const games = [
  {
    dateStr: '06/02/2026',  // DD/MM/YYYY format
    timeStr: '20:00',        // HH:MM format (24-hour, Italy time)
    opponent: 'Switzerland',  // Actual opponent name
    venue: 'Milano Rho Arena',
    round: 'Preliminary',
    rawText: 'Canada vs Switzerland - Preliminary Round'
  },
  // Add more games...
];
```

## Game Format

- **dateStr**: Date in `DD/MM/YYYY` format (e.g., `06/02/2026` for February 6, 2026)
- **timeStr**: Time in `HH:MM` format, 24-hour (e.g., `20:00` for 8:00 PM)
- **opponent**: Opponent team name (e.g., `Switzerland`, `United States`, `Czechia`)
- **venue**: Venue name (e.g., `Milano Rho Arena`, `Milano Cortina 2026`)
- **round**: Tournament round (`Preliminary`, `Qualifying`, `Quarterfinal`, `Semifinal`, `Final`)
- **rawText**: Descriptive text (optional, for reference)

## Adding Playoff Games

As Canada advances through the tournament, add games for each round:

- **Qualifying Round**: If Canada doesn't get a bye
- **Quarterfinal**: If Canada advances
- **Semifinal**: If Canada wins quarterfinal
- **Final**: If Canada wins semifinal (Bronze or Gold medal game)

## Example: Complete Schedule

```javascript
const games = [
  // Preliminary Round (3 games)
  { dateStr: '06/02/2026', timeStr: '20:00', opponent: 'Switzerland', venue: 'Milano Rho Arena', round: 'Preliminary', rawText: 'Canada vs Switzerland' },
  { dateStr: '08/02/2026', timeStr: '16:00', opponent: 'Czechia', venue: 'Milano Rho Arena', round: 'Preliminary', rawText: 'Canada vs Czechia' },
  { dateStr: '10/02/2026', timeStr: '20:00', opponent: 'Finland', venue: 'Milano Rho Arena', round: 'Preliminary', rawText: 'Canada vs Finland' },
  
  // Quarterfinal (if Canada advances)
  { dateStr: '12/02/2026', timeStr: '20:00', opponent: 'TBD', venue: 'Milano Rho Arena', round: 'Quarterfinal', rawText: 'Canada vs TBD - Quarterfinal' },
  
  // Semifinal (if Canada wins quarterfinal)
  { dateStr: '14/02/2026', timeStr: '20:00', opponent: 'TBD', venue: 'Milano Rho Arena', round: 'Semifinal', rawText: 'Canada vs TBD - Semifinal' },
  
  // Final (if Canada wins semifinal)
  { dateStr: '16/02/2026', timeStr: '20:00', opponent: 'TBD', venue: 'Milano Rho Arena', round: 'Final', rawText: 'Canada vs TBD - Final' },
];
```

## Timezone Note

Times should be in **Italy local time** (Europe/Rome, CET/CEST). The script will automatically convert to UTC for the ICS file.

## After Updating

1. Commit the changes: `git commit -am "Update manual game schedule"`
2. Push to GitHub: `git push`
3. The GitHub Action will regenerate the ICS file
4. Your calendar subscription will update automatically
