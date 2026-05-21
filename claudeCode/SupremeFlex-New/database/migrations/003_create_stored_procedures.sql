-- ============================================================
-- SupremeFlex MySQL Stored Procedures
-- 003_create_stored_procedures.sql
-- Equivalent of 3 Supabase RPC functions
-- ============================================================

DELIMITER $$

-- ============================================================
-- 1. has_role(user_id, role_name) → BOOLEAN
-- Equivalent of Supabase has_role() SECURITY DEFINER function
-- ============================================================
DROP PROCEDURE IF EXISTS `has_role`$$
CREATE PROCEDURE `has_role`(
  IN  p_user_id   BINARY(16),
  IN  p_role_name VARCHAR(100),
  OUT p_result    TINYINT(1)
)
BEGIN
  SELECT COUNT(*) INTO p_result
  FROM `user_role` ur
  INNER JOIN `role_master` rm ON ur.role_id = rm.role_id
  WHERE ur.user_id = p_user_id
    AND rm.role_name = p_role_name;

  SET p_result = IF(p_result > 0, 1, 0);
END$$

-- ============================================================
-- 2. check_and_release_referral_reward(ledger_id)
-- Returns the updated reward_status as an OUT parameter
-- Equivalent of Supabase check_and_release_referral_reward() RPC
-- ============================================================
DROP PROCEDURE IF EXISTS `check_and_release_referral_reward`$$
CREATE PROCEDURE `check_and_release_referral_reward`(
  IN  p_ledger_id BINARY(16),
  OUT p_status    VARCHAR(50)
)
proc_label: BEGIN
  DECLARE v_service_active TINYINT(1);
  DECLARE v_invoice_paid   TINYINT(1);
  DECLARE v_current_status VARCHAR(50);
  DECLARE v_new_status     VARCHAR(50);
  DECLARE v_log            JSON;

  -- Fetch current state
  SELECT reward_status, referee_service_active, referee_invoice_paid, notification_log
  INTO v_current_status, v_service_active, v_invoice_paid, v_log
  FROM `referral_reward_ledger`
  WHERE ledger_id = p_ledger_id
  LIMIT 1;

  -- Skip if already in terminal state
  IF v_current_status IN ('EARNED', 'APPLIED', 'FORCE_APPROVED') THEN
    SET p_status = v_current_status;
    LEAVE proc_label;
  END IF;

  -- Determine new status
  IF v_service_active = 1 AND v_invoice_paid = 1 THEN
    SET v_new_status = 'EARNED';
  ELSEIF v_service_active = 1 AND v_invoice_paid = 0 THEN
    SET v_new_status = 'AWAITING_PAYMENT';
  ELSEIF v_service_active = 0 AND v_invoice_paid = 1 THEN
    SET v_new_status = 'AWAITING_ACTIVATION';
  ELSE
    SET v_new_status = 'PENDING';
  END IF;

  -- Update and log if status changed
  IF v_new_status != v_current_status THEN
    SET v_log = JSON_ARRAY_APPEND(
      IFNULL(v_log, JSON_ARRAY()),
      '$',
      JSON_OBJECT(
        'event',      CONCAT('status_changed_to_', v_new_status),
        'from_status', v_current_status,
        'timestamp',  NOW()
      )
    );

    UPDATE `referral_reward_ledger`
    SET reward_status   = v_new_status,
        earned_at       = IF(v_new_status = 'EARNED' AND earned_at IS NULL, NOW(), earned_at),
        notification_log = v_log,
        updated_at      = CURRENT_TIMESTAMP
    WHERE ledger_id = p_ledger_id;
  END IF;

  SET p_status = v_new_status;
END$$

-- ============================================================
-- 3. force_approve_referral_reward(ledger_id, admin_name)
-- Equivalent of Supabase force_approve_referral_reward() RPC
-- ============================================================
DROP PROCEDURE IF EXISTS `force_approve_referral_reward`$$
CREATE PROCEDURE `force_approve_referral_reward`(
  IN p_ledger_id  BINARY(16),
  IN p_admin_name VARCHAR(200)
)
BEGIN
  DECLARE v_current_status VARCHAR(50);
  DECLARE v_log            JSON;

  SELECT reward_status, notification_log
  INTO v_current_status, v_log
  FROM `referral_reward_ledger`
  WHERE ledger_id = p_ledger_id
  LIMIT 1;

  -- Only act if not already in terminal state
  IF v_current_status NOT IN ('EARNED', 'APPLIED', 'FORCE_APPROVED') THEN
    SET v_log = JSON_ARRAY_APPEND(
      IFNULL(v_log, JSON_ARRAY()),
      '$',
      JSON_OBJECT(
        'event',      'force_approved',
        'by',         IFNULL(p_admin_name, 'System'),
        'timestamp',  NOW()
      )
    );

    UPDATE `referral_reward_ledger`
    SET reward_status     = 'FORCE_APPROVED',
        force_approved_at = NOW(),
        force_approved_by = IFNULL(p_admin_name, 'System'),
        earned_at         = IFNULL(earned_at, NOW()),
        notification_log  = v_log,
        updated_at        = CURRENT_TIMESTAMP
    WHERE ledger_id = p_ledger_id;
  END IF;
END$$

DELIMITER ;
