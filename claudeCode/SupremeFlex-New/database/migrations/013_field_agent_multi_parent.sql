-- Migration 013: Add channel_id and sub_channel_id to field_agents
-- Agents can belong to a DH, a Channel (own delivery), or a Sub-channel (self-delivery)
-- Only one FK is populated per row; dh_id already exists

ALTER TABLE field_agents
  ADD COLUMN channel_id     BINARY(16) NULL AFTER dh_id,
  ADD COLUMN sub_channel_id BINARY(16) NULL AFTER channel_id,
  ADD CONSTRAINT fk_fa_channel     FOREIGN KEY (channel_id)     REFERENCES channels(channel_id),
  ADD CONSTRAINT fk_fa_subchannel  FOREIGN KEY (sub_channel_id) REFERENCES sub_channels(sub_channel_id);

CREATE INDEX idx_fa_channel_id     ON field_agents (channel_id);
CREATE INDEX idx_fa_sub_channel_id ON field_agents (sub_channel_id);
