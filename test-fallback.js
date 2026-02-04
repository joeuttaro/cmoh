#!/usr/bin/env node

/**
 * Test script to verify fallback games work correctly
 */

import { getFallbackGames } from './generate.js';
import { generateICS } from './lib/ics.js';

const games = getFallbackGames();
console.log(`Fallback games: ${games.length}`);
games.forEach((game, i) => {
  console.log(`  ${i + 1}. ${game.dateStr} ${game.timeStr} vs ${game.opponent} (${game.round})`);
});

console.log('\nGenerating ICS...');
const ics = generateICS(games, 'https://test.example.com');
console.log(`ICS length: ${ics.length} bytes`);

// Count events in ICS
const eventCount = (ics.match(/BEGIN:VEVENT/g) || []).length;
console.log(`Events in ICS: ${eventCount}`);

if (eventCount === 0) {
  console.error('\n❌ ERROR: No events found in ICS!');
  process.exit(1);
} else {
  console.log(`\n✓ Success: ${eventCount} events created`);
}
