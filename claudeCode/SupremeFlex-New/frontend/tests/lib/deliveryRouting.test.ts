import { describe, it, expect } from 'vitest';
import { resolveDeliveryAgent, type DeliveryContext } from '@/lib/deliveryRouting';

const B2C: Pick<DeliveryContext, 'customerType'> = { customerType: 'B2C' };

describe('resolveDeliveryAgent — B2B', () => {
  it('routes to KAM with kamId', () => {
    const r = resolveDeliveryAgent({ customerType: 'B2B', kamId: 'kam-1' });
    expect(r).toEqual({ agentType: 'KAM', entityId: 'kam-1', label: 'KAM', overridden: false });
  });

  it('routes to KAM with null entityId when kamId absent', () => {
    const r = resolveDeliveryAgent({ customerType: 'B2B' });
    expect(r.agentType).toBe('KAM');
    expect(r.entityId).toBeNull();
  });
});

describe('resolveDeliveryAgent — Priority 1: SUBCHANNEL override', () => {
  it('returns SUBCHANNEL override when existingOverride is SUBCHANNEL', () => {
    const r = resolveDeliveryAgent({
      ...B2C,
      existingOverride: { overrideType: 'SUBCHANNEL', overrideEntityId: 'sc-1' },
    });
    expect(r.agentType).toBe('SUBCHANNEL');
    expect(r.entityId).toBe('sc-1');
    expect(r.overridden).toBe(true);
  });

  it('override beats SELF_DELIVERY (priority 1 > 2)', () => {
    const r = resolveDeliveryAgent({
      ...B2C,
      subChannelDeliveryOwnership: 'SELF_DELIVERY',
      subChannelId: 'sc-2',
      existingOverride: { overrideType: 'SUBCHANNEL', overrideEntityId: 'sc-1' },
    });
    expect(r.entityId).toBe('sc-1');
    expect(r.overridden).toBe(true);
  });
});

describe('resolveDeliveryAgent — Priority 2: SELF_DELIVERY', () => {
  it('returns sub-channel own delivery when SELF_DELIVERY + subChannelId', () => {
    const r = resolveDeliveryAgent({
      ...B2C,
      subChannelDeliveryOwnership: 'SELF_DELIVERY',
      subChannelId: 'sc-2',
    });
    expect(r.agentType).toBe('SUBCHANNEL');
    expect(r.entityId).toBe('sc-2');
    expect(r.overridden).toBe(false);
    expect(r.label).toBe('Sub-Channel (own delivery)');
  });

  it('falls through when SELF_DELIVERY but no subChannelId', () => {
    const r = resolveDeliveryAgent({ ...B2C, subChannelDeliveryOwnership: 'SELF_DELIVERY' });
    expect(r.agentType).toBe('DH');
  });

  it('falls through for FOLLOW_CHANNEL ownership', () => {
    const r = resolveDeliveryAgent({ ...B2C, subChannelDeliveryOwnership: 'FOLLOW_CHANNEL', subChannelId: 'sc-3' });
    expect(r.agentType).toBe('DH');
  });
});

describe('resolveDeliveryAgent — Priority 3: CHANNEL override', () => {
  it('returns CHANNEL override when existingOverride is CHANNEL', () => {
    const r = resolveDeliveryAgent({
      ...B2C,
      existingOverride: { overrideType: 'CHANNEL', overrideEntityId: 'ch-1' },
    });
    expect(r.agentType).toBe('CHANNEL');
    expect(r.entityId).toBe('ch-1');
    expect(r.overridden).toBe(true);
  });
});

describe('resolveDeliveryAgent — Priority 4: Channel OWN default', () => {
  it('returns channel own delivery when channelDefaultDeliveryMode OWN + channelId', () => {
    const r = resolveDeliveryAgent({
      ...B2C,
      channelDefaultDeliveryMode: 'OWN',
      channelId: 'ch-2',
    });
    expect(r.agentType).toBe('CHANNEL');
    expect(r.entityId).toBe('ch-2');
    expect(r.overridden).toBe(false);
    expect(r.label).toBe('Channel (own delivery)');
  });

  it('falls through when OWN but no channelId', () => {
    const r = resolveDeliveryAgent({ ...B2C, channelDefaultDeliveryMode: 'OWN' });
    expect(r.agentType).toBe('DH');
  });

  it('falls through when channelDefaultDeliveryMode is DH', () => {
    const r = resolveDeliveryAgent({ ...B2C, channelDefaultDeliveryMode: 'DH', channelId: 'ch-3' });
    expect(r.agentType).toBe('DH');
  });
});

describe('resolveDeliveryAgent — Priority 5: DH default', () => {
  it('returns DH with entityId when dhId provided', () => {
    const r = resolveDeliveryAgent({ ...B2C, dhId: 'dh-1' });
    expect(r.agentType).toBe('DH');
    expect(r.entityId).toBe('dh-1');
    expect(r.overridden).toBe(false);
    expect(r.label).toBe('Distribution House (default)');
  });

  it('returns DH with null entityId when nothing is set', () => {
    const r = resolveDeliveryAgent({ ...B2C });
    expect(r.agentType).toBe('DH');
    expect(r.entityId).toBeNull();
  });
});
