const { chromium } = require('playwright');
const { execSync } = require('child_process');

(async () => {
  console.log('Starting Expo Web Server in background...');
  const server = require('child_process').spawn('npx', ['expo', 'start', '--web'], {
    stdio: 'ignore',
    shell: true,
  });

  console.log('Waiting 15 seconds for server to bind...');
  await new Promise(r => setTimeout(r, 15000));

  console.log('Launching browser...');
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('BROWSER ERROR:', err.message));

  console.log('Navigating to http://localhost:8081...');
  try {
    await page.goto('http://localhost:8081', { waitUntil: 'networkidle', timeout: 120000 });
    console.log('Page loaded!');
    
    console.log('HTML Snapshot:');
    const html = await page.content();
    console.log(html.substring(0, 1500)); // Print first 1500 chars

  } catch (err) {
    console.error('Navigation failed:', err);
  } finally {
    await browser.close();
    server.kill();
    process.exit(0);
  }
})();
