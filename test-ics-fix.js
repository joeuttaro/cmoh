// Simple test to verify ICS generation works
const ical = require('ical-generator');
const crypto = require('crypto');

// Simulate a game (WM 2026 — May, CEST = UTC+2 for local→UTC in this legacy test harness)
const game = {
  id: 'wm2026-can-men-test123',
  dateStr: '15/05/2026',
  timeStr: '16:20',
  opponent: 'Test Team',
  venue: 'Test Venue',
  round: 'Preliminary'
};

// Parse date (simplified version)
const dateParts = game.dateStr.split('/');
const day = parseInt(dateParts[0]);
const month = parseInt(dateParts[1]) - 1;
const year = parseInt(dateParts[2]);
const timeParts = game.timeStr.split(':');
const hours = parseInt(timeParts[0]);
const minutes = parseInt(timeParts[1]);

// Create UTC date (CEST = UTC+2, so subtract 2 hours)
const localDate = new Date(Date.UTC(year, month, day, hours, minutes));
const startDate = new Date(localDate.getTime() - (2 * 60 * 60 * 1000));
const endDate = new Date(startDate.getTime() + (2.5 * 60 * 60 * 1000));

// Create calendar
const calendar = ical({
  prodId: {
    company: 'Team Canada Hockey ICS Feed',
    product: 'Canada Men\'s World Championship Calendar',
    language: 'EN'
  },
  name: 'Canada Men\'s Hockey (IIHF World Championship 2026)',
  timezone: 'Europe/Zurich',
  url: 'https://test.example.com',
  source: 'https://test.example.com'
});

// Add calendar metadata with X- prefix
try {
  calendar.x('X-WR-CALNAME', 'Canada Men\'s Hockey (IIHF World Championship 2026)');
  calendar.x('X-WR-TIMEZONE', 'Europe/Zurich');
  console.log('✓ Custom properties added successfully');
} catch (error) {
  console.error('❌ Error adding custom properties:', error.message);
  process.exit(1);
}

// Create event
try {
  const event = calendar.createEvent({
    uid: game.id + '@worlds-hockey-ics.github.io',
    start: startDate,
    end: endDate,
    summary: `Canada vs ${game.opponent} (Men's Worlds 2026)`,
    description: `IIHF Men's World Championship 2026 - ${game.round}\n\nOpponent: ${game.opponent}\nVenue: ${game.venue}`,
    location: `${game.venue}, IIHF WM 2026`,
    url: 'https://test.example.com',
    status: 'CONFIRMED',
    transp: 'OPAQUE',
    categories: [{ name: 'Hockey' }, { name: 'IIHF World Championship' }],
    stamp: new Date(),
    lastModified: new Date()
  });
  console.log('✓ Event created successfully');
} catch (error) {
  console.error('❌ Error creating event:', error.message);
  process.exit(1);
}

// Generate ICS
try {
  const ics = calendar.toString();
  const eventCount = (ics.match(/BEGIN:VEVENT/g) || []).length;
  
  console.log(`✓ ICS generated: ${ics.length} bytes`);
  console.log(`✓ Events in ICS: ${eventCount}`);
  
  if (eventCount === 0) {
    console.error('❌ ERROR: No events in ICS!');
    process.exit(1);
  }
  
  // Check for X-WR-CALNAME
  if (ics.includes('X-WR-CALNAME')) {
    console.log('✓ X-WR-CALNAME found in ICS');
  } else {
    console.error('❌ ERROR: X-WR-CALNAME not found in ICS!');
    process.exit(1);
  }
  
  console.log('\n✅ All tests passed!');
} catch (error) {
  console.error('❌ Error generating ICS:', error.message);
  process.exit(1);
}
