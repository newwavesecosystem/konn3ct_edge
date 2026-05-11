import puppeteer from 'puppeteer';
import { getStream, launch } from 'puppeteer-stream';
import fs from 'fs';
import path from 'path';
import { db } from '../db';
// @ts-ignore
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

// DigitalOcean Spaces setup
const s3Client = new S3Client({
  endpoint: process.env.DO_SPACES_ENDPOINT!,
  region: process.env.DO_SPACES_REGION || "nyc3",
  credentials: {
    accessKeyId: process.env.DO_SPACES_KEY!,
    secretAccessKey: process.env.DO_SPACES_SECRET!,
  },
});

export async function startRecordingBot(recordingId: string, roomSlug: string, durationMinutes: number = 60) {
  const recording = await db.recording.findUnique({ where: { id: recordingId } });
  if (!recording) throw new Error("Recording not found");

  const frontendUrl = process.env.NEXT_PUBLIC_FRONTEND_URL || 'http://localhost:3000';
  const meetingUrl = `${frontendUrl}/meeting/${roomSlug}?name=RecordingBot&role=bot`;

  console.log(`🤖 [Bot] Launching headless browser for recording: ${recordingId}`);

  // We use puppeteer-stream's launch wrapper to enable screen capture
  const browser = await launch({
    executablePath: puppeteer.executablePath(),
    defaultViewport: { width: 1920, height: 1080 },
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--autoplay-policy=no-user-gesture-required',
      '--window-size=1920,1080',
      '--disable-dev-shm-usage',
    ]
  });

  const page = await browser.newPage();
  
  // Go to the meeting URL
  await page.goto(meetingUrl, { waitUntil: 'networkidle2' });

  console.log(`🤖 [Bot] Joined meeting room: ${roomSlug}. Starting capture...`);

  // Start recording stream
  const stream = await getStream(page, { audio: true, video: true });
  
  const tempFilePath = path.join('/tmp', `recording_${recordingId}.webm`);
  const fileStream = fs.createWriteStream(tempFilePath);
  
  stream.pipe(fileStream);

  // Update DB to show we are actively recording
  await db.recording.update({
    where: { id: recordingId },
    data: { status: 'recording', startedAt: new Date() }
  });

  // Wait for the duration, or until we get a stop signal (for MVP, we use fixed timeout)
  await new Promise(resolve => setTimeout(resolve, durationMinutes * 60 * 1000));

  console.log(`🤖 [Bot] Recording finished. Stopping capture...`);
  
  // Cleanup
  stream.destroy();
  fileStream.close();
  await browser.close();

  // Upload to DigitalOcean
  console.log(`🤖 [Bot] Uploading to DigitalOcean Spaces...`);
  const fileBuffer = fs.readFileSync(tempFilePath);
  
  const bucketName = process.env.DO_SPACES_BUCKET || 'kslas';
  const objectKey = `recordings/${recordingId}.webm`;

  await s3Client.send(new PutObjectCommand({
    Bucket: bucketName,
    Key: objectKey,
    Body: fileBuffer,
    ACL: 'public-read',
    ContentType: 'video/webm'
  }));

  const publicUrl = `${process.env.DO_SPACES_ENDPOINT!.replace('https://', `https://${bucketName}.`)}/${objectKey}`;

  // Update DB with final URL and completed status
  await db.recording.update({
    where: { id: recordingId },
    data: { 
      status: 'completed', 
      url: publicUrl,
      endedAt: new Date(),
      duration: durationMinutes * 60
    }
  });

  // Delete temp file
  fs.unlinkSync(tempFilePath);
  
  console.log(`✅ [Bot] Recording ${recordingId} uploaded successfully to ${publicUrl}`);
}
