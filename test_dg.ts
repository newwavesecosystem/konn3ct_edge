import { DeepgramClient } from '@deepgram/sdk';

const deepgramApiKey = "519870166895a50b778d6a5d8fbe6ddd9637dc6e";
const deepgram = new DeepgramClient({ apiKey: deepgramApiKey });

async function test() {
  console.log("Connecting...");
  const dgConnection = await deepgram.listen.v1.connect({
    model: 'nova-2',
    language: 'en',
    smart_format: "true" as any,
    Authorization: `Token ${deepgramApiKey}`
  });
  
  console.log("Connect promise resolved. ReadyState:", dgConnection.readyState);
  
  dgConnection.on('open', () => {
    console.log("Got OPEN event.");
  });
  
  dgConnection.on('error', (err: any) => {
    console.error("Got error:", err);
  });
  
  dgConnection.on('close', (err: any) => {
    console.error("Got close:", err);
  });
  
  setTimeout(() => {
    console.log("Done.");
    process.exit(0);
  }, 2000);
}

test().catch(console.error);
