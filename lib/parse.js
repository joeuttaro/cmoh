import * as cheerio from 'cheerio';
import crypto from 'crypto';

/**
 * Parse HTML from Hockey Canada schedule page and extract Team Canada games
 * @param {string} html - HTML content from the schedule page
 * @param {string} sourceUrl - URL of the source page (for logging)
 * @returns {Array<Object>} Array of game objects
 */
export function parseSchedule(html, sourceUrl = '') {
  const $ = cheerio.load(html);
  const games = [];

  console.log(`Parsing schedule from: ${sourceUrl || 'unknown source'}`);
  console.log(`HTML length: ${html.length} bytes`);

  // Strategy 1: Look for structured tables with schedule data
  // Common patterns: table rows, schedule containers, game cards
  
  // Try to find tables first
  $('table').each((tableIndex, table) => {
    const $table = $(table);
    const tableText = $table.text().toLowerCase();
    
    // Only process tables that might contain schedule data
    if (!tableText.includes('canada') && !tableText.includes('feb') && !tableText.includes('2026')) {
      return;
    }

    $table.find('tr, tbody tr').each((rowIndex, row) => {
      const $row = $(row);
      const rowText = $row.text();
      const rowTextLower = rowText.toLowerCase();
      
      // Check if this row contains Canada
      if (!rowTextLower.includes('canada') && !rowTextLower.match(/\bcan\b/)) {
        return;
      }

      const game = extractGameFromRow($row, rowText);
      if (game) {
        games.push(game);
      }
    });
  });

  // Strategy 2: Look for div-based schedule layouts
  $('[class*="schedule"], [class*="game"], [class*="match"], [class*="event"]').each((i, elem) => {
    const $elem = $(elem);
    const text = $elem.text().toLowerCase();
    
    if (text.includes('canada') && (text.includes('feb') || text.includes('2026') || text.match(/\d{1,2}:\d{2}/))) {
      const game = extractGameFromElement($elem, $elem.text());
      if (game) {
        games.push(game);
      }
    }
  });

  // Strategy 3: Look for JSON-LD structured data (if available)
  $('script[type="application/ld+json"]').each((i, script) => {
    try {
      const jsonData = JSON.parse($(script).html());
      if (Array.isArray(jsonData)) {
        jsonData.forEach(item => {
          if (item['@type'] === 'SportsEvent' || item['@type'] === 'Event') {
            const game = extractGameFromStructuredData(item);
            if (game) {
              games.push(game);
            }
          }
        });
      } else if (jsonData['@type'] === 'SportsEvent' || jsonData['@type'] === 'Event') {
        const game = extractGameFromStructuredData(jsonData);
        if (game) {
          games.push(game);
        }
      }
    } catch (e) {
      // Not valid JSON, skip
    }
  });

  // Strategy 4: Aggressive text search for game patterns
  if (games.length === 0) {
    console.log('No games found with structured selectors, trying text-based extraction...');
    
    // Look for patterns like "Canada vs [Opponent]" or "[Opponent] vs Canada"
    const gamePatterns = [
      /canada\s+vs\.?\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/gi,
      /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+vs\.?\s+canada/gi,
      /canada\s+v\.?\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/gi,
    ];

    $('body').find('*').each((i, elem) => {
      const $elem = $(elem);
      const text = $elem.text();
      const textLower = text.toLowerCase();
      
      if (textLower.includes('canada') && (textLower.includes('feb') || textLower.includes('2026'))) {
        // Try to extract date, time, and opponent
        const dateMatch = text.match(/(?:feb|february)\s+(\d{1,2}),?\s+2026|(\d{1,2})[\/\-](\d{1,2})[\/\-]2026|2026[\/\-](\d{1,2})[\/\-](\d{1,2})/i);
        const timeMatch = text.match(/(\d{1,2}):(\d{2})\s*(am|pm|AM|PM)?/);
        
        for (const pattern of gamePatterns) {
          const opponentMatch = text.match(pattern);
          if (opponentMatch && dateMatch && timeMatch) {
            const opponent = opponentMatch[1] || opponentMatch[0].replace(/canada\s+vs\.?\s+/i, '').replace(/\s+vs\.?\s+canada/i, '');
            
            let dateStr;
            if (dateMatch[1]) {
              // "February 12, 2026" format
              dateStr = `${dateMatch[1]}/02/2026`;
            } else if (dateMatch[2] && dateMatch[3]) {
              // "12/02/2026" format
              dateStr = `${dateMatch[2]}/${dateMatch[3]}/2026`;
            } else if (dateMatch[4] && dateMatch[5]) {
              // "2026/02/12" format
              dateStr = `${dateMatch[5]}/${dateMatch[4]}/2026`;
            } else {
              continue;
            }

            // Determine round from context
            let round = 'Preliminary';
            const roundText = textLower;
            if (roundText.includes('qualifying') || roundText.includes('qualification')) {
              round = 'Qualifying';
            } else if (roundText.includes('quarterfinal') || roundText.includes('qf')) {
              round = 'Quarterfinal';
            } else if (roundText.includes('semifinal') || roundText.includes('sf')) {
              round = 'Semifinal';
            } else if (roundText.includes('final') || roundText.includes('gold medal')) {
              round = 'Final';
            }

            games.push({
              dateStr,
              timeStr: timeMatch[0],
              opponent: opponent.trim(),
              venue: extractVenue(text) || 'Milano Cortina 2026',
              round: round,
              rawText: text.trim()
            });
            break; // Found a game, move to next element
          }
        }
      }
    });
  }

  // Remove duplicates based on date/time/opponent
  const uniqueGames = [];
  const seen = new Set();
  
  games.forEach(game => {
    const key = `${game.dateStr}-${game.timeStr}-${game.opponent}`.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      uniqueGames.push(game);
    }
  });

  console.log(`Found ${uniqueGames.length} unique Team Canada games`);

  // Generate stable IDs for each game
  return uniqueGames.map((game) => {
    // Create a deterministic hash for UID
    const uidString = `${game.dateStr}-${game.timeStr}-${game.opponent}-${game.venue}-${game.round}`;
    const hash = crypto.createHash('md5').update(uidString).digest('hex').substring(0, 12);
    
    return {
      ...game,
      id: `mc2026-can-men-${hash}`
    };
  });
}

