'use client';

import { useState } from 'react';
import { resolveDeliveryAgent, type DeliveryContext, type DeliveryAgentType } from '@/lib/deliveryRouting';

export interface DeliveryOverride {
  overrideType: DeliveryAgentType;
  overrideEntityId: string;
  reason: string;
}

interface Props {
  context: DeliveryContext;
  onChange: (override: DeliveryOverride | null) => void;
}

const AGENT_LABELS: Record<DeliveryAgentType, string> = {
  DH:         'Distribution House',
  CHANNEL:    'Channel',
  SUBCHANNEL: 'Sub-Channel',
  KAM:        'KAM',
};

export function DeliveryOverrideSelector({ context, onChange }: Props) {
  const resolved = resolveDeliveryAgent(context);
  const [overriding, setOverriding] = useState(false);
  const [agentType, setAgentType]   = useState<DeliveryAgentType>(resolved.agentType);
  const [entityId, setEntityId]     = useState('');
  const [reason, setReason]         = useState('');

  function applyOverride() {
    if (!entityId.trim()) return;
    onChange({ overrideType: agentType, overrideEntityId: entityId.trim(), reason });
    setOverriding(false);
  }

  function clearOverride() {
    setOverriding(false);
    setEntityId('');
    setReason('');
    onChange(null);
  }

  return (
    <div className="space-y-2 rounded-lg border p-3 bg-muted/30">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Delivery Agent</p>
          <p className="text-sm font-medium mt-0.5">
            {resolved.label}
            {resolved.overridden && (
              <span className="ml-2 text-xs text-orange-600 font-normal">(overridden)</span>
            )}
          </p>
        </div>
        {!overriding && (
          <button type="button" onClick={() => setOverriding(true)} className="text-xs text-primary hover:underline shrink-0">
            Override
          </button>
        )}
      </div>

      {overriding && (
        <div className="space-y-2 pt-1 border-t">
          <div className="flex gap-2">
            <div className="flex-1 space-y-1">
              <label className="text-xs text-muted-foreground">Agent Type</label>
              <select
                className="border rounded px-2 py-1.5 text-sm w-full bg-background"
                value={agentType}
                onChange={e => setAgentType(e.target.value as DeliveryAgentType)}
              >
                {(Object.keys(AGENT_LABELS) as DeliveryAgentType[]).map(t => (
                  <option key={t} value={t}>{AGENT_LABELS[t]}</option>
                ))}
              </select>
            </div>
            <div className="flex-1 space-y-1">
              <label className="text-xs text-muted-foreground">Entity ID</label>
              <input
                className="border rounded px-2 py-1.5 text-sm w-full focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="UUID"
                value={entityId}
                onChange={e => setEntityId(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Reason (optional)</label>
            <input
              className="border rounded px-2 py-1.5 text-sm w-full focus:outline-none focus:ring-2 focus:ring-primary/30"
              placeholder="Why are you overriding the default?"
              value={reason}
              onChange={e => setReason(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={applyOverride} disabled={!entityId.trim()} className="px-3 py-1 bg-primary text-primary-foreground rounded text-xs hover:opacity-90 disabled:opacity-40">
              Apply
            </button>
            <button type="button" onClick={clearOverride} className="px-3 py-1 border rounded text-xs hover:bg-muted">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
