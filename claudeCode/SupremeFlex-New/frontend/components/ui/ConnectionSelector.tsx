'use client';

import * as Select from '@radix-ui/react-select';
import { ChevronDown, Check } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { phpApi } from '@/lib/api';
import { cn } from '@/lib/utils';

interface Connection {
  anchor_id: string;
  active_service_id: string;
  label: string;
}

interface ConnectionSelectorProps {
  customerId: string;
  value: string | null;
  onChange: (activeServiceId: string, anchorId: string) => void;
  className?: string;
}

export function ConnectionSelector({ customerId, value, onChange, className }: ConnectionSelectorProps) {
  const { data: connections = [], isLoading } = useQuery({
    queryKey: ['customer-connections', customerId],
    queryFn: () =>
      phpApi.get<Connection[]>(`/customers/${customerId}/connections`).then(r => r.data),
    enabled: !!customerId,
  });

  return (
    <Select.Root
      value={value ?? ''}
      onValueChange={val => {
        const conn = connections.find(c => c.active_service_id === val);
        if (conn) onChange(conn.active_service_id, conn.anchor_id);
      }}
    >
      <Select.Trigger
        className={cn(
          'flex items-center gap-2 border rounded px-3 py-1.5 text-sm bg-white min-w-52 focus:outline-none focus:ring-2 focus:ring-blue-500',
          className,
        )}
      >
        <Select.Value placeholder={isLoading ? 'Loading…' : 'Select connection'} />
        <ChevronDown className="w-4 h-4 ml-auto text-muted-foreground shrink-0" />
      </Select.Trigger>

      <Select.Portal>
        <Select.Content className="bg-white border rounded-md shadow-lg z-50 max-h-60 overflow-auto">
          <Select.Viewport>
            {connections.map(conn => (
              <Select.Item
                key={conn.active_service_id}
                value={conn.active_service_id}
                className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer outline-none data-[highlighted]:bg-muted"
              >
                <Select.ItemText>{conn.label}</Select.ItemText>
                <Select.ItemIndicator className="ml-auto">
                  <Check className="w-3.5 h-3.5" />
                </Select.ItemIndicator>
              </Select.Item>
            ))}
            {!isLoading && connections.length === 0 && (
              <div className="px-3 py-2 text-sm text-muted-foreground">No connections found</div>
            )}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}
