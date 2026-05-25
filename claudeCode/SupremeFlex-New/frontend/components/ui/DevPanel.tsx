'use client';

import { cn } from '@/lib/utils';
import { useDevMode } from '@/contexts/DevModeContext';

export function DevPanel() {
  const { isDevMode, toggleDevMode } = useDevMode();

  return (
    <div
      className={cn(
        'fixed bottom-4 right-4 z-50 rounded-lg border shadow-lg bg-white p-3 text-xs space-y-2 min-w-36',
        isDevMode ? 'border-orange-400' : 'border-gray-200',
      )}
    >
      <div className="flex items-center gap-2 font-medium">
        <span className={cn('w-2 h-2 rounded-full', isDevMode ? 'bg-orange-400' : 'bg-gray-300')} />
        Dev Mode
      </div>
      <label className="flex items-center gap-2 cursor-pointer select-none">
        <input type="checkbox" checked={isDevMode} onChange={toggleDevMode} className="rounded" />
        <span>{isDevMode ? 'ON — bulk delete visible' : 'OFF'}</span>
      </label>
    </div>
  );
}
