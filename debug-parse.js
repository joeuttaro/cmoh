#!/usr/bin/env node

/**
 * Debug script to test parsing without generating ICS
 * Usage: node debug-parse.js [url]
 */

import fetch from 'node-fetch';
import { parseSchedule } from './lib/parse.js';

const url = process.argv[2] || 'https://www.hockeycanada.ca/en-ca/team-canada/men/olympics/2026/stats/schedule';

async function debug() {
  try {
    console.log(`Fetching: ${url}\n`);
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();
    console.log(`HTML length: ${html.length} bytes\n`);
    
    // Save HTML for inspection
    const fs = await import('fs');
    fs.writeFileSync('/tmp/hockey-schedule.html', html);
    console.log('HTML saved to /tmp/hockey-schedule.html for inspection\n');

    const games = parseSchedule(html, url);
    
    console.log(`\n=== PARSING RESULTS ===`);
    console.log(`Found ${games.length} games\n`);
    
    if (games.length === 0) {
      console.log('⚠️  No games found!');
      console.log('\nTroubleshooting:');
      console.log('1. Check /tmp/hockey-schedule.html to see the actual HTML structure');
      console.log('2. The page might use JavaScript to load content (cheerio can\'t handle that)');
      console.log('3. The page structure might have changed');
      console.log('4. Try the IIHF schedule: node debug-parse.js https://www.iihf.com/en/events/2026/olympic-m/schedule');
    } else {
      games.forEach((game, i) => {
        console.log(`${i + 1}. ${game.round}: ${game.dateStr} ${game.timeStr}`);
        console.log(`   Canada vs ${game.opponent}`);
        console.log(`   Venue: ${game.venue}`);
        console.log(`   ID: ${game.id}`);
        console.log('');
      });
    }
    
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

debug();
