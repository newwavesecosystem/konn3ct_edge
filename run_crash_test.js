require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const Redis = require('ioredis');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { spawn, execSync } = require('child_process');

const prisma = new PrismaClient();
const redis = new Redis(process.env.REDIS_URL);

async function runTest() {
  console.log("Starting crash certification test...");
  
  // 1. Create dummy user and room
  const user = await prisma.user.create({
    data: {
      email: 'host_' + Date.now() + '@example.com',
      passwordHash: 'dummy',
      name: 'Test Host'
    }
  });

  const roomId = 'room_' + Date.now();
  const room = await prisma.room.create({
    data: {
      id: roomId,
      name: 'Test Room',
      slug: roomId,
      ownerId: user.id
    }
  });

  const recordingId = 'rec_' + Date.now();
  await prisma.recording.create({
    data: {
      id: recordingId,
      roomId: room.id,
      ownerId: user.id,
      title: 'Crash Certification',
      status: 'starting'
    }
  });

  await redis.set(\`recording:\${recordingId}:control\`, 'STARTING');
  await redis.set(\`recording:\${recordingId}:current-worker-generation\`, 1);

  const participantId = crypto.randomUUID();
  const botToken = jwt.sign(
    { role: 'recorder', purpose: 'recording_bot', roomId: room.id, roomSlug: room.slug, recordingId, participantId },
    process.env.JWT_SECRET || 'fallback',
    { expiresIn: '4h' }
  );

  const job = {
    roomId: room.id,
    recordingId: recordingId,
    url: \`http://localhost:3000/room/\${room.slug}/recording?botToken=\${botToken}\`,
    botToken: botToken,
    workerGeneration: 1,
    nextSegmentIndex: 10000,
    jobId: \`rec_job_\${Date.now()}\`
  };

  console.log("Enqueuing job for", recordingId);
  await redis.lpush('recorder:queue', JSON.stringify(job));

  console.log("Waiting 75 seconds for segment 1 to complete...");
  await new Promise(r => setTimeout(r, 75000));

  console.log("Finding and killing FFmpeg...");
  try {
    const ffmpegPids = execSync('tasklist /FI "IMAGENAME eq ffmpeg.exe" /NH /FO CSV').toString();
    const rows = ffmpegPids.trim().split('\\n');
    for (const row of rows) {
      if (row.includes('ffmpeg.exe')) {
        const pid = row.split(',')[1].replace(/"/g, '');
        console.log("Killing FFmpeg PID:", pid);
        execSync(\`taskkill /F /PID \${pid}\`);
      }
    }
  } catch (e) {
    console.error("No ffmpeg found or failed to kill", e.message);
  }

  console.log("Waiting 30 seconds for recovery...");
  await new Promise(r => setTimeout(r, 30000));

  console.log("Stopping recording...");
  await redis.set(\`recording:\${recordingId}:control\`, 'STOP_REQUESTED');
  await redis.publish(\`recorder:stop:\${recordingId}\`, JSON.stringify({ recordingId, reason: 'host_requested_stop' }));
  
  console.log("Done.");
  process.exit(0);
}

runTest().catch(console.error);
