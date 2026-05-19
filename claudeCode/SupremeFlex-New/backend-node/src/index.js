import 'dotenv/config';
import express from 'express';
import cors from 'cors';
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

wss.on('connection', (ws) => {
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
