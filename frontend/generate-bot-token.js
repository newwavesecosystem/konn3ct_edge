const crypto = require('crypto');

function generateToken() {
  const payload = {
    participantId: crypto.randomUUID(),
    exp: Math.floor(Date.now() / 1000) + 3600
  };
  
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', 'secret').update(`${header}.${body}`).digest('base64url');
  
  return `${header}.${body}.${signature}`;
}

console.log(`http://localhost:3000/recording/test?botToken=${generateToken()}`);
