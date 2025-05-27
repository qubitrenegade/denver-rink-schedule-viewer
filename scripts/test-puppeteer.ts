#!/usr/bin/env bun

import puppeteer from 'puppeteer';

async function testPuppeteer() {
  console.log('🧪 Testing Puppeteer setup...');
  
  try {
    const browser = await puppeteer.launch({
      headless: "new", // Use new headless mode
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-gpu'
      ]
    });
    
    console.log('✅ Browser launched successfully');
    
    const page = await browser.newPage();
    await page.goto('https://bigbearicearena.ezfacility.com/Sessions', { 
      waitUntil: 'networkidle2',
      timeout: 15000 
    });
    
    console.log('✅ Page loaded successfully');
    
    const title = await page.title();
    console.log(`📄 Page title: ${title}`);
    
    // Check if calendar element exists
    const calendarExists = await page.$('#calendar') !== null;
    console.log(`📅 Calendar element found: ${calendarExists}`);
    
    // Check for script elements
    const scriptCount = await page.$$eval('script', scripts => scripts.length);
    console.log(`📜 Found ${scriptCount} script elements`);
    
    await browser.close();
    console.log('✅ Test completed successfully!');
    console.log('🎯 Puppeteer is ready for Big Bear scraping');
    
  } catch (error) {
    console.error('❌ Puppeteer test failed:', error);
    process.exit(1);
  }
}

await testPuppeteer();
