import 'dotenv/config';
import { createServer } from 'http';
import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';
import path from 'path';
import { initializeSignaling } from './signaling/server';
import { initializeWorkers } from './media/sfu';
import { config } from './media/config';
import { logger } from './logger';
import { generalLimiter } from './middleware/rateLimiter';
import { healthRouter } from './routes/health';
import { authRouter } from './routes/auth';
import { teamsRouter } from './routes/teams';
import { roomsRouter } from './routes/rooms';
import { recordingsRouter } from './routes/recordings';
import { paymentsRouter } from './routes/payments';
import { schedulingRouter } from './routes/scheduling';
import { dashboardRouter } from './routes/dashboard';
import { telephonyRouter } from './routes/telephony';
import { aiRouter } from './routes/ai';
import { externalRouter } from './routes/external';
import { streamingRouter } from './routes/streaming';

if (process.env.NODE_ENV === 'production') {
  const required = ['JWT_SECRET', 'TURN_SECRET', 'EXTERNAL_API_KEY'];
  for (const key of required) {
    if (!process.env[key]) {
      throw new Error(`[FATAL] Environment variable ${key} must be set in production`);
    }
  }
}

export const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json({ limit: '50kb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Security headers
app.use(helmet());

// CORS - allow only the frontend domain
const allowedOrigins = [
  process.env.NEXT_PUBLIC_FRONTEND_URL,
  process.env.NEXT_PUBLIC_FRONTEND_DOMAIN ? `https://${process.env.NEXT_PUBLIC_FRONTEND_DOMAIN}` : null,
  'http://localhost:3000',
  'http://localhost:3001',
].filter(Boolean) as string[];
app.use(cors({
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

// Request logging middleware
app.use((req, res, next) => {
  const safeUrl = req.url.replace(/([?&])token=[^&]*/g, '$1token=[REDACTED]');
  logger.info(`${req.method} ${safeUrl}`);
  next();
});

// Global rate limiter — 100 req/min per IP (skips /health automatically)
app.use(generalLimiter);

// Swagger Documentation (non-production only)
if (process.env.NODE_ENV !== 'production') {
  const swaggerDocument = YAML.load(path.join(__dirname, '../swagger.yaml'));
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
}

// Routes
app.use('/health', healthRouter);
app.use('/api/auth', authRouter);
app.use('/api/teams', teamsRouter);
app.use('/api/rooms', roomsRouter);
app.use('/api/recordings', recordingsRouter);
app.use('/api/payments', paymentsRouter);
app.use('/api/scheduling', schedulingRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/telephony', telephonyRouter);
app.use('/api/ai', aiRouter);
app.use('/api/external/v1', externalRouter);
app.use('/api/streaming', streamingRouter);

// Basic 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not Found' });
});

// Start server
// Start server
const server = createServer(app);
initializeSignaling(server);

// Boot mediasoup workers then start HTTP server
async function boot() {
  try {
    // In production (Kubernetes), dynamically fetch the true public IP for WebRTC routing
    if (process.env.NODE_ENV === 'production') {
      const https = require('https');
      const publicIp = await new Promise<string>((resolve) => {
        https.get('https://api.ipify.org', (res: any) => {
          let data = '';
          res.on('data', (chunk: string) => data += chunk);
          res.on('end', () => resolve(data.trim()));
        }).on('error', (err: any) => {
          logger.error('Failed to fetch public IP for WebRTC', err);
          resolve(process.env.WEBRTC_ANNOUNCED_IP || '127.0.0.1');
        });
      });
      logger.info(`Dynamically detected Public IP for WebRTC: ${publicIp}`);
      config.mediasoup.webRtcTransport.listenIps[0].announcedIp = publicIp;
    }

    await initializeWorkers();
    logger.info('Mediasoup workers initialized successfully.');
  } catch (err) {
    logger.error('Failed to initialize mediasoup workers.', err);
    if (process.env.NODE_ENV === 'production') throw err;
  } finally {
    server.listen(PORT, () => {
      logger.info(`Server is running on http://localhost:${PORT}`);
    });
  }
}

if (require.main === module) {
  boot();
}
