// @ts-ignore
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
// @ts-ignore
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { logger } from '../logger';

// Check if we have S3 env vars
const region = process.env.DO_SPACES_REGION || 'us-east-1';
const accessKeyId = process.env.DO_SPACES_KEY || '';
const secretAccessKey = process.env.DO_SPACES_SECRET || '';
const rawEndpoint = process.env.DO_SPACES_ENDPOINT;
const endpoint = rawEndpoint ? (rawEndpoint.startsWith('http') ? rawEndpoint : `https://${rawEndpoint}`) : undefined;
const bucket = process.env.DO_SPACES_BUCKET || '';
const forcePathStyle = process.env.S3_FORCE_PATH_STYLE === 'true';

// @ts-ignore
let s3Client: S3Client | null = null;

if (accessKeyId && secretAccessKey) {
  // @ts-ignore
  s3Client = new S3Client({
    region,
    credentials: { accessKeyId, secretAccessKey },
    ...(endpoint ? { endpoint } : {}),
    ...(forcePathStyle ? { forcePathStyle: true } : {})
  });
}

export async function generateSignedPlaybackUrl(storageKey: string, ttlSeconds = 3600): Promise<string> {
  if (!s3Client) {
    logger.warn('S3 client not configured, falling back to public url behavior if possible');
    return '';
  }

  if (!bucket) {
    throw new Error('S3 bucket not configured');
  }

  // @ts-ignore
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: storageKey
  });

  try {
    // @ts-ignore
    return await getSignedUrl(s3Client, command, { expiresIn: ttlSeconds });
  } catch (error) {
    logger.error('Failed to generate signed S3 URL', error);
    throw new Error('Could not generate playback URL');
  }
}
