export type DeliveryAgentType = 'DH' | 'CHANNEL' | 'SUBCHANNEL' | 'KAM';

export interface DeliveryContext {
  customerType: 'B2B' | 'B2C';
  kamId?: string;
  channelDefaultDeliveryMode?: 'DH' | 'OWN';
  subChannelDeliveryOwnership?: 'FOLLOW_CHANNEL' | 'SELF_DELIVERY' | 'DH_DELIVERY';
  channelId?: string;
  subChannelId?: string;
  dhId?: string;
  /** Set when a per-order override already exists (loaded from order_delivery_overrides). */
  existingOverride?: { overrideType: DeliveryAgentType; overrideEntityId: string };
}

export interface DeliveryResolution {
  agentType: DeliveryAgentType;
  entityId: string | null;
  label: string;
  overridden: boolean;
}

/**
 * Resolves the delivery agent using the 5-priority B2C resolution order
 * defined in SupremeFlex_Consolidated_Requirements.md §3.2.
 * B2B always routes to KAM.
 */
export function resolveDeliveryAgent(ctx: DeliveryContext): DeliveryResolution {
  if (ctx.customerType === 'B2B') {
    return { agentType: 'KAM', entityId: ctx.kamId ?? null, label: 'KAM', overridden: false };
  }

  // Priority 1: sub-channel per-order override
  if (ctx.existingOverride?.overrideType === 'SUBCHANNEL') {
    return { agentType: 'SUBCHANNEL', entityId: ctx.existingOverride.overrideEntityId, label: 'Sub-Channel (override)', overridden: true };
  }

  // Priority 2: sub-channel SELF_DELIVERY
  if (ctx.subChannelDeliveryOwnership === 'SELF_DELIVERY' && ctx.subChannelId) {
    return { agentType: 'SUBCHANNEL', entityId: ctx.subChannelId, label: 'Sub-Channel (own delivery)', overridden: false };
  }

  // Priority 3: channel per-order override
  if (ctx.existingOverride?.overrideType === 'CHANNEL') {
    return { agentType: 'CHANNEL', entityId: ctx.existingOverride.overrideEntityId, label: 'Channel (override)', overridden: true };
  }

  // Priority 4: channel default OWN
  if (ctx.channelDefaultDeliveryMode === 'OWN' && ctx.channelId) {
    return { agentType: 'CHANNEL', entityId: ctx.channelId, label: 'Channel (own delivery)', overridden: false };
  }

  // Priority 5: DH global default
  return { agentType: 'DH', entityId: ctx.dhId ?? null, label: 'Distribution House (default)', overridden: false };
}
