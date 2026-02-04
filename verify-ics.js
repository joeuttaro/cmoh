#!/usr/bin/env node

/**
 * Simple verification script to check if ICS file has events
 */

import { readFileSync } from 'fs';

const icsFile = 'canada-mens-olympic-hockey-2026.ics';

try {
  const content = readFileSync(icsFile, 'utf-8');
  const eventCount = (content.match(/BEGIN:VEVENT/g) || []).length;
  
  console.log(`ICS file: ${icsFile}`);
  console.log(`File size: ${content.length} bytes`);
  console.log(`Events found: ${eventCount}`);
  
  if (eventCount === 0) {
    console.error('\n❌ ERROR: ICS file contains 0 events!');
    console.log('\nFile content:');
    console.log(content);
    process.exit(1);
  } else {
    console.log(`\n✓ Success: ICS file contains ${eventCount} events`);
    
    // Show first event
    const firstEvent = content.match(/BEGIN:VEVENT[\s\S]{1,300}END:VEVENT/);
    if (firstEvent) {
      console.log('\nFirst event:');
      console.log(firstEvent[0]);
    }
  }
} catch (error) {
  console.error(`Error reading ${icsFile}:`, error.message);
  process.exit(1);
}
