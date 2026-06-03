-- Migration 018: Add agent_category to field_agents
-- A field agent can be classified by operational role without hard-deactivating them.
-- NO_LEAD_NO_ACTIVATION effectively suspends the agent while keeping status = ACTIVE.

ALTER TABLE field_agents
  ADD COLUMN agent_category ENUM(
    'LEAD_GEN_AND_ACTIVATION',
    'LEAD_GEN_ONLY',
    'ACTIVATION_ONLY',
    'NO_LEAD_NO_ACTIVATION'
  ) NOT NULL DEFAULT 'LEAD_GEN_AND_ACTIVATION'
  AFTER msisdn;
