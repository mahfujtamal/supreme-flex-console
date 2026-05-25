'use client';

import { cn } from '@/lib/utils';

const STATUS_COLORS: Record<string, string> = {
  ACTIVE:              'bg-green-100 text-green-800',
  INACTIVE:            'bg-gray-100 text-gray-600',
  PENDING:             'bg-yellow-100 text-yellow-800',
  ACCEPTED:            'bg-green-100 text-green-800',
  REJECTED:            'bg-red-100 text-red-800',
  COMPLETED:           'bg-blue-100 text-blue-800',
  CANCELLED:           'bg-gray-100 text-gray-500',
  IN_PROGRESS:         'bg-blue-50 text-blue-700',
  WITH_FIELD_STAFF:    'bg-orange-100 text-orange-800',
  ALLOCATED_TO_DH:     'bg-purple-100 text-purple-800',
  ALLOCATED_TO_KAM:    'bg-indigo-100 text-indigo-800',
  WITH_HUB_MANAGER:    'bg-teal-100 text-teal-800',
  AVAILABLE:           'bg-green-50 text-green-700',
  RESERVED:            'bg-yellow-50 text-yellow-700',
  ACTIVATED:           'bg-emerald-100 text-emerald-800',
  CHURNED:             'bg-red-50 text-red-600',
  SUSPENDED:           'bg-orange-50 text-orange-700',
};

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const color = STATUS_COLORS[status] ?? 'bg-gray-100 text-gray-600';
  const label = status.replace(/_/g, ' ');
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap',
        color,
        className,
      )}
    >
      {label}
    </span>
  );
}
