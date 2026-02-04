#!/usr/bin/env node

import fetch from 'node-fetch';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { parseSchedule } from './lib/parse.js';
import { generateICS } from './lib/ics.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Default source URLs - can be overridden via SOURCE_URL env var
// Try Hockey Canada first, fallback to IIHF if needed
const SOURCE_URLS = process.env.SOURCE_URL ? 
  [process.env.SOURCE_URL] : 
  [
    'https://www.hockeycanada.ca/en-ca/team-canada/men/olympics/2026/stats/schedule',
    'https://www.iihf.com/en/events/2026/olympic-m/schedule'
  ];

// Output to root directory for cleaner GitHub Pages URL
// Alternative: use 'public' folder and URL would be /public/canada-mens-olympic-hockey-2026.ics
const OUTPUT_FILE = join(__dirname, 'canada-mens-olympic-hockey-2026.ics');

/**
 * Fetch HTML from the source URL(s)
 */
async function fetchSchedule() {
  let lastError = null;
  
  for (const url of SOURCE_URLS) {
    console.log(`Trying to fetch schedule from: ${url}`);
    
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const html = await response.text();
      console.log(`✓ Fetched ${html.length} bytes of HTML from ${url}`);
      return { html, url };
    } catch (error) {
      console.warn(`✗ Failed to fetch from ${url}: ${error.message}`);
      lastError = error;
      continue; // Try next URL
    }
  }
  
  // If all URLs failed, throw the last error
  throw new Error(`Failed to fetch from all sources. Last error: ${lastError?.message}`);
}

/**
 * Main function to generate the ICS file
 */
async function main() {
  try {
    // Fetch and parse schedule
    const { html, url } = await fetchSchedule();
    const games = parseSchedule(html, url);
    
    console.log(`Found ${games.length} Team Canada games`);
    
    if (games.length === 0) {
      console.warn('WARNING: No games found. The page structure may have changed.');
      console.warn('You may need to update the parsing logic in lib/parse.js');
    } else {
      games.forEach((game, i) => {
        console.log(`  ${i + 1}. ${game.dateStr} ${game.timeStr} vs ${game.opponent} (${game.round})`);
      });
    }

    // Generate ICS
    const icsContent = generateICS(games, url);
    
    // Write to file
    await writeFile(OUTPUT_FILE, icsContent, 'utf-8');
    console.log(`\n✓ ICS file written to: ${OUTPUT_FILE}`);
    console.log(`  File size: ${icsContent.length} bytes`);
    console.log(`  Events: ${games.length}`);
    
  } catch (error) {
    console.error('Error generating ICS:', error);
    process.exit(1);
  }
}

// Run if called directly (not imported)
const isMainModule = import.meta.url === `file://${process.argv[1]}` || 
                     process.argv[1]?.endsWith('generate.js');

if (isMainModule) {
  main();
}

export { main };
