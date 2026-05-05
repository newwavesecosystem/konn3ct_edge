import 'dotenv/config';
import { createServer } from 'http';
import express from 'express';
import cookieParser from 'cookie-parser';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';
import path from 'path';
import { initializeSignaling } from './signaling/server';
import { initializeWorkers } from './media/sfu';
import { logger } from './logger';
import { healthRouter } from './routes/health';
import { authRouter } from './routes/auth';
import { teamsRouter } from './routes/teams';
import { roomsRouter } from './routes/rooms';
import { recordingsRouter } from './routes/recordings';
import { paymentsRouter } from './routes/payments';
import { schedulingRouter } from './routes/scheduling';
import { dashboardRouter } from './routes/dashboard';
import { telephonyRouter } from './routes/telephony';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Request logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.url}`);
  next();
});

// Swagger Documentation
const swaggerDocument = YAML.load(path.join(__dirname, '../swagger.yaml'));
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

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

// Basic 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not Found' });
});

// Start server
// Start server
const server = createServer(app);
initializeSignaling(server);

// Boot mediasoup workers then start HTTP server
initializeWorkers().then(() => {
  logger.info('Mediasoup workers initialized successfully.');
}).catch(err => {
  logger.warn('Failed to initialize mediasoup workers (Native C++ bindings may be missing on this OS). Running in REST-only mode.', err);
}).finally(() => {
  server.listen(PORT, () => {
    logger.info(`Server is running on http://localhost:${PORT}`);
  });
});
