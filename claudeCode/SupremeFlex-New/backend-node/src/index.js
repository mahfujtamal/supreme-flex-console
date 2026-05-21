import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import fieldExecutionRouter from './routes/fieldExecution.js';
import stockTransferRouter  from './routes/stockTransfers.js';
import dashboardRouter      from './routes/dashboard.js';
import { broadcastDashboard } from './services/dashboardBroadcast.js';

if (!process.env.JWT_SECRET) {
  console.error('[FATAL] JWT_SECRET is not set — refusing to start');
  process.exit(1);
}

if (process.env.NODE_ENV === 'production' && process.env.OTP_DEV_PEEK === 'true') {
  console.error('[FATAL] OTP_DEV_PEEK must not be enabled in production — refusing to start');
  process.exit(1);
}

const app  = express();
const port = process.env.PORT || 8001;

app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:3000' }));
app.use(express.json());

// REST routes (Node.js-owned modules)
app.use('/api/field-execution',  fieldExecutionRouter);
app.use('/api/stock-transfers',  stockTransferRouter);
app.use('/api/dashboard',        dashboardRouter);

app.get('/health', (_, res) => res.json({ status: 'ok' }));

// HTTP + WebSocket on same port
const server = createServer(app);
const wss    = new WebSocketServer({ server, path: '/ws/dashboard' });

wss.on('connection', (ws, req) => {
  // Authenticate via JWT passed as the first WebSocket subprotocol
  const protocols = (req.headers['sec-websocket-protocol'] ?? '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  const token = protocols[0];
  if (!token) {
    ws.close(1008, 'Unauthorized');
    return;
  }

  try {
    jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    ws.close(1008, 'Token invalid or expired');
    return;
  }

  console.log('[WS] client connected');

  // Send initial snapshot immediately
  broadcastDashboard().then(data => ws.send(JSON.stringify({ type: 'snapshot', data })));

  // Push updates every 10 seconds
  const interval = setInterval(async () => {
    if (ws.readyState === ws.OPEN) {
      const data = await broadcastDashboard();
      ws.send(JSON.stringify({ type: 'update', data }));
    }
  }, 10_000);

  ws.on('close', () => clearInterval(interval));
});

server.listen(port, () => console.log(`[Node] listening on port ${port}`));
