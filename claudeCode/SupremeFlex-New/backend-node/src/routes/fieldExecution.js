import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { idempotency } from '../middleware/idempotency.js';
import { pool, toBin, newId } from '../services/db.js';
import { sendSms } from '../services/phpBridge.js';

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
router.post('/scan-to-fulfill', idempotency, async (req, res) => {
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

// ── Accessories CRUD ─────────────────────────────────────────────────────────

// GET /api/field-execution/leads/:id/accessories
router.get('/leads/:id/accessories', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT BIN_TO_UUID(item_id) AS item_id,
              BIN_TO_UUID(product_id) AS product_id,
              quantity, unit_price_bdt, item_fulfillment_status, created_at
       FROM order_items WHERE order_id = ?`,
      [toBin(req.params.id)]
    );
    res.json(rows);
  } catch (err) {
    console.error('[fieldExecution] GET /leads/:id/accessories', err);
    res.status(err.status ?? 500).json({ message: err.message });
  }
});

// POST /api/field-execution/leads/:id/accessories
router.post('/leads/:id/accessories', async (req, res) => {
  const { product_id, quantity = 1, unit_price_bdt = 0 } = req.body;
  if (!product_id) return res.status(400).json({ message: 'product_id required' });

  try {
    const itemId = newId();
    await pool.query(
      `INSERT INTO order_items (item_id, order_id, product_id, quantity, unit_price_bdt)
       VALUES (?, ?, ?, ?, ?)`,
      [itemId, toBin(req.params.id), toBin(product_id), quantity, unit_price_bdt]
    );
    res.status(201).json({ message: 'Accessory added' });
  } catch (err) {
    console.error('[fieldExecution] POST /leads/:id/accessories', err);
    res.status(err.status ?? 500).json({ message: err.message });
  }
});

// PATCH /api/field-execution/leads/:id/accessories/:itemId
router.patch('/leads/:id/accessories/:itemId', async (req, res) => {
  const { quantity } = req.body;
  if (quantity === undefined) return res.status(400).json({ message: 'quantity required' });

  try {
    await pool.query(
      `UPDATE order_items SET quantity = ?, updated_at = NOW()
       WHERE item_id = ? AND order_id = ?`,
      [quantity, toBin(req.params.itemId), toBin(req.params.id)]
    );
    res.json({ message: 'Accessory updated' });
  } catch (err) {
    console.error('[fieldExecution] PATCH /leads/:id/accessories/:itemId', err);
    res.status(err.status ?? 500).json({ message: err.message });
  }
});

// DELETE /api/field-execution/leads/:id/accessories/:itemId
router.delete('/leads/:id/accessories/:itemId', async (req, res) => {
  try {
    await pool.query(
      `DELETE FROM order_items WHERE item_id = ? AND order_id = ?`,
      [toBin(req.params.itemId), toBin(req.params.id)]
    );
    res.json({ message: 'Accessory removed' });
  } catch (err) {
    console.error('[fieldExecution] DELETE /leads/:id/accessories/:itemId', err);
    res.status(err.status ?? 500).json({ message: err.message });
  }
});

// ── Setup Complete ────────────────────────────────────────────────────────────

// POST /api/field-execution/leads/:id/setup-complete
// Body: { customer_id, anchor_id, active_service_id, old_cpe_serial?, new_cpe_serial?,
//         notes?, customer_msisdn, sms_message }
router.post('/leads/:id/setup-complete', async (req, res) => {
  const {
    customer_id, anchor_id, active_service_id,
    old_cpe_serial = null, new_cpe_serial = null, notes = null,
    customer_msisdn, sms_message,
  } = req.body;

  if (!customer_id || !anchor_id || !active_service_id || !customer_msisdn || !sms_message) {
    return res.status(400).json({
      message: 'customer_id, anchor_id, active_service_id, customer_msisdn, sms_message required',
    });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    await conn.query(
      `INSERT INTO cpe_order_history
         (id, order_id, anchor_id, active_service_id, customer_id, old_cpe_serial, new_cpe_serial, status, completed_at, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'COMPLETED', NOW(), ?)`,
      [
        newId(),
        toBin(req.params.id),
        toBin(anchor_id),
        toBin(active_service_id),
        toBin(customer_id),
        old_cpe_serial,
        new_cpe_serial,
        notes,
      ]
    );

    await conn.query(
      `UPDATE orders SET order_status = 'INSTALLED', fulfillment_status = 'COMPLETED', updated_at = NOW()
       WHERE order_id = ?`,
      [toBin(req.params.id)]
    );

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    console.error('[fieldExecution] POST /leads/:id/setup-complete (db)', err);
    return res.status(err.status ?? 500).json({ message: err.message });
  } finally {
    conn.release();
  }

  // SMS is best-effort — failure does not roll back the order update
  const smsSent = await sendSms(customer_msisdn, sms_message);

  res.json({ message: 'Setup complete', sms_sent: smsSent });
});

export default router;
