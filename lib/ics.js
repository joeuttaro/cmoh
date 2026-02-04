import ical from 'ical-generator';
import { normalizeOpponent } from './parse.js';

/**
 * Convert local Italy time (Europe/Rome) to UTC Date object
 * @param {string} dateStr - Date string (format: "DD/MM/YYYY" or "MM/DD/YYYY")
 * @param {string} timeStr - Time string (format: "HH:MM AM/PM" or "HH:MM")
 * @returns {Date} Date object in UTC
 */
export function parseDateTime(dateStr, timeStr) {
  // Parse date - try multiple formats
  let day, month, year;
  
  // Try DD/MM/YYYY or MM/DD/YYYY
  const dateParts = dateStr.split(/[\/\-]/);
  if (dateParts.length === 3) {
    // Assume format based on first part > 12 (likely day)
    if (parseInt(dateParts[0]) > 12) {
      // DD/MM/YYYY
      day = parseInt(dateParts[0]);
      month = parseInt(dateParts[1]) - 1; // JS months are 0-indexed
      year = parseInt(dateParts[2]);
    } else {
      // MM/DD/YYYY
      month = parseInt(dateParts[0]) - 1;
      day = parseInt(dateParts[1]);
      year = parseInt(dateParts[2]);
    }
  } else {
    throw new Error(`Invalid date format: ${dateStr}`);
  }

  // Parse time
  let hours, minutes;
  const timeMatch = timeStr.match(/(\d{1,2}):(\d{2})\s*(am|pm|AM|PM)?/);
  if (timeMatch) {
    hours = parseInt(timeMatch[1]);
    minutes = parseInt(timeMatch[2]);
    const period = timeMatch[3]?.toLowerCase();
    
    if (period === 'pm' && hours !== 12) {
      hours += 12;
    } else if (period === 'am' && hours === 12) {
      hours = 0;
    }
  } else {
    throw new Error(`Invalid time format: ${timeStr}`);
  }

  // Create date assuming Europe/Rome timezone
  // For February 2026, Italy is in CET (UTC+1, no daylight saving in winter)
  // We'll create a date string and parse it as if it were in Rome timezone
  // Then convert to UTC by subtracting the offset
  
  // February 2026 is in winter, so CET = UTC+1
  const romeOffsetHours = 1;
  
  // Create date as if it were UTC, then adjust
  const localDate = new Date(Date.UTC(year, month, day, hours, minutes));
  // Subtract offset to get UTC (since Rome is UTC+1, we subtract 1 hour)
  const utcDate = new Date(localDate.getTime() - (romeOffsetHours * 60 * 60 * 1000));
  
  return utcDate;
}

/**
 * Generate ICS calendar from game data
 * @param {Array<Object>} games - Array of game objects from parse.js
 * @param {string} sourceUrl - URL of the source schedule page
 * @returns {string} ICS file content
 */
export function generateICS(games, sourceUrl) {
  const calendar = ical({
    prodId: {
      company: 'Olympic Hockey ICS Feed',
      product: 'Canada Men\'s Olympic Hockey Calendar',
      language: 'EN'
    },
    name: 'Canada Men\'s Olympic Hockey (Milano Cortina 2026)',
    timezone: 'Europe/Rome',
    url: sourceUrl,
    source: sourceUrl,
    ttl: ical.TTL.SIX_HOURS
  });

  // Add calendar metadata
  calendar.x('WR-CALNAME', 'Canada Men\'s Olympic Hockey (Milano Cortina 2026)');
  calendar.x('WR-TIMEZONE', 'Europe/Rome');

  // Add each game as an event
  games.forEach((game) => {
    try {
      const startDate = parseDateTime(game.dateStr, game.timeStr);
      // Assume 2h30m duration if not provided
      const endDate = new Date(startDate.getTime() + (2.5 * 60 * 60 * 1000));
      
      const normalizedOpponent = normalizeOpponent(game.opponent);
      const summary = `Canada vs ${normalizedOpponent} (Men's Olympic Hockey)`;
      
      const event = calendar.createEvent({
        uid: game.id + '@olympic-hockey-ics.github.io',
        start: startDate,
        end: endDate,
        summary: summary,
        description: `Men's Olympic Hockey - ${game.round}\n\nOpponent: ${normalizedOpponent}\nVenue: ${game.venue}\n\nSource: ${sourceUrl}`,
        location: `${game.venue}, Milano Cortina 2026`,
        url: sourceUrl,
        status: 'CONFIRMED',
        transp: 'OPAQUE',
        categories: [
          { name: 'Hockey' },
          { name: 'Olympics' }
        ],
        stamp: new Date(), // DTSTAMP
        lastModified: new Date() // LAST-MODIFIED
      });
      
    } catch (error) {
      console.error(`Error creating event for game: ${JSON.stringify(game)}`, error);
    }
  });

  return calendar.toString();
}
