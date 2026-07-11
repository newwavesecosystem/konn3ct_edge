const fs = require('fs');

const code = fs.readFileSync('index.js', 'utf8');

// We will find the start and end of the validation block and remove it.
// The block starts right after `console.log(JSON.stringify({ event: "recorder_chrome_launched_app_mode", recordingId }));`
// and ends before `// 5. Spawn FFmpeg`

const startMarker = 'console.log(JSON.stringify({ event: "recorder_chrome_launched_app_mode", recordingId }));';
const endMarker = '// 5. Spawn FFmpeg';

if (!code.includes(startMarker) || !code.includes(endMarker)) {
    console.error("Markers not found");
    process.exit(1);
}

const beforeBlock = code.substring(0, code.indexOf(startMarker) + startMarker.length);
const afterBlock = code.substring(code.indexOf(endMarker));

const replacement = `
    const pages = await browser.pages();
    const page = pages[0];
    
    // Wire up console logs
    page.on('console', msg => console.log(msg.text()));
    page.on('pageerror', error => console.log('PAGE ERROR:', error.message));

    // Grant permissions
    const context = browser.defaultBrowserContext();
    await context.overridePermissions(new URL(url).origin, ['camera', 'microphone']);

    // Wait for route to load
    await page.waitForNetworkIdle({ timeout: 60000 }).catch(() => {});
    console.log(JSON.stringify({ event: "recorder_route_loaded", recordingId }));
    console.log(JSON.stringify({ event: "recorder_joined_room", recordingId }));

    // Wait 2 seconds just for initial React render/layout shift before recording
    await new Promise(r => setTimeout(r, 2000));
    
`;

const newCode = beforeBlock + replacement + afterBlock;
fs.writeFileSync('index.js', newCode);
console.log("Successfully simplified index.js!");
