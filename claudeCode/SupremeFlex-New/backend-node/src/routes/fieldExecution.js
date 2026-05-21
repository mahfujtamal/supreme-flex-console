import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { pool, toBin } from '../services/db.js';

const router = Router();
router.use(authMiddleware);

// GET /api/field-execution/leads — leads with accessory info
router.get('/leads', async (req, res) => {
  try {
    const { agent_id, status, page = 0, per_page = 20 } = req.query;
    const offset = Number(page) * Number(per_page);

    let sql = `
      SELECT o.*,
        JSON_ARRAYAGG(
          JSON_OBJECT('product_id', oi.product_id, 'quantity', oi.quantity)
        ) AS accessories
      FROM orders o
      LEFT JOIN order_items oi ON oi.order_id = o.order_id
      WHERE 1=1
    `;
    const params = [];

    if (agent_id) { sql += ' AND o.assigned_agent_id = ?'; params.push(toBin(agent_id)); }
    if (status)   { sql += ' AND o.order_status = ?';      params.push(status); }

    sql += ' GROUP BY o.order_id ORDER BY o.created_at DESC LIMIT ? OFFSET ?';
    params.push(Number(per_page), offset);

    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error('[fieldExecution] GET /leads', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// PATCH /api/field-execution/leads/:id/status — update order status
router.patch('/leads/:id/status', async (req, res) => {
  try {
    const { order_status, fulfillment_status } = req.body;
    await pool.query(
      `UPDATE orders SET order_status = ?, fulfillment_status = ?, updated_at = NOW()
       WHERE order_id = ?`,
      [order_status, fulfillment_status, toBin(req.params.id)]
    );
    res.json({ message: 'Status updated' });
  } catch (err) {
    console.error('[fieldExecution] PATCH /leads/:id/status', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/field-execution/scan-to-fulfill — mark inventory as delivered
router.post('/scan-to-fulfill', async (req, res) => {
  const { inventory_id, order_id, imei } = req.body;
  if (!inventory_id || !order_id) {
    return res.status(400).json({ message: 'inventory_id and order_id required' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    await conn.query(
      `UPDATE inventory_master SET status = 'DELIVERED', imei = COALESCE(?, imei), updated_at = NOW()
       WHERE inventory_id = ?`,
      [imei || null, toBin(inventory_id)]
    );

    await conn.query(
      `UPDATE orders SET order_status = 'INSTALLED', updated_at = NOW() WHERE order_id = ?`,
      [toBin(order_id)]
    );

    await conn.commit();
    res.json({ message: 'Fulfilled' });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ message: err.message });
  } finally {
    conn.release();
  }
});

export default router;
