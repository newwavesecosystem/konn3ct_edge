const puppeteer = require('puppeteer');
const fs = require('fs');
async function test() {
  try {
    const browser = await puppeteer.launch({
      executablePath: puppeteer.executablePath(),
      headless: false,
      defaultViewport: null,
      args: [
        '--window-size=1280,720', 
        '--no-sandbox', 
        '--autoplay-policy=no-user-gesture-required',
        '--auto-select-desktop-capture-source=Entire screen', // This bypasses the picker dialog!
        '--enable-usermedia-screen-capturing'
      ]
    });
    const pages = await browser.pages();
    const page = pages[0];
    await page.goto('https://example.com');
    console.log('Starting stream...');

    // Inject recording logic directly into the browser context!
    await page.evaluate(() => {
      return new Promise(async (resolve, reject) => {
        try {
          const stream = await navigator.mediaDevices.getDisplayMedia({
            video: { displaySurface: "browser" },
            audio: true
          });
          const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
          window.recordedChunks = [];
          recorder.ondataavailable = e => {
            if (e.data.size > 0) window.recordedChunks.push(e.data);
          };
          recorder.start();
          window.recorder = recorder;
          resolve();
        } catch (e) {
          reject(e.toString());
        }
      });
    });

    console.log('Stream started!');
    // Record for 5 seconds
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Stop recording and retrieve data
    const base64Data = await page.evaluate(async () => {
      window.recorder.stop();
      return new Promise(resolve => {
        window.recorder.onstop = () => {
          const blob = new Blob(window.recordedChunks, { type: 'video/webm' });
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.readAsDataURL(blob);
        };
      });
    });

    const buffer = Buffer.from(base64Data.split(',')[1], 'base64');
    fs.writeFileSync('test_output.webm', buffer);
    console.log('Saved to test_output.webm!');
    
    await browser.close();
  } catch(e) {
    console.error(e);
    process.exit(1);
  }
}
test();
