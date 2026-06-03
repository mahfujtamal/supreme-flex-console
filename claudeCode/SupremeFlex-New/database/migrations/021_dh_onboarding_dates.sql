-- Migration 021: Add onboarding and deboarding dates to distribution_houses

ALTER TABLE distribution_houses
  ADD COLUMN onboarded_at DATE NULL AFTER last_assigned_at,
  ADD COLUMN deboarded_at DATE NULL AFTER onboarded_at;
