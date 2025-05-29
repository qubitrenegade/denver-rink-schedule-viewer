import { RawIceEventData, EventCategory } from '../../src/types.js';
import { BaseScraper } from './base-scraper.js';
import puppeteer from 'puppeteer';

export class BigBearScraper extends BaseScraper {
  get rinkId(): string { return 'big-bear'; }
  get rinkName(): string { return 'Big Bear Ice Arena'; }

  private readonly baseUrl = 'https://bigbearicearena.ezfacility.com';

  protected categorizeBigBearEvent(title: string): EventCategory {
    const titleLower = title.toLowerCase();
    
    if (titleLower.includes('public skate')) return 'Public Skate';
    if (titleLower.includes('freestyle') || titleLower.includes('free style')) return 'Figure Skating';
    if (titleLower.includes('stick') && titleLower.includes('puck')) return 'Stick & Puck';
    if (titleLower.includes('drop-in') || titleLower.includes('drop in')) return 'Drop-In Hockey';
    if (titleLower.includes('party room') || titleLower.includes('hockey party')) return 'Special Event';
    
    return this.categorizeEvent(title);
  }

  // Simple function to convert Mountain Time to UTC
  private convertMTtoUTC(dateStr: string, timeStr: string): Date {
    // Parse date: "2025-05-29"
    const [year, month, day] = dateStr.split('-').map(Number);
    
    // Parse time: "6:00 AM" or "14:30"
    const timeMatch = timeStr.match(/(\d{1,2}):(\d{2})\s*([ap]m)?/i);
    if (!timeMatch) {
      console.warn(`Could not parse time: ${timeStr}`);
      return new Date();
    }
    
    let hours = parseInt(timeMatch[1]);
    const minutes = parseInt(timeMatch[2]);
    const ampm = timeMatch[3]?.toLowerCase();
    
    // Convert to 24-hour format
    if (ampm === 'pm' && hours !== 12) hours += 12;
    if (ampm === 'am' && hours === 12) hours = 0;
    
    // Create UTC date: MT time + 6 hours = UTC time (for MDT)
    const utcDate = new Date(Date.UTC(year, month - 1, day, hours + 6, minutes, 0, 0));
    
    console.log(`   Converting ${timeStr} MT on ${dateStr} -> ${utcDate.toISOString()} UTC`);
    console.log(`   Should display as: ${utcDate.toLocaleString('en-US', {timeZone: 'America/Denver'})} MT`);
    
    return utcDate;
  }

  async scrape(): Promise<RawIceEventData[]> {
    try {
      console.log('🐻 Scraping Big Bear Ice Arena...');
      
      const browser = await puppeteer.launch({
        headless: "new",
        executablePath: '/usr/bin/google-chrome-stable',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--no-first-run',
          '--no-zygote',
          '--single-process',
          '--disable-gpu'
        ]
      });
      
      try {
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
        
        console.log(`📄 Loading: ${this.baseUrl}/Sessions`);
        await page.goto(`${this.baseUrl}/Sessions`, { 
          waitUntil: 'networkidle2', 
          timeout: 30000 
        });
        
        console.log('⏳ Waiting for calendar...');
        await page.waitForSelector('#calendar', { timeout: 15000 });
        await page.waitForTimeout(3000);
        
        console.log('💾 Dumping HTML for debugging...');
        const htmlContent = await page.content();
        
        // Save HTML to a file for inspection
        const fs = await import('fs/promises');
        const path = await import('path');
        const htmlPath = path.join(process.cwd(), 'debug-bigbear.html');
        await fs.writeFile(htmlPath, htmlContent);
        console.log(`📁 HTML saved to: ${htmlPath}`);
        
        // Also get just the calendar section
        const calendarHTML = await page.$eval('#calendar', (el) => el.outerHTML).catch(() => 'Calendar not found');
        const calendarPath = path.join(process.cwd(), 'debug-bigbear-calendar.html');
        await fs.writeFile(calendarPath, calendarHTML);
        console.log(`📁 Calendar HTML saved to: ${calendarPath}`);
        
        console.log('🔍 Extracting events...');
        
        // Simple DOM extraction - look for event elements and their times
        const eventData = await page.evaluate(() => {
          const events: any[] = [];
          
          // Debug: Check what selectors actually exist
          const possibleSelectors = [
            '.fc-event',
            '.fc-day-grid-event', 
            '.fc-list-item',
            '[class*="event"]',
            '[class*="fc-"]',
            '.event',
            'a[href*="event"]'
          ];
          
          console.log('=== DEBUGGING SELECTORS ===');
          possibleSelectors.forEach(selector => {
            const elements = document.querySelectorAll(selector);
            console.log(`${selector}: ${elements.length} elements`);
            if (elements.length > 0 && elements.length < 10) {
              // Show sample of what we found
              Array.from(elements).slice(0, 3).forEach((el, i) => {
                console.log(`  [${i}] ${el.className} - "${(el.textContent || '').substring(0, 50)}..."`);
              });
            }
          });
          
          // Look for ANY elements that might contain time information
          console.log('\n=== LOOKING FOR TIME PATTERNS ===');
          const allElements = document.querySelectorAll('*');
          let elementsWithTimes = 0;
          Array.from(allElements).forEach((el, index) => {
            const text = el.textContent || '';
            if (text.match(/\d{1,2}:\d{2}\s*[ap]m/i) && el.children.length === 0) {
              // This element contains time and has no children (leaf node)
              console.log(`Element with time: ${el.tagName}.${el.className} - "${text.substring(0, 100)}"`);
              elementsWithTimes++;
              if (elementsWithTimes > 10) return; // Don't spam too much
            }
          });
          
          console.log(`\nFound ${elementsWithTimes} elements containing time patterns`);
          
          // Try the original approach but with more debugging
          const eventElements = document.querySelectorAll('.fc-event, .fc-day-grid-event, .fc-list-item');
          console.log(`\n=== PROCESSING ${eventElements.length} EVENT ELEMENTS ===`);
          
          return []; // Return empty for now, just want to see the debugging output
        });
        
        console.log(`🎯 Found ${eventData.length} raw events (debug mode - returning early)`);
        
        // For now, return empty so we can examine the HTML files
        console.log('🔍 Check the HTML files to understand the page structure!');
        return [];
        
      } finally {
        await browser.close();
      }
      
    } catch (error) {
      console.error('❌ Big Bear scraping failed:', error);
      return [];
    }
  }
}
