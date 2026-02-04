#!/usr/bin/env node

/**
 * Simple test to verify ICS generation works
 */

import crypto from 'crypto';
import { generateICS } from './lib/ics.js';

// Create a simple test game
const testGame = {
  id: 'mc2026-can-men-test123',
  dateStr: '06/02/2026',
  timeStr: '20:00',
  opponent: 'Test Team',
  venue: 'Test Venue',
  round: 'Preliminary',
  rawText: 'Test game'
};

console.log('Test game:', testGame);
console.log('\nGenerating ICS...');

try {
  const ics = generateICS([testGame], 'https://test.example.com');
  console.log(`ICS length: ${ics.length} bytes`);
  
  // Count events
  const eventCount = (ics.match(/BEGIN:VEVENT/g) || []).length;
  console.log(`Events found: ${eventCount}`);
  
  if (eventCount === 0) {
    console.error('\n❌ ERROR: No events in ICS!');
    console.log('\nFirst 1000 chars of ICS:');
    console.log(ics.substring(0, 1000));
    process.exit(1);
  } else {
    console.log('\n✓ Success! Events created.');
    // Show a snippet of an event
    const eventMatch = ics.match(/BEGIN:VEVENT[\s\S]{1,500}END:VEVENT/);
    if (eventMatch) {
      console.log('\nSample event:');
      console.log(eventMatch[0]);
    }
  }
} catch (error) {
  console.error('Error:', error);
  console.error('Stack:', error.stack);
  process.exit(1);
}
