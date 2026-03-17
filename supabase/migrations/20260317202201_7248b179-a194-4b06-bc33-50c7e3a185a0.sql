
-- Rename contact_msisdn to primary_contact_number on customers
ALTER TABLE public.customers RENAME COLUMN contact_msisdn TO primary_contact_number;

-- Add gpfi_msisdn to active_services
ALTER TABLE public.active_services ADD COLUMN gpfi_msisdn text UNIQUE;
