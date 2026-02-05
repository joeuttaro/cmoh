#!/usr/bin/env node

import fetch from 'node-fetch';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import crypto from 'crypto';
import { parseSchedule } from './lib/parse.js';
import { parseIIHFAPI } from './lib/parse-api.js';
import { generateICS } from './lib/ics.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Optional Puppeteer import (only if available)
async function getPuppeteerFetcher() {
  try {
    const puppeteerModule = await import('./lib/fetch-with-puppeteer.js');
    return puppeteerModule.fetchWithPuppeteer;
  } catch (error) {
    return null;
  }
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// IIHF JSON API endpoint - much more reliable than HTML scraping
const IIHF_API_URL = process.env.IIHF_API_URL || 'https://realtime.iihf.com/gamestate/GetLatestScoresState/991';

// Fallback HTML sources (if API fails)
const FALLBACK_URLS = process.env.SOURCE_URL ? 
  [process.env.SOURCE_URL] : 
  [
    'https://www.iihf.com/en/events/2026/olympic-m/schedule',
    'https://www.hockeycanada.ca/en-ca/team-canada/men/olympics/2026/stats/schedule'
  ];

// Output to root directory for cleaner GitHub Pages URL
// Alternative: use 'public' folder and URL would be /public/canada-mens-olympic-hockey-2026.ics
const OUTPUT_FILE = join(__dirname, 'canada-mens-olympic-hockey-2026.ics');

/**
 * Fetch schedule from IIHF JSON API (primary) or fallback to HTML scraping
 */
async function fetchSchedule() {
  // Try IIHF JSON API first (most reliable)
  console.log(`Fetching schedule from IIHF API: ${IIHF_API_URL}`);
  
  try {
    const response = await fetch(IIHF_API_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const jsonData = await response.json();
    console.log(`✓ Fetched ${jsonData.length} games from IIHF API`);
    
    // Return as JSON data (not HTML)
    return { jsonData, url: IIHF_API_URL, source: 'api' };
  } catch (error) {
    console.warn(`✗ Failed to fetch from IIHF API: ${error.message}`);
    console.warn('Falling back to HTML scraping...');
    
    // Fallback to HTML scraping
    let lastError = error;
    
    for (const url of FALLBACK_URLS) {
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
        return { html, url, source: 'html' };
      } catch (error) {
        console.warn(`✗ Failed to fetch from ${url}: ${error.message}`);
        lastError = error;
        continue;
      }
    }
    
    // If regular fetch failed, try Puppeteer
    const fetchWithPuppeteer = await getPuppeteerFetcher();
    if (fetchWithPuppeteer) {
      console.log('\nTrying Puppeteer for JavaScript-rendered content...');
      for (const url of FALLBACK_URLS) {
        try {
          return await fetchWithPuppeteer(url);
        } catch (error) {
          console.warn(`✗ Puppeteer failed for ${url}: ${error.message}`);
          lastError = error;
          continue;
        }
      }
    }
    
    throw new Error(`Failed to fetch from all sources. Last error: ${lastError?.message}`);
  }
}

/**
 * Main function to generate the ICS file
 */
async function main() {
  try {
    // Fetch and parse schedule
    let games = [];
    let url = SOURCE_URLS[0];
    let useFallback = false;
    
    try {
      const result = await fetchSchedule();
      
      if (result.source === 'api' && result.jsonData) {
        // Parse JSON API response
        console.log('Parsing IIHF JSON API data...');
        games = parseIIHFAPI(result.jsonData);
        url = IIHF_API_URL;
        console.log(`Found ${games.length} Team Canada games from IIHF API`);
        
        if (games.length === 0) {
          console.warn('API returned data but found 0 Canada games');
          useFallback = true;
        }
      } else {
        // Parse HTML (fallback)
        games = parseSchedule(result.html, result.url);
        url = result.url;
        console.log(`Found ${games.length} Team Canada games from HTML scraping`);
        
        if (games.length === 0) {
          console.warn('Scraping succeeded but found 0 games');
          useFallback = true;
        }
      }
    } catch (error) {
      console.error('Failed to fetch schedule:', error.message);
      console.error('Will use fallback games');
      useFallback = true;
    }
    
    // If scraping found no games, use fallback
    if (games.length === 0 || useFallback) {
      console.warn('\n⚠️  WARNING: No games found from scraping.');
      console.warn('This could mean:');
      console.warn('  1. The schedule has not been published yet (check IIHF website)');
      console.warn('  2. The page structure has changed (parser may need updates)');
      console.warn('  3. The page requires JavaScript that Puppeteer couldn\'t handle');
      console.warn('\nUsing fallback: Manual game data (placeholder dates/opponents)');
      console.warn('⚠️  IMPORTANT: Update getFallbackGames() in generate.js with actual schedule when available\n');
      
      try {
        games = getFallbackGames();
        console.log(`Fallback: Retrieved ${games.length} placeholder games`);
        console.log('NOTE: These are placeholder games with TBD opponents. Update with real schedule!');
        
        if (games.length === 0) {
          throw new Error('getFallbackGames() returned empty array!');
        }
        
        // Use IIHF API URL for fallback since that's our primary source
        url = IIHF_API_URL;
      } catch (error) {
        console.error(`❌ FATAL: Failed to get fallback games: ${error.message}`);
        throw error;
      }
    }
    
    if (games.length > 0) {
      console.log(`\nGames to add to calendar:`);
      games.forEach((game, i) => {
        console.log(`  ${i + 1}. ${game.round}: ${game.dateStr} ${game.timeStr} vs ${game.opponent}`);
      });
    } else {
      console.error('\n❌ ERROR: No games available (scraping failed and fallback is empty)!');
      process.exit(1);
    }

    // Generate ICS
    console.log(`\nGenerating ICS file with ${games.length} events...`);
    let icsContent;
    try {
      icsContent = generateICS(games, url);
    } catch (error) {
      console.error(`\n❌ FATAL ERROR in generateICS: ${error.message}`);
      console.error(`Stack: ${error.stack}`);
      process.exit(1);
    }
    
    // Verify events were created
    const eventCount = (icsContent.match(/BEGIN:VEVENT/g) || []).length;
    console.log(`ICS file generated: ${icsContent.length} bytes`);
    console.log(`Events found in ICS: ${eventCount}`);
    
    if (eventCount === 0) {
      console.error(`\n❌ CRITICAL ERROR: ICS file generated but contains 0 events!`);
      console.error(`Games passed to generateICS: ${games.length}`);
      console.error(`This indicates an error in event creation.`);
      console.error(`\nFirst 500 chars of ICS file:`);
      console.error(icsContent.substring(0, 500));
      console.error(`\nLast 500 chars of ICS file:`);
      console.error(icsContent.substring(Math.max(0, icsContent.length - 500)));
      process.exit(1);
    }
    
    if (eventCount !== games.length) {
      console.warn(`\n⚠️  WARNING: Expected ${games.length} events but found ${eventCount} in ICS file`);
    } else {
      console.log(`✓ Success: All ${eventCount} events created in ICS file`);
    }
    
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
export function getFallbackGames() {
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
