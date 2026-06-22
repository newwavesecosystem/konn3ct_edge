const { launch } = require('puppeteer-stream');
const fs = require('fs');
const path = require('path');
const http = require('http');
const ffmpeg = require('fluent-ffmpeg');

async function recordMeeting() {
  console.log('Testing recorder locally...');
  const url = 'http://localhost:3000/meeting/meetsamuel?bot=true&botSecret=my-bot-secret-123&role=bot&mic=false&camera=false';
  const outputPathRaw = path.join(__dirname, 'meetsamuel_raw.webm');
  const outputPathMp4 = path.join(__dirname, 'test_recording.mp4');

  let browser;

  try {
    const puppeteer = require('puppeteer');
    browser = await launch({
      executablePath: puppeteer.executablePath(),
      headless: false,
      defaultViewport: null,
      ignoreDefaultArgs: ['--mute-audio', '--enable-automation'],
      args: [
        '--window-size=1920,1080',
        '--kiosk',
        '--no-sandbox',
        '--autoplay-policy=no-user-gesture-required',
        '--auto-select-desktop-capture-source=BotRecord',
        '--auto-select-tab-capture-source-by-title=BotRecord',
        '--enable-usermedia-screen-capturing',
        '--use-fake-ui-for-media-stream',
        `--use-file-for-fake-audio-capture=${path.join(__dirname, 'silent.wav')}`,
        '--disable-web-security',
        '--hide-scrollbars'
      ],
    });

    const pages = await browser.pages();
    const page = pages[0];
    await page.bringToFront();

    const context = browser.defaultBrowserContext();
    await context.overridePermissions(new URL(url).origin, ['camera', 'microphone']);

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
    console.log('Joined room, waiting for media...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    const fileStream = fs.createWriteStream(outputPathRaw);

    const server = http.createServer((req, res) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', '*');
      res.setHeader('Access-Control-Allow-Headers', '*');
      res.setHeader('Access-Control-Allow-Private-Network', 'true');

      if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
      }

      if (req.method === 'POST' && req.url === '/chunk') {
        req.pipe(fileStream, { end: false });
        req.on('end', () => {
          res.writeHead(200);
          res.end('ok');
        });
      } else {
        res.writeHead(404);
        res.end('invalid');
      }
    });

    const port = await new Promise((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        resolve(server.address().port);
      });
    });

    console.log('Starting MediaRecorder...');
    await page.evaluate((serverPort) => {
      return new Promise(async (resolve, reject) => {
        try {
          document.title = 'BotRecord';
          await new Promise(r => setTimeout(r, 500));

          let stream;
          try {
            stream = await navigator.mediaDevices.getDisplayMedia({
              video: { displaySurface: "browser", width: 1920, height: 1080 },
              audio: true
            });
          } catch (err) {
            stream = await navigator.mediaDevices.getDisplayMedia({
              video: { displaySurface: "browser", width: 1920, height: 1080 }
            });
          }
          const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
          window.uploadQueue = Promise.resolve();
          recorder.ondataavailable = (e) => {
            if (e.data.size > 0) {
              window.uploadQueue = window.uploadQueue.then(() => 
                fetch(`http://127.0.0.1:${serverPort}/chunk`, {
                  method: 'POST',
                  body: e.data
                }).catch(err => console.error(err))
              );
            }
          };
          recorder.start(1000);
          window.recorder = recorder;
          resolve();
        } catch (e) {
          reject(e.toString());
        }
      });
    }, port);

    console.log('Recording for 15 seconds...');
    await new Promise(r => setTimeout(r, 15000));

    console.log('Stopping recording...');
    await page.evaluate(() => {
      return new Promise((resolve) => {
        if (window.recorder && window.recorder.state !== 'inactive') {
          window.recorder.onstop = () => {
            window.uploadQueue.then(resolve);
          };
          window.recorder.stop();
        } else {
          resolve();
        }
      });
    });

    await new Promise(r => setTimeout(r, 1000));
    fileStream.end();
    server.close();

    fileStream.on('close', async () => {
      console.log('Converting to mp4...');
      await browser.close();

      ffmpeg(outputPathRaw)
        .outputOptions([
          '-preset veryfast',
          '-c:v libx264',
          '-c:a aac'
        ])
        .save(outputPathMp4)
        .on('end', () => {
          console.log(`Recording saved to ${outputPathMp4}`);
          fs.unlinkSync(outputPathRaw);
          process.exit(0);
        })
        .on('error', (err) => {
          console.error(err);
          process.exit(1);
        });
    });

  } catch (err) {
    console.error(err);
    if (browser) await browser.close();
    process.exit(1);
  }
}

recordMeeting();
