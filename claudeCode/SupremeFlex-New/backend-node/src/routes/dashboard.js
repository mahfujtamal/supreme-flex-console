import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { pool } from '../services/db.js';

const router = Router();
router.use(authMiddleware);

// REST fallback — Next.js can also use WebSocket for live updates
router.get('/gpfi', async (req, res) => {
  try {
    const [[row]] = await pool.query(`
      SELECT
        SUM(status = 'IN_GPFI_STAGING') AS staging,
        SUM(status = 'WITH_FIELD_STAFF') AS field_staff,
        SUM(status = 'DELIVERED')        AS delivered
      FROM inventory_master
    `);
    res.json(row);
  } catch (err) {
    console.error('[dashboard] GET /gpfi', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.get('/field-execution', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT fa.agent_id, fa.agent_name,
        SUM(im.status = 'WITH_FIELD_STAFF') AS stock_count,
        SUM(o.order_status = 'OUT_FOR_DELIVERY') AS pending_deliveries
      FROM field_agents fa
      LEFT JOIN inventory_master im ON im.allocated_agent_id = fa.agent_id
      LEFT JOIN orders o ON o.assigned_agent_id = fa.agent_id
      GROUP BY fa.agent_id, fa.agent_name
    `);
    res.json(rows);
  } catch (err) {
    console.error('[dashboard] GET /field-execution', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
