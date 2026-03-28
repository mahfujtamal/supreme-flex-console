ALTER TABLE public.user_account ADD COLUMN IF NOT EXISTS password_hash text NOT NULL DEFAULT 'SupFlex@123';
ALTER TABLE public.user_account ADD COLUMN IF NOT EXISTS staff_type text;