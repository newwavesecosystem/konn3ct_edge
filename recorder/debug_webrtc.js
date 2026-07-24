const { spawn, execSync } = require('child_process');
const puppeteer = require('puppeteer');
const fs = require('fs');

async function run() {
  console.log("Starting Xvfb on :98...");
  const xvfb = spawn('Xvfb', [':98', '-screen', '0', '1920x1080x24', '-ac']);
  
  await new Promise(r => setTimeout(r, 2000));
  
  console.log("Launching Chrome...");
  const browser = await puppeteer.launch({
    executablePath: "/usr/bin/google-chrome",
    headless: false,
    defaultViewport: { width: 1920, height: 1080 },
    ignoreDefaultArgs: ["--enable-automation"],
    args: [
      "--disable-infobars",
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--kiosk",
      "--window-size=1920,1080",
      "--window-position=0,0",
      "--start-fullscreen",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--use-gl=angle",
      "--use-angle=swiftshader",
      "--use-fake-ui-for-media-stream",
      "--use-fake-device-for-media-stream"
    ],
    env: { ...process.env, DISPLAY: ':98' }
  });

  const page = await browser.newPage();
  console.log("Creating WebRTC loopback page...");
  const html = `
    <html>
      <body style="background: red; margin: 0; display: flex; align-items: center; justify-content: center;">
        <video id="v" autoplay muted style="width: 1000px; height: 1000px; border: 5px solid yellow;"></video>
        <script>
          navigator.mediaDevices.getUserMedia({ video: true })
            .then(stream => { document.getElementById('v').srcObject = stream; })
            .catch(e => console.error(e));
        </script>
      </body>
    </html>
  `;
  await page.setContent(html);
  
  console.log("Waiting 5 seconds for WebRTC render...");
  await new Promise(r => setTimeout(r, 5000));

  console.log("Capturing screen with FFmpeg x11grab...");
  try {
    execSync('ffmpeg -y -f x11grab -draw_mouse 0 -video_size 1920x1080 -i :98.0 -vframes 1 /tmp/x11grab_webrtc.jpg', { stdio: 'pipe' });
    console.log("Captured /tmp/x11grab_webrtc.jpg successfully!");
    const size = fs.statSync('/tmp/x11grab_webrtc.jpg').size;
    console.log("Image size in bytes:", size);
  } catch(e) {
    console.error("FFmpeg failed:", e.stderr ? e.stderr.toString() : e);
  }
  
  await browser.close();
  xvfb.kill();
  process.exit(0);
}

run();
