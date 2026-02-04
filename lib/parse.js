import * as cheerio from 'cheerio';
import crypto from 'crypto';

/**
 * Parse HTML from Hockey Canada schedule page and extract Team Canada games
 * @param {string} html - HTML content from the schedule page
 * @returns {Array<Object>} Array of game objects
 */
export function parseSchedule(html) {
  const $ = cheerio.load(html);
  const games = [];

  // The structure may vary, but we'll look for common patterns:
  // - Table rows with game data
  // - Date/time information
  // - Team names (looking for "Canada" or "CAN")
  // - Venue information

  // Try multiple selectors to find game data
  // Common patterns: table rows, div containers, etc.
  
  // Look for tables first
  $('table tbody tr, .schedule-row, .game-row, [class*="game"], [class*="schedule"]').each((i, elem) => {
    const $row = $(elem);
    const text = $row.text().toLowerCase();
    
    // Check if this row contains Canada/CAN
    if (!text.includes('canada') && !text.includes('can ')) {
      return; // Skip rows that don't mention Canada
    }

    // Extract date - look for date patterns
    const dateMatch = $row.text().match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})|(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
    const timeMatch = $row.text().match(/(\d{1,2}):(\d{2})\s*(am|pm|AM|PM)?/);
    
    // Try to find date/time in data attributes or specific cells
    let dateStr = $row.find('[data-date], .date, .game-date').text().trim() || 
                  $row.find('td').eq(0).text().trim();
    let timeStr = $row.find('[data-time], .time, .game-time').text().trim() || 
                  $row.find('td').eq(1).text().trim();

    // If we found matches in the text, use those
    if (dateMatch) {
      dateStr = dateMatch[0];
    }
    if (timeMatch) {
      timeStr = timeMatch[0];
    }

    // Extract opponent - look for team names that aren't Canada
    const opponentMatch = $row.text().match(/(?:vs|v\.|@)\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i);
    let opponent = opponentMatch ? opponentMatch[1] : null;
    
    // Try to find opponent in specific cells
    if (!opponent) {
      const opponentCell = $row.find('.opponent, .team, [data-opponent]').text().trim();
      if (opponentCell && !opponentCell.toLowerCase().includes('canada')) {
        opponent = opponentCell;
      }
    }

    // Extract venue
    const venue = $row.find('.venue, .location, [data-venue]').text().trim() || 
                  $row.find('td').eq(2).text().trim() || 
                  'Milano Cortina 2026';

    // Extract round/phase
    const round = $row.find('.round, .phase, [data-round]').text().trim() || 
                  $row.find('td').eq(3).text().trim() || 
                  'Preliminary';

    // Only add if we have minimum required data
    if (dateStr && timeStr && opponent) {
      games.push({
        dateStr,
        timeStr,
        opponent: opponent.trim(),
        venue: venue.trim(),
        round: round.trim(),
        rawText: $row.text().trim()
      });
    }
  });

  // If no games found with the above selectors, try a more aggressive approach
  // Look for any text blocks that mention dates and Canada
  if (games.length === 0) {
    $('body').find('*').each((i, elem) => {
      const $elem = $(elem);
      const text = $elem.text().toLowerCase();
      
      if (text.includes('canada') && (text.includes('feb') || text.includes('2026'))) {
        // Try to extract structured data from this element
        const dateMatch = text.match(/(feb|february)\s+(\d{1,2}),?\s+2026/i);
        const timeMatch = text.match(/(\d{1,2}):(\d{2})\s*(am|pm)?/i);
        const opponentMatch = text.match(/(?:vs|v\.|@)\s*([a-z]+(?:\s+[a-z]+)*)/i);
        
        if (dateMatch && timeMatch && opponentMatch) {
          games.push({
            dateStr: `${dateMatch[2]}/02/2026`,
            timeStr: timeMatch[0],
            opponent: opponentMatch[1].trim(),
            venue: 'Milano Cortina 2026',
            round: 'Preliminary',
            rawText: $elem.text().trim()
          });
        }
      }
    });
  }

  // Generate stable IDs for each game
  return games.map((game, index) => {
    // Create a deterministic hash for UID
    const uidString = `${game.dateStr}-${game.timeStr}-${game.opponent}-${game.venue}`;
    const hash = crypto.createHash('md5').update(uidString).digest('hex').substring(0, 12);
    
    return {
      ...game,
      id: `mc2026-can-men-${hash}`
    };
  });
}

/**
 * Normalize opponent names (e.g., "Czechia" vs "Czech Republic")
 */
export function normalizeOpponent(opponent) {
  const normalizations = {
    'czech republic': 'Czechia',
    'czechia': 'Czechia',
    'usa': 'United States',
    'us': 'United States',
    'uk': 'Great Britain',
    'great britain': 'Great Britain'
  };
  
  const lower = opponent.toLowerCase().trim();
  return normalizations[lower] || opponent;
}
