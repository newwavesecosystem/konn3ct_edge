const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ['--window-size=1920,1080', '--autoplay-policy=no-user-gesture-required']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  await page.goto(process.argv[2], { waitUntil: 'networkidle0' });
  
  // Wait a few seconds
  await new Promise(r => setTimeout(r, 5000));
  
  await page.screenshot({ path: 'screenshot.png' });
  console.log('Screenshot saved to screenshot.png');
  await browser.close();
})();
