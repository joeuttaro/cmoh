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
  
  if (isIIHF) {
    // IIHF-specific parsing: Look for tables with game data
    $('table').each((tableIndex, table) => {
      const $table = $(table);
      const tableText = $table.text();
      
      // Check if table has schedule-like data (dates, times, country codes)
      const hasScheduleData = tableText.match(/\b(?:feb|february|jan|january|mar|march)\s+\d{1,2}/i) ||
                             tableText.match(/\d{1,2}[\/\-]\d{1,2}[\/\-]2026/) ||
                             tableText.match(/\b[A-Z]{3}\b.*\b[A-Z]{3}\b/) || // Two country codes
                             tableText.match(/\d{1,2}:\d{2}/);
      
      if (!hasScheduleData) {
        return;
      }

      // Process each row in the table
      $table.find('tr').each((rowIndex, row) => {
        const $row = $(row);
        const cells = $row.find('td, th');
        const rowText = $row.text();
        
        // Check if this row contains CAN (Canada's country code)
        if (!isCanadaGame(rowText)) {
          return;
        }

        // Try to extract game data from table cells
        const game = extractGameFromIIHFTableRow($row, cells, rowText, $);
        if (game) {
          games.push(game);
        }
      });
    });
  } else {
    // Non-IIHF parsing (original logic)
    $('table').each((tableIndex, table) => {
      const $table = $(table);
      const tableText = $table.text();
      
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
        
        if (!isCanadaGame(rowText)) {
          return;
        }

        const game = extractGameFromRow($row, rowText, isIIHF);
        if (game) {
          games.push(game);
        }
      });
    });
  }

  // Strategy 2: Look for div-based schedule layouts (common in IIHF)
  if (isIIHF) {
    // IIHF-specific: Look for game/match/fixture containers
    $('[class*="schedule"], [class*="game"], [class*="match"], [class*="event"], [class*="fixture"], [class*="row"]').each((i, elem) => {
      const $elem = $(elem);
      const text = $elem.text();
      
      // Check if this element contains CAN and has date/time info
      if (isCanadaGame(text) && (
        text.match(/\d{1,2}[\/\-]\d{1,2}[\/\-]2026/) || 
        text.match(/(?:feb|february)\s+\d{1,2}/i) || 
        text.match(/\d{1,2}:\d{2}/) ||
        text.match(/\b[A-Z]{3}\s+vs\.?\s+[A-Z]{3}\b/i) // Country codes like "CZE vs CAN"
      )) {
        // Try to extract as if it were a table row
        const cells = $elem.find('div, span, td');
        const game = extractGameFromIIHFTableRow($elem, cells, text, $);
        if (game) {
          games.push(game);
        } else {
          // Fallback to regular extraction
          const game2 = extractGameFromElement($elem, text, isIIHF);
          if (game2) {
            games.push(game2);
          }
        }
      }
    });
    
    // Strategy 2b: Look for team code elements
    $('[data-team], .team-code, [class*="team"], [data-country]').each((i, elem) => {
      const $elem = $(elem);
      const text = $elem.text();
      const parent = $elem.closest('tr, [class*="game"], [class*="match"], [class*="fixture"], [class*="row"], table');
      
      if (parent.length > 0 && isCanadaGame(text)) {
        const parentText = parent.text();
        if (parentText.match(/\d{1,2}[\/\-]\d{1,2}[\/\-]2026/) || 
            parentText.match(/(?:feb|february)\s+\d{1,2}/i) || 
            parentText.match(/\d{1,2}:\d{2}/)) {
          const cells = parent.find('td, div, span');
          const game = extractGameFromIIHFTableRow(parent, cells, parentText, $);
          if (game) {
            games.push(game);
          }
        }
      }
    });
  } else {
    // Non-IIHF parsing
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
    // Also handle country codes like "CAN vs USA" or "CZE vs CAN" for IIHF
    const gamePatterns = [
      /\b([A-Z]{3})\s+vs\.?\s+CAN\b/i,      // "CZE vs CAN" (country codes)
      /\bCAN\s+vs\.?\s+([A-Z]{3})\b/i,      // "CAN vs CZE"
      /\b([A-Z]{3})\s+-\s+CAN\b/i,          // "CZE - CAN"
      /\bCAN\s+-\s+([A-Z]{3})\b/i,          // "CAN - CZE"
      /(?:canada|can\b)\s+vs\.?\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/gi,
      /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+vs\.?\s+(?:canada|can\b)/gi,
      /(?:canada|can\b)\s+v\.?\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/gi,
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
            let opponent = opponentMatch[1];
            
            // If no match[1], try to extract from the full match
            if (!opponent) {
              opponent = opponentMatch[0].replace(/(?:canada|can\b)\s+vs\.?\s+/i, '')
                                         .replace(/\s+vs\.?\s+(?:canada|can\b)/i, '')
                                         .replace(/can\s+vs\.?\s+/i, '')
                                         .replace(/\s+vs\.?\s+can\b/i, '')
                                         .replace(/can\s+-\s+/i, '')
                                         .replace(/\s+-\s+can\b/i, '');
            }
            
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
  
  // Debug: If no games found and it's IIHF, log some sample HTML
  if (uniqueGames.length === 0 && isIIHF) {
    console.log('\n⚠️  DEBUG: No games found from IIHF. Sample HTML structure:');
    // Look for any text containing CAN or dates
    const sampleText = $('body').text().substring(0, 2000);
    const canMatches = sampleText.match(/can[^a-z]*/gi);
    const dateMatches = sampleText.match(/\d{1,2}[\/\-]\d{1,2}[\/\-]2026/g);
    console.log(`  - Text containing CAN: ${canMatches ? canMatches.slice(0, 5).join(', ') : 'none found'}`);
    console.log(`  - Date patterns found: ${dateMatches ? dateMatches.slice(0, 5).join(', ') : 'none found'}`);
    console.log(`  - Total tables found: ${$('table').length}`);
    console.log(`  - Tables with CAN: ${$('table').filter((i, t) => /\bcan\b/i.test($(t).text())).length}`);
  }

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
 * Extract game data from IIHF table row (specialized for IIHF structure)
 */
function extractGameFromIIHFTableRow($row, cells, rowText, $) {
  let dateStr = null;
  let timeStr = null;
  let opponent = null;
  let venue = null;
  let round = 'Preliminary';
  
  // IIHF tables typically have: Date | Time | Team1 | Team2 | Venue | Round
  // Or variations like: Date | Team1 vs Team2 | Time | Venue
  
  // Extract date - look for "Feb 12" or "12/02/2026" or "February 12, 2026"
  // IIHF often uses "Feb 12" or "12 Feb" format
  const datePatterns = [
    /(?:feb|february)\s+(\d{1,2}),?\s+2026/i,  // "Feb 12, 2026" or "February 12 2026"
    /(\d{1,2})\s+(?:feb|february),?\s+2026/i,   // "12 Feb 2026" or "12 February, 2026"
    /(\d{1,2})[\/\-](\d{1,2})[\/\-]2026/,       // "12/02/2026" or "12-02-2026"
    /2026[\/\-](\d{1,2})[\/\-](\d{1,2})/,      // "2026/02/12"
    /(?:feb|february)\s+(\d{1,2})/i            // "Feb 12" (year might be elsewhere)
  ];
  
  for (const pattern of datePatterns) {
    const match = rowText.match(pattern);
    if (match) {
      if (match[1] && !match[2]) {
        // "February 12, 2026" or "Feb 12 2026" or "12 Feb 2026" or "Feb 12"
        dateStr = `${match[1]}/02/2026`;
      } else if (match[1] && match[2]) {
        // "12/02/2026" format - assume DD/MM/YYYY for European dates
        dateStr = `${match[1]}/${match[2]}/2026`;
      } else if (match[2] && match[3]) {
        // "2026/02/12" format
        dateStr = `${match[3]}/${match[2]}/2026`;
      }
      if (dateStr) break;
    }
  }
  
  // If we found "Feb 12" but no year, check if 2026 is mentioned elsewhere in the row
  if (dateStr && !dateStr.includes('2026')) {
    if (rowText.match(/2026/)) {
      // Year is present, just wasn't in the date pattern
      // dateStr should already have it from the pattern, but double-check
    }
  }
  
  // Extract time - look for "HH:MM" format
  const timeMatch = rowText.match(/(\d{1,2}):(\d{2})\s*(am|pm|AM|PM)?/);
  if (timeMatch) {
    timeStr = timeMatch[0];
  }
  
  // Extract opponent - look for country codes (CZE, USA, SWE, etc.) that aren't CAN
  // IIHF format is often "CZE vs CAN" or "CAN vs CZE" or just "CZE - CAN"
  const vsPatterns = [
    /\b([A-Z]{3})\s+vs\.?\s+CAN\b/i,      // "CZE vs CAN"
    /\bCAN\s+vs\.?\s+([A-Z]{3})\b/i,      // "CAN vs CZE"
    /\b([A-Z]{3})\s+-\s+CAN\b/i,          // "CZE - CAN"
    /\bCAN\s+-\s+([A-Z]{3})\b/i,          // "CAN - CZE"
    /\b([A-Z]{3})\s+CAN\b/i,              // "CZE CAN" (adjacent)
    /\bCAN\s+([A-Z]{3})\b/i               // "CAN CZE" (adjacent)
  ];
  
  for (const pattern of vsPatterns) {
    const match = rowText.match(pattern);
    if (match && match[1]) {
      opponent = expandCountryCode(match[1]);
      break;
    }
  }
  
  // Fallback: find all country codes and pick the one that isn't CAN
  if (!opponent) {
    const countryCodes = rowText.match(/\b([A-Z]{3})\b/g);
    if (countryCodes) {
      // Find the code that isn't CAN
      const otherCode = countryCodes.find(code => code !== 'CAN');
      if (otherCode) {
        opponent = expandCountryCode(otherCode);
      }
    }
  }
  
  // Also try to find opponent in cell structure
  if (!opponent && cells.length > 0) {
    // Look for cells containing country codes or team names
    cells.each((i, cell) => {
      const cellText = $(cell).text();
      // Try vs patterns first
      for (const pattern of vsPatterns) {
        const match = cellText.match(pattern);
        if (match && match[1]) {
          opponent = expandCountryCode(match[1]);
          return false; // break
        }
      }
      // Fallback to finding all codes
      const codes = cellText.match(/\b([A-Z]{3})\b/g);
      if (codes) {
        const otherCode = codes.find(code => code !== 'CAN');
        if (otherCode && !opponent) {
          opponent = expandCountryCode(otherCode);
          return false; // break
        }
      }
    });
  }
  
  // Extract venue
  venue = extractVenue(rowText) || 'Milano Cortina 2026';
  
  // Extract round from row text or nearby elements
  const roundText = rowText.toLowerCase();
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
  
  // Check parent elements for round info
  if (round === 'Preliminary') {
    const $parent = $row.closest('table, [class*="round"], [class*="phase"]');
    const parentText = $parent.text().toLowerCase();
    if (parentText.match(/\b(qualifying|qualification|qual)\b/)) {
      round = 'Qualifying';
    } else if (parentText.match(/\b(quarterfinal|quarter-final|qf)\b/)) {
      round = 'Quarterfinal';
    } else if (parentText.match(/\b(semifinal|semi-final|sf)\b/)) {
      round = 'Semifinal';
    } else if (parentText.match(/\b(final|gold|bronze)\b/)) {
      round = 'Final';
    }
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
