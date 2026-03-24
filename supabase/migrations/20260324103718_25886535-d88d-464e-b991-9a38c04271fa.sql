
-- 1. Create reward status enum
CREATE TYPE public.referral_reward_status AS ENUM (
  'PENDING',
  'AWAITING_ACTIVATION',
  'AWAITING_PAYMENT',
  'EARNED',
  'APPLIED',
  'FORCE_APPROVED'
);

-- 2. Create referral_reward_ledger table
CREATE TABLE public.referral_reward_ledger (
  ledger_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES public.referral_programs(program_id) ON DELETE CASCADE,
  referrer_customer_id UUID NOT NULL REFERENCES public.customers(customer_id),
  referee_customer_id UUID NOT NULL REFERENCES public.customers(customer_id),
  referral_code TEXT NOT NULL,
  reward_status public.referral_reward_status NOT NULL DEFAULT 'PENDING',
  reward_rule_snapshot JSONB NOT NULL DEFAULT '{}',
  referee_service_active BOOLEAN NOT NULL DEFAULT false,
  referee_invoice_paid BOOLEAN NOT NULL DEFAULT false,
  earned_at TIMESTAMPTZ,
  applied_at TIMESTAMPTZ,
  force_approved_by TEXT,
  force_approved_at TIMESTAMPTZ,
  notification_log JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Add updated_at trigger
CREATE TRIGGER update_referral_reward_ledger_updated_at
  BEFORE UPDATE ON public.referral_reward_ledger
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Add reward_on_signup column to referral_programs
ALTER TABLE public.referral_programs ADD COLUMN reward_on_signup BOOLEAN NOT NULL DEFAULT false;

-- 5. RLS policies (dev-mode full access)
ALTER TABLE public.referral_reward_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY dev_full_select ON public.referral_reward_ledger FOR SELECT TO public USING (true);
CREATE POLICY dev_full_insert ON public.referral_reward_ledger FOR INSERT TO public WITH CHECK (true);
CREATE POLICY dev_full_update ON public.referral_reward_ledger FOR UPDATE TO public USING (true) WITH CHECK (true);
CREATE POLICY dev_full_delete ON public.referral_reward_ledger FOR DELETE TO public USING (true);

-- 6. DB function: check and release reward when both conditions met
CREATE OR REPLACE FUNCTION public.check_and_release_referral_reward(
  p_ledger_id UUID
) RETURNS public.referral_reward_status
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_record referral_reward_ledger%ROWTYPE;
  v_new_status referral_reward_status;
BEGIN
  SELECT * INTO v_record FROM referral_reward_ledger WHERE ledger_id = p_ledger_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ledger record not found';
  END IF;

  -- Already earned or applied
  IF v_record.reward_status IN ('EARNED', 'APPLIED', 'FORCE_APPROVED') THEN
    RETURN v_record.reward_status;
  END IF;

  -- Determine intermediate status
  IF v_record.referee_service_active AND v_record.referee_invoice_paid THEN
    v_new_status := 'EARNED';
    UPDATE referral_reward_ledger
    SET reward_status = 'EARNED', earned_at = now(),
        notification_log = notification_log || jsonb_build_array(jsonb_build_object(
          'event', 'EARNED', 'timestamp', now()::text,
          'message', 'Both conditions met: service active + invoice paid'
        ))
    WHERE ledger_id = p_ledger_id;
  ELSIF v_record.referee_service_active AND NOT v_record.referee_invoice_paid THEN
    v_new_status := 'AWAITING_PAYMENT';
    UPDATE referral_reward_ledger SET reward_status = 'AWAITING_PAYMENT' WHERE ledger_id = p_ledger_id;
  ELSIF NOT v_record.referee_service_active AND v_record.referee_invoice_paid THEN
    v_new_status := 'AWAITING_ACTIVATION';
    UPDATE referral_reward_ledger SET reward_status = 'AWAITING_ACTIVATION' WHERE ledger_id = p_ledger_id;
  ELSE
    v_new_status := 'PENDING';
  END IF;

  RETURN v_new_status;
END;
$$;

-- 7. DB function: force approve a pending reward
CREATE OR REPLACE FUNCTION public.force_approve_referral_reward(
  p_ledger_id UUID,
  p_admin_name TEXT DEFAULT 'System'
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE referral_reward_ledger
  SET reward_status = 'FORCE_APPROVED',
      earned_at = COALESCE(earned_at, now()),
      force_approved_by = p_admin_name,
      force_approved_at = now(),
      notification_log = notification_log || jsonb_build_array(jsonb_build_object(
        'event', 'FORCE_APPROVED', 'timestamp', now()::text,
        'admin', p_admin_name
      ))
  WHERE ledger_id = p_ledger_id
    AND reward_status NOT IN ('EARNED', 'APPLIED', 'FORCE_APPROVED');
END;
$$;
