const { launch, getStream } = require('puppeteer-stream');
const fs = require('fs');
async function test() {
  try {
    const browser = await launch({
      executablePath: require('puppeteer').executablePath(),
      headless: false,
      defaultViewport: { width: 1280, height: 720 },
      args: ['--window-size=1280,720', '--no-sandbox', '--autoplay-policy=no-user-gesture-required', '--disable-gpu']
    });
    const pages = await browser.pages();
    const page = pages[0];
    await page.bringToFront();
    await page.goto('https://example.com');
    console.log('Starting stream...');
    const stream = await getStream(page, { audio: true, video: true });
    console.log('Stream started!');
    stream.destroy();
    await browser.close();
  } catch(e) {
    console.error(e);
    process.exit(1);
  }
}
test();
