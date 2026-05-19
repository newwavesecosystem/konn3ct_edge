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
        '--auto-select-tab-capture-source-by-title=TestPageTitle',
        '--enable-usermedia-screen-capturing'
      ]
    });
    
    const pages = await browser.pages();
    const page = pages[0];
    
    // Set a unique title so we can auto-select it!
    await page.evaluate(() => { document.title = 'TestPageTitle'; });
    await page.goto('https://example.com');
    await page.evaluate(() => { document.title = 'TestPageTitle'; }); // Reset in case navigation changed it
    
    console.log('Starting stream...');

    const fileStream = fs.createWriteStream('test_stream.webm');

    // Expose a function to write chunks to the file stream
    await page.exposeFunction('writeChunk', (chunkStr) => {
      // Decode base64 to buffer and write
      const buffer = Buffer.from(chunkStr, 'base64');
      fileStream.write(buffer);
    });

    // Inject recording logic directly into the browser context!
    await page.evaluate(() => {
      return new Promise(async (resolve, reject) => {
        try {
          const stream = await navigator.mediaDevices.getDisplayMedia({
            video: { displaySurface: "browser" },
            audio: true
          });
          const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
          recorder.ondataavailable = async (e) => {
            if (e.data.size > 0) {
              // Convert blob to base64
              const reader = new FileReader();
              reader.onloadend = async () => {
                const base64 = reader.result.split(',')[1];
                await window.writeChunk(base64);
              };
              reader.readAsDataURL(e.data);
            }
          };
          recorder.start(1000); // Send chunks every second
          window.recorder = recorder;
          resolve();
        } catch (e) {
          reject(e.toString());
        }
      });
    });

    console.log('Stream started! Recording for 5 seconds...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Stop recording
    await page.evaluate(() => {
      window.recorder.stop();
    });

    // Wait a bit for the last chunk to flush
    await new Promise(resolve => setTimeout(resolve, 1000));

    fileStream.end();
    console.log('Saved to test_stream.webm!');
    
    await browser.close();
  } catch(e) {
    console.error(e);
    process.exit(1);
  }
}
test();
