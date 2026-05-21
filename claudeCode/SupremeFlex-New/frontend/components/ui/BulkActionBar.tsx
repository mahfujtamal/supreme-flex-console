'use client';

import { Trash2, Upload, RefreshCw, X } from 'lucide-react';
import { useDevMode } from '@/contexts/DevModeContext';

interface BulkActionBarProps {
  selectedCount: number;
  onBulkInsert?: () => void;
  onBulkUpdate?: () => void;
  onBulkDelete?: () => void;
  onClearSelection: () => void;
}

export function BulkActionBar({
  selectedCount,
  onBulkInsert,
  onBulkUpdate,
  onBulkDelete,
  onClearSelection,
}: BulkActionBarProps) {
  const { isDevMode } = useDevMode();

  if (selectedCount === 0) return null;

  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-blue-50 border border-blue-200 rounded-lg text-sm">
      <span className="text-blue-700 font-medium shrink-0">{selectedCount} selected</span>

      <div className="flex items-center gap-2">
        {onBulkInsert && (
          <button
            onClick={onBulkInsert}
            className="flex items-center gap-1.5 px-3 py-1 bg-white border rounded hover:bg-gray-50 text-xs"
          >
            <Upload className="w-3.5 h-3.5" />
            Insert
          </button>
        )}
        {onBulkUpdate && (
          <button
            onClick={onBulkUpdate}
            className="flex items-center gap-1.5 px-3 py-1 bg-white border rounded hover:bg-gray-50 text-xs"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Update
          </button>
        )}
        {isDevMode && onBulkDelete && (
          <button
            onClick={onBulkDelete}
            className="flex items-center gap-1.5 px-3 py-1 bg-red-50 border border-red-200 text-red-700 rounded hover:bg-red-100 text-xs"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete
          </button>
        )}
      </div>

      <button
        onClick={onClearSelection}
        className="ml-auto text-blue-500 hover:text-blue-700"
        aria-label="Clear selection"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
