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
    const part1 = parseInt(dateParts[0]);
    const part2 = parseInt(dateParts[1]);
    const part3 = parseInt(dateParts[2]);
    
    // Determine format: if first part > 12, it must be DD/MM/YYYY
    // If both parts <= 12, prefer DD/MM/YYYY for European dates (more common for Olympics in Italy)
    // But if part1 <= 12 and part2 > 12, it must be MM/DD/YYYY
    if (part1 > 12) {
      // Definitely DD/MM/YYYY (e.g., 25/02/2026)
      day = part1;
      month = part2 - 1; // JS months are 0-indexed
      year = part3;
    } else if (part2 > 12) {
      // Definitely MM/DD/YYYY (e.g., 02/25/2026)
      month = part1 - 1;
      day = part2;
      year = part3;
    } else {
      // Ambiguous: both <= 12 (e.g., 06/02/2026)
      // For Olympics in Italy, assume DD/MM/YYYY format
      day = part1;
      month = part2 - 1;
      year = part3;
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
  
  // Validate the parsed values
  if (isNaN(year) || isNaN(month) || isNaN(day) || isNaN(hours) || isNaN(minutes)) {
    throw new Error(`Invalid parsed values: year=${year}, month=${month}, day=${day}, hours=${hours}, minutes=${minutes}`);
  }
  
  if (month < 0 || month > 11) {
    throw new Error(`Invalid month: ${month + 1} (parsed from date: ${dateStr})`);
  }
  
  if (day < 1 || day > 31) {
    throw new Error(`Invalid day: ${day} (parsed from date: ${dateStr})`);
  }
  
  if (hours < 0 || hours > 23) {
    throw new Error(`Invalid hours: ${hours} (parsed from time: ${timeStr})`);
  }
  
  if (minutes < 0 || minutes > 59) {
    throw new Error(`Invalid minutes: ${minutes} (parsed from time: ${timeStr})`);
  }
  
  // Create date as if it were UTC, then adjust
  const localDate = new Date(Date.UTC(year, month, day, hours, minutes));
  
  // Validate the created date
  if (isNaN(localDate.getTime())) {
    throw new Error(`Invalid date created: year=${year}, month=${month + 1}, day=${day}, hours=${hours}, minutes=${minutes}`);
  }
  
  // Subtract offset to get UTC (since Rome is UTC+1, we subtract 1 hour)
  const utcDate = new Date(localDate.getTime() - (romeOffsetHours * 60 * 60 * 1000));
  
  if (isNaN(utcDate.getTime())) {
    throw new Error(`Invalid UTC date created from local date: ${localDate.toISOString()}`);
  }
  
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
    source: sourceUrl
    // TTL removed - not available in this version of ical-generator
  });

  // Add calendar metadata
  calendar.x('WR-CALNAME', 'Canada Men\'s Olympic Hockey (Milano Cortina 2026)');
  calendar.x('WR-TIMEZONE', 'Europe/Rome');

  // Add each game as an event
  let eventsCreated = 0;
  let errors = [];
  
  if (games.length === 0) {
    console.error('ERROR: generateICS called with empty games array!');
    throw new Error('Cannot generate ICS calendar with no games');
  }
  
  console.log(`Creating ${games.length} events...`);
  
  games.forEach((game, index) => {
    try {
      console.log(`  Processing game ${index + 1}/${games.length}: ${game.dateStr} ${game.timeStr} vs ${game.opponent}`);
      
      const startDate = parseDateTime(game.dateStr, game.timeStr);
      console.log(`    Parsed date: ${startDate.toISOString()}`);
      
      // Assume 2h30m duration if not provided
      const endDate = new Date(startDate.getTime() + (2.5 * 60 * 60 * 1000));
      
      const normalizedOpponent = normalizeOpponent(game.opponent);
      const summary = `Canada vs ${normalizedOpponent} (Men's Olympic Hockey)`;
      
      console.log(`    Creating event: ${summary}`);
      
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
      
      eventsCreated++;
      console.log(`    ✓ Event created successfully`);
    } catch (error) {
      const errorMsg = `Error creating event ${index + 1} (${game.dateStr} ${game.timeStr} vs ${game.opponent}): ${error.message}`;
      console.error(`    ❌ ${errorMsg}`);
      console.error(`    Stack: ${error.stack}`);
      errors.push(errorMsg);
    }
  });
  
  console.log(`\nEvents created: ${eventsCreated}/${games.length}`);
  
  if (eventsCreated === 0) {
    const errorMsg = `Failed to create any events from ${games.length} games! Errors: ${errors.join('; ')}`;
    console.error(`\n❌ ${errorMsg}`);
    throw new Error(errorMsg);
  }
  
  if (errors.length > 0) {
    console.warn(`\n⚠️  Warning: ${errors.length} events failed to create, but ${eventsCreated} succeeded`);
  }

  return calendar.toString();
}
