import puppeteer from 'puppeteer';

(async () => {
  try {
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    
    page.on('console', msg => {
      console.log('BROWSER LOG:', msg.type().toUpperCase(), msg.text());
    });
    
    page.on('pageerror', err => {
      console.log('BROWSER ERROR:', err.toString());
    });

    console.log('Navigating to http://localhost:5173/');
    await page.goto('http://localhost:5173/', { waitUntil: 'networkidle2' });
    
    console.log('Waiting for #start-button');
    await page.waitForSelector('#start-button', { timeout: 5000 });
    
    console.log('Clicking #start-button');
    await page.click('#start-button');
    
    console.log('Waiting 3 seconds to capture post-click logs...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    await browser.close();
    console.log('Done.');
  } catch (err) {
    console.error('SCRIPT ERROR:', err);
  }
})();
