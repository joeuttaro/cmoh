import * as cheerio from 'cheerio';
import crypto from 'crypto';

/**
 * Parse HTML from IIHF or Hockey Canada schedule page and extract Team Canada games
 * @param {string} html - HTML content from the schedule page
 * @param {string} sourceUrl - URL of the source page (for logging)
 * @returns {Array<Object>} Array of game objects
 */
export function parseSchedule(html, sourceUrl = '') {
  const $ = cheerio.load(html);
  const games = [];
  const isIIHF = sourceUrl.includes('iihf.com');

  console.log(`Parsing schedule from: ${sourceUrl || 'unknown source'}`);
  console.log(`HTML length: ${html.length} bytes`);
  console.log(`Source type: ${isIIHF ? 'IIHF' : 'Other'}`);

  // Helper to check if text contains Canada/CAN
  const isCanadaGame = (text) => {
    const lower = text.toLowerCase();
    // Check for "CAN" as country code (with word boundaries to avoid false matches)
    // Also check for "Canada" as full name
    return /\bcan\b/i.test(text) || lower.includes('canada');
  };

  // Strategy 1: Look for structured tables with schedule data
  // IIHF typically uses tables with team codes (CAN, USA, etc.)
  
  $('table').each((tableIndex, table) => {
    const $table = $(table);
    const tableText = $table.text();
    
    // Only process tables that might contain schedule data
    // For IIHF, look for CAN or Canada, or any date/time patterns
    const hasScheduleData = isCanadaGame(tableText) || 
                           tableText.match(/\d{1,2}[\/\-]\d{1,2}[\/\-]2026/) ||
                           tableText.match(/(?:feb|february)\s+\d{1,2}/i) ||
                           tableText.match(/\d{1,2}:\d{2}/);
    
    if (!hasScheduleData) {
      return;
    }

    $table.find('tr, tbody tr').each((rowIndex, row) => {
      const $row = $(row);
      const rowText = $row.text();
      
      // Check if this row contains Canada/CAN
      if (!isCanadaGame(rowText)) {
        return;
      }

      const game = extractGameFromRow($row, rowText, isIIHF);
      if (game) {
        games.push(game);
      }
    });
  });

  // Strategy 2: Look for div-based schedule layouts (common in IIHF)
  $('[class*="schedule"], [class*="game"], [class*="match"], [class*="event"], [class*="fixture"]').each((i, elem) => {
    const $elem = $(elem);
    const text = $elem.text();
    
    if (isCanadaGame(text) && (text.match(/\d{1,2}[\/\-]\d{1,2}[\/\-]2026/) || text.match(/(?:feb|february)\s+\d{1,2}/i) || text.match(/\d{1,2}:\d{2}/))) {
      const game = extractGameFromElement($elem, text, isIIHF);
      if (game) {
        games.push(game);
      }
    }
  });
  
  // Strategy 2b: IIHF-specific selectors
  if (isIIHF) {
    // Look for game rows with team codes
    $('[data-team], .team-code, [class*="team"]').each((i, elem) => {
      const $elem = $(elem);
      const text = $elem.text();
      const parent = $elem.closest('tr, [class*="game"], [class*="match"], [class*="fixture"]');
      
      if (parent.length > 0 && isCanadaGame(text)) {
        const game = extractGameFromElement(parent, parent.text(), isIIHF);
        if (game) {
          games.push(game);
        }
      }
    });
  }

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
    // Also handle country codes like "CAN vs USA" for IIHF
    const gamePatterns = [
      /(?:canada|can\b)\s+vs\.?\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/gi,
      /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+vs\.?\s+(?:canada|can\b)/gi,
      /(?:canada|can\b)\s+v\.?\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/gi,
      /\bcan\b\s+vs\.?\s+([A-Z]{3})\b/gi,  // CAN vs USA
      /\b([A-Z]{3})\b\s+vs\.?\s+can\b/gi,  // USA vs CAN
    ];

    $('body').find('*').each((i, elem) => {
      const $elem = $(elem);
      const text = $elem.text();
      const textLower = text.toLowerCase();
      
      if (isCanadaGame(text) && (textLower.includes('feb') || textLower.includes('2026') || text.match(/\d{1,2}[\/\-]\d{1,2}[\/\-]2026/))) {
        // Try to extract date, time, and opponent
        const dateMatch = text.match(/(?:feb|february)\s+(\d{1,2}),?\s+2026|(\d{1,2})[\/\-](\d{1,2})[\/\-]2026|2026[\/\-](\d{1,2})[\/\-](\d{1,2})/i);
        const timeMatch = text.match(/(\d{1,2}):(\d{2})\s*(am|pm|AM|PM)?/);
        
        for (const pattern of gamePatterns) {
          const opponentMatch = text.match(pattern);
          if (opponentMatch && dateMatch && timeMatch) {
            let opponent = opponentMatch[1] || opponentMatch[0].replace(/(?:canada|can\b)\s+vs\.?\s+/i, '').replace(/\s+vs\.?\s+(?:canada|can\b)/i, '');
            
            // If opponent is a 3-letter country code, expand it
            if (opponent && opponent.length === 3 && opponent === opponent.toUpperCase()) {
              opponent = expandCountryCode(opponent);
            }
            
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

            // Determine round from context - check all tournament phases
            let round = 'Preliminary';
            const roundText = textLower;
            if (roundText.match(/\b(qualifying|qualification|qual)\b/)) {
              round = 'Qualifying';
            } else if (roundText.match(/\b(quarterfinal|quarter-final|qf|q\.?f\.?)\b/)) {
              round = 'Quarterfinal';
            } else if (roundText.match(/\b(semifinal|semi-final|sf|s\.?f\.?)\b/)) {
              round = 'Semifinal';
            } else if (roundText.match(/\b(final|gold\s+medal|bronze\s+medal)\b/)) {
              round = 'Final';
            } else if (roundText.match(/\b(preliminary|prelim|group|pool)\b/)) {
              round = 'Preliminary';
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
function extractGameFromRow($row, rowText, isIIHF = false) {
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

  // Extract opponent - look for team names/codes that aren't Canada/CAN
  // For IIHF, look for 3-letter country codes (e.g., USA, SWE, FIN, etc.)
  let opponent = null;
  
  if (isIIHF) {
    // IIHF uses country codes - find the other team code in the row
    const countryCodes = rowText.match(/\b([A-Z]{3})\b/g);
    if (countryCodes) {
      // Find the code that isn't CAN
      const otherCode = countryCodes.find(code => code !== 'CAN');
      if (otherCode) {
        opponent = expandCountryCode(otherCode);
      }
    }
  }
  
  // Also try text-based extraction for full team names
  if (!opponent) {
    const opponentMatch = rowText.match(/(?:canada\s+vs\.?\s+|vs\.?\s+canada|canada\s+v\.?\s+|can\s+vs\.?\s+|vs\.?\s+can\b)([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i) ||
                         rowText.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+vs\.?\s+(?:canada|can\b)/i);
    if (opponentMatch) {
      opponent = opponentMatch[1] || opponentMatch[0].replace(/canada\s+vs\.?\s+/i, '').replace(/\s+vs\.?\s+canada/i, '').replace(/can\s+vs\.?\s+/i, '').replace(/\s+vs\.?\s+can\b/i, '');
    }
  }

  // Extract venue
  venue = extractVenue(rowText) || 'Milano Cortina 2026';

  // Extract round - be more thorough for all tournament phases
  const roundText = rowText.toLowerCase();
  // Check for round indicators in various formats
  if (roundText.match(/\b(qualifying|qualification|qual)\b/)) {
    round = 'Qualifying';
  } else if (roundText.match(/\b(quarterfinal|quarter-final|qf|q\.?f\.?)\b/)) {
    round = 'Quarterfinal';
  } else if (roundText.match(/\b(semifinal|semi-final|sf|s\.?f\.?)\b/)) {
    round = 'Semifinal';
  } else if (roundText.match(/\b(final|gold\s+medal|bronze\s+medal)\b/)) {
    round = 'Final';
  } else if (roundText.match(/\b(preliminary|prelim|group|pool)\b/)) {
    round = 'Preliminary';
  }
  // Default to Preliminary if no round found

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
function extractGameFromElement($elem, text, isIIHF = false) {
  // Similar logic to extractGameFromRow but for div-based layouts
  return extractGameFromRow($elem, text, isIIHF);
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
 * Expand country code to full country name
 */
function expandCountryCode(code) {
  const codeMap = {
    'USA': 'United States',
    'SWE': 'Sweden',
    'FIN': 'Finland',
    'CZE': 'Czechia',
    'SVK': 'Slovakia',
    'SUI': 'Switzerland',
    'GER': 'Germany',
    'NOR': 'Norway',
    'DEN': 'Denmark',
    'LAT': 'Latvia',
    'AUT': 'Austria',
    'FRA': 'France',
    'GBR': 'Great Britain',
    'RUS': 'ROC',
    'ROC': 'ROC'
  };
  return codeMap[code] || code;
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
    'russian federation': 'ROC',
    'switzerland': 'Switzerland',
    'sweden': 'Sweden',
    'finland': 'Finland',
    'slovakia': 'Slovakia',
    'germany': 'Germany',
    'norway': 'Norway',
    'denmark': 'Denmark'
  };
  
  const lower = opponent.toLowerCase().trim();
  // Check if it's already a country code
  if (opponent.length === 3 && opponent === opponent.toUpperCase()) {
    return expandCountryCode(opponent);
  }
  return normalizations[lower] || opponent;
}
