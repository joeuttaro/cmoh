#!/usr/bin/env node

/**
 * End-to-end test: Simulate the exact flow from generate.js
 */

import { getFallbackGames } from './generate.js';
import { generateICS } from './lib/ics.js';
import { writeFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const OUTPUT_FILE = join(__dirname, 'test-output.ics');

async function test() {
  console.log('=== End-to-End Test ===\n');
  
  // Step 1: Get fallback games
  console.log('Step 1: Getting fallback games...');
  const games = getFallbackGames();
  console.log(`✓ Got ${games.length} games`);
  games.forEach((g, i) => {
    console.log(`  ${i + 1}. ${g.dateStr} ${g.timeStr} vs ${g.opponent}`);
  });
  
  if (games.length === 0) {
    console.error('❌ ERROR: No fallback games!');
    process.exit(1);
  }
  
  // Step 2: Generate ICS
  console.log('\nStep 2: Generating ICS...');
  let icsContent;
  try {
    icsContent = generateICS(games, 'https://test.example.com');
    console.log(`✓ ICS generated: ${icsContent.length} bytes`);
  } catch (error) {
    console.error(`❌ ERROR generating ICS: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  }
  
  // Step 3: Check for events
  console.log('\nStep 3: Checking for events...');
  const eventCount = (icsContent.match(/BEGIN:VEVENT/g) || []).length;
  console.log(`Events found: ${eventCount}`);
  
  if (eventCount === 0) {
    console.error('\n❌ ERROR: No events in ICS!');
    console.log('\nFirst 1000 chars:');
    console.log(icsContent.substring(0, 1000));
    process.exit(1);
  }
  
  // Step 4: Write file
  console.log('\nStep 4: Writing test file...');
  await writeFile(OUTPUT_FILE, icsContent, 'utf-8');
  console.log(`✓ Written to ${OUTPUT_FILE}`);
  
  console.log('\n=== Test Passed! ===');
  console.log(`✓ ${eventCount} events created successfully`);
}

test().catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});
