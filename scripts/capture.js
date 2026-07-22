const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  // Set viewport
  await page.setViewport({ width: 1280, height: 800 });
  
  const baseUrl = 'http://localhost:3000';
  
  try {
    // 1. Dashboard
    await page.goto(`${baseUrl}/dashboard`, { waitUntil: 'networkidle2' });
    // Wait for spinner to disappear
    try { await page.waitForSelector('.spinner', { hidden: true, timeout: 5000 }); } catch (e) {}
    await new Promise(r => setTimeout(r, 1000));
    await page.screenshot({ path: 'public/manual-dashboard.png' });
    console.log('Dashboard captured');
    
    // 2. Votes
    await page.goto(`${baseUrl}/votes`, { waitUntil: 'networkidle2' });
    try { await page.waitForSelector('.spinner', { hidden: true, timeout: 5000 }); } catch (e) {}
    await new Promise(r => setTimeout(r, 1000));
    await page.screenshot({ path: 'public/manual-votes.png' });
    console.log('Votes captured');
    
    // 3. Stats
    await page.goto(`${baseUrl}/stats`, { waitUntil: 'networkidle2' });
    try { await page.waitForSelector('.spinner', { hidden: true, timeout: 5000 }); } catch (e) {}
    await new Promise(r => setTimeout(r, 1000));
    await page.screenshot({ path: 'public/manual-stats.png' });
    console.log('Stats captured');
    
    // 4. Members
    await page.goto(`${baseUrl}/members`, { waitUntil: 'networkidle2' });
    try { await page.waitForSelector('.spinner', { hidden: true, timeout: 5000 }); } catch (e) {}
    await new Promise(r => setTimeout(r, 1000));
    await page.screenshot({ path: 'public/manual-members.png' });
    console.log('Members captured');
    
  } catch (err) {
    console.error(err);
  } finally {
    await browser.close();
  }
})();
