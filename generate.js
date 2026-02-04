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

// Default source URL - can be overridden via SOURCE_URL env var
const SOURCE_URL = process.env.SOURCE_URL || 
  'https://www.hockeycanada.ca/en-ca/team-canada/men/olympics/2026/stats/schedule';

const OUTPUT_DIR = join(__dirname, 'public');
const OUTPUT_FILE = join(OUTPUT_DIR, 'canada-mens-olympic-hockey-2026.ics');

/**
 * Fetch HTML from the source URL
 */
async function fetchSchedule() {
  console.log(`Fetching schedule from: ${SOURCE_URL}`);
  
  try {
    const response = await fetch(SOURCE_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const html = await response.text();
    console.log(`Fetched ${html.length} bytes of HTML`);
    return html;
  } catch (error) {
    console.error('Error fetching schedule:', error);
    throw error;
  }
}

/**
 * Main function to generate the ICS file
 */
async function main() {
  try {
    // Ensure output directory exists
    if (!existsSync(OUTPUT_DIR)) {
      await mkdir(OUTPUT_DIR, { recursive: true });
      console.log(`Created output directory: ${OUTPUT_DIR}`);
    }

    // Fetch and parse schedule
    const html = await fetchSchedule();
    const games = parseSchedule(html);
    
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
    const icsContent = generateICS(games, SOURCE_URL);
    
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
