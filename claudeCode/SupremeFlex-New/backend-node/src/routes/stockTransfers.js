import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { pool } from '../services/db.js';
import { v4 as uuid } from 'uuid';

const router = Router();
router.use(authMiddleware);

const ENTITY_STATUS_MAP = {
  FIELD_STAFF: 'WITH_FIELD_STAFF',
  DH:          'ALLOCATED_TO_DH',
  KAM:         'ALLOCATED_TO_KAM',
};

// GET /api/stock-transfers
router.get('/', async (req, res) => {
  try {
    const { entity_id, status, page = 0, per_page = 20 } = req.query;
    const offset = Number(page) * Number(per_page);
    let sql = 'SELECT * FROM stock_transfers WHERE 1=1';
    const params = [];

    if (entity_id) {
      sql += ' AND (from_entity_id = ? OR to_entity_id = ?)';
      params.push(entity_id, entity_id);
    }
    if (status) { sql += ' AND transfer_status = ?'; params.push(status); }

    sql += ' ORDER BY requested_at DESC LIMIT ? OFFSET ?';
    params.push(Number(per_page), offset);

    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error('[stockTransfers] GET /', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/stock-transfers
router.post('/', async (req, res) => {
  try {
    const { inventory_id, from_entity_id, from_entity_type, to_entity_id, to_entity_type, notes } = req.body;
    const id = uuid();
    await pool.query(
      `INSERT INTO stock_transfers
       (transfer_id, inventory_id, from_entity_id, from_entity_type, to_entity_id, to_entity_type, notes, transfer_status, requested_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING', NOW(), NOW(), NOW())`,
      [id, inventory_id, from_entity_id, from_entity_type, to_entity_id, to_entity_type, notes]
    );
    const [[row]] = await pool.query('SELECT * FROM stock_transfers WHERE transfer_id = ?', [id]);
    res.status(201).json(row);
  } catch (err) {
    console.error('[stockTransfers] POST /', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// PATCH /api/stock-transfers/:id/respond
router.patch('/:id/respond', async (req, res) => {
  const { action } = req.body; // ACCEPTED | REJECTED
  if (!['ACCEPTED', 'REJECTED'].includes(action)) {
    return res.status(400).json({ message: 'action must be ACCEPTED or REJECTED' });
  }

  const [[transfer]] = await pool.query('SELECT * FROM stock_transfers WHERE transfer_id = ?', [req.params.id]);
  if (!transfer) return res.status(404).json({ message: 'Not found' });

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    await conn.query(
      `UPDATE stock_transfers SET transfer_status = ?, responded_at = NOW(), updated_at = NOW()
       WHERE transfer_id = ?`,
      [action, req.params.id]
    );

    if (action === 'ACCEPTED') {
      const newStatus = ENTITY_STATUS_MAP[transfer.to_entity_type] || 'ALLOCATED_TO_DH';
      await conn.query(
        `UPDATE inventory_master
         SET status = ?, allocated_entity_id = ?, updated_at = NOW()
         WHERE inventory_id = ?`,
        [newStatus, transfer.to_entity_id, transfer.inventory_id]
      );
    }

    await conn.commit();
    res.json({ message: `Transfer ${action.toLowerCase()}` });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ message: err.message });
  } finally {
    conn.release();
  }
});

export default router;