/**
 * Extract game data from a table row
 */
function extractGameFromRow($row, rowText) {
  const cells = $row.find('td, th');
  if (cells.length === 0) return null;

  // Try different cell arrangements
  let dateStr = null;
  let timeStr = null;
  let opponent = null;
  let venue = null;
  let round = 'Preliminary';

  // Common table structure: Date | Time | Team1 | Team2 | Venue | Round
  // Or: Date | Time | Opponent | Venue
  
  // Extract date from cells or text
  const dateMatch = rowText.match(/(?:feb|february)\s+(\d{1,2}),?\s+2026|(\d{1,2})[\/\-](\d{1,2})[\/\-]2026|2026[\/\-](\d{1,2})[\/\-](\d{1,2})/i);
  if (dateMatch) {
    if (dateMatch[1]) {
      dateStr = `${dateMatch[1]}/02/2026`;
    } else if (dateMatch[2] && dateMatch[3]) {
      dateStr = `${dateMatch[2]}/${dateMatch[3]}/2026`;
    } else if (dateMatch[4] && dateMatch[5]) {
      dateStr = `${dateMatch[5]}/${dateMatch[4]}/2026`;
    }
  }

  // Extract time
  const timeMatch = rowText.match(/(\d{1,2}):(\d{2})\s*(am|pm|AM|PM)?/);
  if (timeMatch) {
    timeStr = timeMatch[0];
  }

  // Extract opponent - look for team names that aren't Canada
  const opponentMatch = rowText.match(/(?:canada\s+vs\.?\s+|vs\.?\s+canada|canada\s+v\.?\s+)([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i) ||
                       rowText.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+vs\.?\s+canada/i);
  if (opponentMatch) {
    opponent = opponentMatch[1] || opponentMatch[0].replace(/canada\s+vs\.?\s+/i, '').replace(/\s+vs\.?\s+canada/i, '');
  }

  // Extract venue
  venue = extractVenue(rowText) || 'Milano Cortina 2026';

  // Extract round
  const roundText = rowText.toLowerCase();
  if (roundText.includes('qualifying') || roundText.includes('qualification')) {
    round = 'Qualifying';
  } else if (roundText.includes('quarterfinal') || roundText.includes('qf')) {
    round = 'Quarterfinal';
  } else if (roundText.includes('semifinal') || roundText.includes('sf')) {
    round = 'Semifinal';
  } else if (roundText.includes('final') || roundText.includes('gold medal')) {
    round = 'Final';
  }

  if (dateStr && timeStr && opponent) {
    return {
      dateStr,
      timeStr,
      opponent: opponent.trim(),
      venue: venue.trim(),
      round: round,
      rawText: rowText.trim()
    };
  }

  return null;
}

/**
 * Extract game data from a div/container element
 */
function extractGameFromElement($elem, text) {
  // Similar logic to extractGameFromRow but for div-based layouts
  return extractGameFromRow($elem, text);
}

/**
 * Extract game data from JSON-LD structured data
 */
function extractGameFromStructuredData(data) {
  // Handle structured data format
  const name = data.name || '';
  if (!name.toLowerCase().includes('canada')) {
    return null;
  }

  const startDate = data.startDate || data.startTime;
  const location = data.location?.name || data.location || '';
  const opponent = extractOpponentFromName(name);

  if (startDate && opponent) {
    const date = new Date(startDate);
    const dateStr = `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
    const timeStr = `${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;

    return {
      dateStr,
      timeStr,
      opponent,
      venue: location || 'Milano Cortina 2026',
      round: 'Preliminary',
      rawText: name
    };
  }

  return null;
}

/**
 * Extract opponent name from game description
 */
function extractOpponentFromName(name) {
  const match = name.match(/(?:canada\s+vs\.?\s+|vs\.?\s+canada|canada\s+v\.?\s+)([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i) ||
               name.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+vs\.?\s+canada/i);
  return match ? match[1] : null;
}

/**
 * Extract venue from text
 */
function extractVenue(text) {
  const venues = [
    'Milano Rho',
    'Milano Cortina',
    'Arena',
    'Stadium',
    'Pala',
    'Palasport'
  ];

  for (const venue of venues) {
    if (text.toLowerCase().includes(venue.toLowerCase())) {
      return venue;
    }
  }

  return null;
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
    'great britain': 'Great Britain',
    'russia': 'ROC',
    'russian federation': 'ROC'
  };
  
  const lower = opponent.toLowerCase().trim();
  return normalizations[lower] || opponent;
}
