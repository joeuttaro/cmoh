#!/usr/bin/env node

import fetch from 'node-fetch';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import crypto from 'crypto';
import { parseSchedule } from './lib/parse.js';
import { generateICS } from './lib/ics.js';
import { fetchWithPuppeteer } from './lib/fetch-with-puppeteer.js';
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
 * Fetch HTML from the source URL(s) - try regular fetch first, then Puppeteer
 */
async function fetchSchedule() {
  let lastError = null;
  
  // First, try regular fetch (faster)
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
  
  // If regular fetch failed, try Puppeteer (handles JavaScript-rendered content)
  console.log('\nRegular fetch failed, trying Puppeteer for JavaScript-rendered content...');
  for (const url of SOURCE_URLS) {
    try {
      return await fetchWithPuppeteer(url);
    } catch (error) {
      console.warn(`✗ Puppeteer failed for ${url}: ${error.message}`);
      lastError = error;
      continue;
    }
  }
  
  // If all methods failed, throw the last error
  throw new Error(`Failed to fetch from all sources. Last error: ${lastError?.message}`);
}

/**
 * Main function to generate the ICS file
 */
async function main() {
  try {
    // Fetch and parse schedule
    let games = [];
    let url = SOURCE_URLS[0];
    
    try {
      const result = await fetchSchedule();
      games = parseSchedule(result.html, result.url);
      url = result.url;
      console.log(`Found ${games.length} Team Canada games from scraping`);
    } catch (error) {
      console.error('Failed to fetch schedule:', error.message);
      games = [];
    }
    
    // If scraping found no games, use fallback
    if (games.length === 0) {
      console.warn('WARNING: No games found from scraping.');
      console.warn('Using fallback: Manual game data');
      console.warn('Please update getFallbackGames() in generate.js with actual schedule when available');
      games = getFallbackGames();
      url = 'https://www.hockeycanada.ca/en-ca/team-canada/men/olympics/2026/stats/schedule';
    }
    
    if (games.length > 0) {
      games.forEach((game, i) => {
        console.log(`  ${i + 1}. ${game.round}: ${game.dateStr} ${game.timeStr} vs ${game.opponent}`);
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

/**
 * Fallback game data - use if scraping fails
 * Update this with actual schedule when available
 * Format: Preliminary round games for Team Canada Men's Hockey
 * 
 * NOTE: These are placeholder games. Update with actual schedule when published.
 * The schedule will be available closer to the Olympics (typically 6-12 months before).
 */
function getFallbackGames() {
  // These are placeholder dates - update with actual schedule when published
  // Milano Cortina 2026 runs Feb 6-22, 2026
  // Preliminary round typically Feb 6-11
  const games = [
    {
      dateStr: '06/02/2026',
      timeStr: '20:00',
      opponent: 'TBD',
      venue: 'Milano Cortina 2026',
      round: 'Preliminary',
      rawText: 'Canada vs TBD - Preliminary Round'
    },
    {
      dateStr: '08/02/2026',
      timeStr: '20:00',
      opponent: 'TBD',
      venue: 'Milano Cortina 2026',
      round: 'Preliminary',
      rawText: 'Canada vs TBD - Preliminary Round'
    },
    {
      dateStr: '10/02/2026',
      timeStr: '20:00',
      opponent: 'TBD',
      venue: 'Milano Cortina 2026',
      round: 'Preliminary',
      rawText: 'Canada vs TBD - Preliminary Round'
    }
  ];
  
  // Generate stable IDs
  return games.map((game) => {
    const uidString = `${game.dateStr}-${game.timeStr}-${game.opponent}-${game.venue}-${game.round}`;
    const hash = crypto.createHash('md5').update(uidString).digest('hex').substring(0, 12);
    return {
      ...game,
      id: `mc2026-can-men-${hash}`
    };
  });
}

// Run if called directly (not imported)
const isMainModule = import.meta.url === `file://${process.argv[1]}` || 
                     process.argv[1]?.endsWith('generate.js');

if (isMainModule) {
  main();
}

export { main };
