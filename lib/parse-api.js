import crypto from 'crypto';

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
    'ROC': 'ROC',
    'ITA': 'Italy'
  };
  return codeMap[code] || code;
}

/**
 * Parse IIHF JSON API response and extract Team Canada games
 * @param {Array<Object>} jsonData - JSON array from IIHF API
 * @returns {Array<Object>} Array of game objects
 */
export function parseIIHFAPI(jsonData) {
  const games = [];
  
  console.log(`Parsing ${jsonData.length} games from IIHF API`);
  
  jsonData.forEach((game, index) => {
    // Skip TBD games
    if (game.GameIsTBD || game.Status !== 'UPCOMING') {
      return;
    }
    
    // Check if Canada is playing (either home or guest)
    const homeTeam = game.HomeTeam?.TeamCode;
    const guestTeam = game.GuestTeam?.TeamCode;
    
    if (homeTeam !== 'CAN' && guestTeam !== 'CAN') {
      return; // Not a Canada game
    }
    
    // Determine opponent
    const opponentCode = homeTeam === 'CAN' ? guestTeam : homeTeam;
    if (!opponentCode || opponentCode === 'TBD') {
      return; // Skip TBD opponents
    }
    
    const opponent = expandCountryCode(opponentCode);
    
    // Parse date/time from GameDateTime (ISO format: "2026-02-12T16:40:00")
    // GameDateTime is in local Italy time (GMT+1)
    // GameDateTimeUTC is "2026-02-12T15:40:00Z" (UTC) - use this for accurate timezone handling
    
    // Extract local Italy time for display (DD/MM/YYYY HH:MM format)
    const localMatch = game.GameDateTime.match(/(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/);
    if (!localMatch) {
      console.warn(`Invalid date format for game ${game.GameNumber}: ${game.GameDateTime}`);
      return;
    }
    
    const year = localMatch[1];
    const month = localMatch[2];
    const day = localMatch[3];
    const hour = localMatch[4];
    const minute = localMatch[5];
    
    // Format date as DD/MM/YYYY (local Italy time for display)
    const dateStr = `${day}/${month}/${year}`;
    
    // Format time as HH:MM (24-hour format, local Italy time for display)
    const timeStr = `${hour}:${minute}`;
    
    // Create UTC Date object from GameDateTimeUTC for accurate timezone handling
    // This ensures calendar apps convert to user's local timezone correctly
    const utcDateTime = game.GameDateTimeUTC ? new Date(game.GameDateTimeUTC) : null;
    if (!utcDateTime || isNaN(utcDateTime.getTime())) {
      console.warn(`Invalid UTC date for game ${game.GameNumber}: ${game.GameDateTimeUTC}`);
      return;
    }
    
    // Determine round from PhaseId
    let round = 'Preliminary';
    const phaseId = game.PhaseId || '';
    if (phaseId.includes('Qualification') || phaseId.includes('QualificationPlay-off')) {
      round = 'Qualifying';
    } else if (phaseId.includes('Quarterfinal') || phaseId.includes('Quarter')) {
      round = 'Quarterfinal';
    } else if (phaseId.includes('Semifinal') || phaseId.includes('Semi')) {
      round = 'Semifinal';
    } else if (phaseId.includes('Final') || phaseId.includes('Gold') || phaseId.includes('Bronze')) {
      round = 'Final';
    } else if (phaseId.includes('Preliminary') || phaseId.includes('Prelim')) {
      round = 'Preliminary';
    }
    
    // Extract venue
    const venue = game.Venue || 'Milano Cortina 2026';
    
    // Generate stable ID
    const uidString = `${dateStr}-${timeStr}-${opponent}-${venue}-${round}`;
    const hash = crypto.createHash('md5').update(uidString).digest('hex').substring(0, 12);
    
    games.push({
      id: `mc2026-can-men-${hash}`,
      dateStr,
      timeStr,
      opponent,
      venue,
      round,
      rawText: `${homeTeam} vs ${guestTeam} - ${round}`,
      // Store UTC date for proper timezone handling
      utcDate: utcDateTime
    });
    
    console.log(`  ✓ Game ${game.GameNumber}: ${dateStr} ${timeStr} - ${homeTeam === 'CAN' ? 'CAN' : opponent} vs ${guestTeam === 'CAN' ? 'CAN' : opponent} (${round})`);
  });
  
  console.log(`\nFound ${games.length} Team Canada games from IIHF API`);
  
  return games;
}
