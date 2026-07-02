const Redis = require('ioredis');
const redis = new Redis('redis://localhost:6379');

async function trigger() {
  const job = {
    roomId: 'meetsamuel',
    url: 'https://edge.konn3ct.net/join/meetsamuel?bot=true&botSecret=your-bot-secret',
    recordingId: 'test_rec_' + Date.now()
  };
  await redis.lpush('recorder:queue', JSON.stringify(job));
  console.log('Job pushed');
  process.exit(0);
}

trigger();
