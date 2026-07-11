const fs = require('fs');

const imports = `const { launch, getStream } = require('puppeteer-stream');
const fs = require('fs');
const path = require('path');
const Redis = require('ioredis');
const { S3Client } = require('@aws-sdk/client-s3');
const { Upload } = require('@aws-sdk/lib-storage');
const ffmpeg = require('fluent-ffmpeg');
const http = require('http');
const { spawn, execSync } = require('child_process');

require('dotenv').config();

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const redis = new Redis(redisUrl, { retryStrategy: (times) => Math.min(times * 50, 2000) });
const pubsub = new Redis(redisUrl, { retryStrategy: (times) => Math.min(times * 50, 2000) });

const MAX_CONCURRENT_BROWSERS = process.env.MAX_CONCURRENT_BROWSERS ? parseInt(process.env.MAX_CONCURRENT_BROWSERS) : 1;
const MAX_CONCURRENT_TRANSCODES = process.env.MAX_CONCURRENT_TRANSCODES ? parseInt(process.env.MAX_CONCURRENT_TRANSCODES) : 4;

`;

const currentCode = fs.readFileSync('index.js', 'utf8');
fs.writeFileSync('index.js', imports + currentCode);
console.log('Restored top imports safely.');
