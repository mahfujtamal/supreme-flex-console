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

// Manager dashboard — scoped to the requesting manager's entity via staff_type in JWT
router.get('/manager', async (req, res) => {
  try {
    const { sub: userId, staff_type } = req.authUser;

    let rows = [];

    if (staff_type === 'DH_MANAGER') {
      [rows] = await pool.query(`
        SELECT fa.agent_id, fa.agent_name,
          SUM(im.status = 'WITH_FIELD_STAFF') AS stock_count,
          SUM(o.order_status = 'OUT_FOR_DELIVERY') AS pending_deliveries
        FROM distribution_houses dh
        JOIN field_agents fa ON fa.dh_id = dh.dh_id
        LEFT JOIN inventory_master im ON im.allocated_agent_id = fa.agent_id
        LEFT JOIN orders o ON o.assigned_agent_id = fa.agent_id
        WHERE dh.manager_admin_id = ?
        GROUP BY fa.agent_id, fa.agent_name
      `, [userId]);
    } else if (staff_type === 'CHANNEL_MANAGER') {
      [rows] = await pool.query(`
        SELECT sc.sub_channel_id AS id, sc.sub_channel_name AS name,
          sc.delivery_ownership, sc.status
        FROM channels ch
        JOIN sub_channels sc ON sc.channel_id = ch.channel_id
        WHERE ch.manager_admin_id = ?
      `, [userId]);
    } else if (staff_type === 'SUBCHANNEL_MANAGER') {
      [rows] = await pool.query(`
        SELECT sc.sub_channel_id AS id, sc.sub_channel_name AS name,
          sc.delivery_ownership, sc.status
        FROM sub_channels sc
        WHERE sc.manager_admin_id = ?
      `, [userId]);
    }

    res.json({ staff_type, items: rows });
  } catch (err) {
    console.error('[dashboard] GET /manager', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
