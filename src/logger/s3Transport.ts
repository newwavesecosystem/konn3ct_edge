import Transport, { TransportStreamOptions } from 'winston-transport';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import crypto from 'crypto';
const uuidv4 = () => crypto.randomUUID();

export interface S3TransportOptions extends TransportStreamOptions {
  bucketName?: string;
  region?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  endpoint?: string;
  batchSize?: number;
  batchIntervalMs?: number;
}

export class S3Transport extends Transport {
  private s3Client: S3Client | null = null;
  private bucketName: string | null = null;
  private logBuffer: any[] = [];
  private batchSize: number;
  private batchIntervalMs: number;
  private flushTimer: NodeJS.Timeout | null = null;
  private podId: string;

  constructor(opts: S3TransportOptions = {}) {
    super(opts);
    
    this.batchSize = opts.batchSize || 100;
    this.batchIntervalMs = opts.batchIntervalMs || 60000;
    this.podId = process.env.POD_ID || 'pod-' + uuidv4();

    const bucket = opts.bucketName || process.env.TELEMETRY_S3_BUCKET_NAME || 'konn3ct-telemetry';
    const region = opts.region || process.env.DO_SPACES_REGION || 'nyc3';
    const accessKeyId = opts.accessKeyId || process.env.DO_SPACES_KEY;
    const secretAccessKey = opts.secretAccessKey || process.env.DO_SPACES_SECRET;
    const endpoint = opts.endpoint || process.env.DO_SPACES_ENDPOINT;

    if (bucket && accessKeyId && secretAccessKey) {
      this.bucketName = bucket;
      this.s3Client = new S3Client({
        region,
        endpoint,
        credentials: {
          accessKeyId,
          secretAccessKey
        },
        forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
      });
      
      this.startFlushTimer();
    } else {
      console.warn('[Logger] S3 Telemetry disabled due to missing configuration');
    }
  }

  private startFlushTimer() {
    this.flushTimer = setInterval(() => {
      this.flush().catch(err => console.error('[Logger] S3 flush error:', err));
    }, this.batchIntervalMs);
  }

  async flush() {
    if (this.logBuffer.length === 0 || !this.s3Client || !this.bucketName) return;

    const logsToUpload = [...this.logBuffer];
    this.logBuffer = [];

    const jsonl = logsToUpload.map(log => JSON.stringify(log)).join('\n');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const key = `telemetry/${this.podId}/${timestamp}-${uuidv4()}.jsonl`;

    try {
      await this.s3Client.send(new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: jsonl,
        ContentType: 'application/jsonx-lines'
      }));
    } catch (err) {
      console.error('[Logger] Failed to upload telemetry to S3:', err);
      // Put logs back in buffer so they aren't lost, cap at 10000 to prevent OOM
      if (this.logBuffer.length < 10000) {
        this.logBuffer = [...logsToUpload, ...this.logBuffer];
      }
    }
  }

  log(info: any, callback: () => void) {
    if (this.s3Client) {
      this.logBuffer.push({ ...info, podId: this.podId, timestamp: new Date().toISOString() });
      if (this.logBuffer.length >= this.batchSize) {
        this.flush().catch(() => {});
      }
    }
    callback();
  }
}
