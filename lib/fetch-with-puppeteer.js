import puppeteer from 'puppeteer';

/**
 * Fetch HTML from a URL using Puppeteer to handle JavaScript-rendered content
 * @param {string} url - URL to fetch
 * @returns {Promise<{html: string, url: string}>}
 */
export async function fetchWithPuppeteer(url) {
  console.log(`Fetching with Puppeteer: ${url}`);
  
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'] // Needed for GitHub Actions
  });
  
  try {
    const page = await browser.newPage();
    
    // Set a realistic user agent
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // Navigate to the page
    await page.goto(url, {
      waitUntil: 'networkidle2', // Wait for network to be idle
      timeout: 30000
    });
    
    // Wait a bit more for any lazy-loaded content
    await page.waitForTimeout(2000);
    
    // Get the rendered HTML
    const html = await page.content();
    
    console.log(`✓ Fetched ${html.length} bytes with Puppeteer`);
    
    return { html, url };
  } finally {
    await browser.close();
  }
}
