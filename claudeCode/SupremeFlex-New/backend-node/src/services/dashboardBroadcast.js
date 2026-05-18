import { pool } from './db.js';

export async function broadcastDashboard() {
  const [[gpfi]]  = await pool.query(`
    SELECT
      SUM(status = 'IN_GPFI_STAGING')  AS staging,
      SUM(status = 'WITH_HUB_MANAGER') AS hub_manager,
      SUM(status = 'WITH_FIELD_STAFF') AS field_staff,
      SUM(status = 'DELIVERED')         AS delivered
    FROM inventory_master
  `);

  const [fieldRows] = await pool.query(`
    SELECT fa.agent_id, fa.agent_name,
      SUM(im.status = 'WITH_FIELD_STAFF') AS stock_count,
      SUM(o.order_status = 'OUT_FOR_DELIVERY') AS pending_deliveries
    FROM field_agents fa
    LEFT JOIN inventory_master im ON im.allocated_agent_id = fa.agent_id
    LEFT JOIN orders o ON o.assigned_agent_id = fa.agent_id
    GROUP BY fa.agent_id, fa.agent_name
  `);

  return { gpfi, field_execution: fieldRows };
}
