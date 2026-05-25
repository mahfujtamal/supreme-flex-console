import express from 'express';
import cors from 'cors';
import fieldExecutionRouter from './routes/fieldExecution.js';
import stockTransferRouter  from './routes/stockTransfers.js';
import dashboardRouter      from './routes/dashboard.js';
import { idempotency }      from './middleware/idempotency.js';

const app = express();

app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:3000' }));
app.use(express.json());
app.use(idempotency);

app.use('/api/field-execution',  fieldExecutionRouter);
app.use('/api/stock-transfers',  stockTransferRouter);
app.use('/api/dashboard',        dashboardRouter);

app.get('/health', (_, res) => res.json({ status: 'ok' }));

export default app;
