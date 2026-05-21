'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface Column<T> {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  rowKey: (row: T) => string;
  isLoading?: boolean;
  page: number;
  totalPages?: number;
  onPageChange: (page: number) => void;
  selectedIds?: Set<string>;
  onSelectionChange?: (ids: Set<string>) => void;
}

export function DataTable<T>({
  columns,
  data,
  rowKey,
  isLoading = false,
  page,
  totalPages,
  onPageChange,
  selectedIds,
  onSelectionChange,
}: DataTableProps<T>) {
  const selectable = !!onSelectionChange;
  const allSelected =
    selectable && data.length > 0 && data.every(r => selectedIds?.has(rowKey(r)));
  const colSpan = columns.length + (selectable ? 1 : 0);

  function toggleAll() {
    if (!onSelectionChange) return;
    const next = new Set(selectedIds);
    if (allSelected) {
      data.forEach(r => next.delete(rowKey(r)));
    } else {
      data.forEach(r => next.add(rowKey(r)));
    }
    onSelectionChange(next);
  }

  function toggleRow(id: string) {
    if (!onSelectionChange) return;
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    onSelectionChange(next);
  }

  return (
    <div className="space-y-3">
      <div className="rounded-md border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              {selectable && (
                <th className="w-10 px-3 py-2">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    className="rounded"
                    aria-label="Select all rows"
                  />
                </th>
              )}
              {columns.map(col => (
                <th
                  key={col.key}
                  className={cn('px-3 py-2 text-left font-medium text-muted-foreground', col.className)}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={colSpan} className="px-3 py-8 text-center text-muted-foreground text-sm">
                  Loading…
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={colSpan} className="px-3 py-8 text-center text-muted-foreground text-sm">
                  No records found.
                </td>
              </tr>
            ) : (
              data.map(row => {
                const id = rowKey(row);
                const isSelected = selectedIds?.has(id) ?? false;
                return (
                  <tr
                    key={id}
                    className={cn('border-t transition-colors', isSelected ? 'bg-blue-50' : 'hover:bg-muted/30')}
                  >
                    {selectable && (
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleRow(id)}
                          className="rounded"
                          aria-label="Select row"
                        />
                      </td>
                    )}
                    {columns.map(col => (
                      <td key={col.key} className={cn('px-3 py-2', col.className)}>
                        {col.cell(row)}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {selectable && selectedIds && selectedIds.size > 0
            ? `${selectedIds.size} selected`
            : `${data.length} row${data.length === 1 ? '' : 's'}`}
        </span>
        <div className="flex items-center gap-2">
          <button
            disabled={page === 0}
            onClick={() => onPageChange(page - 1)}
            className="px-2 py-1 border rounded text-xs disabled:opacity-40 hover:bg-muted"
          >
            ‹ Prev
          </button>
          <span className="text-xs">
            Page {page + 1}{totalPages != null ? ` of ${totalPages}` : ''}
          </span>
          <button
            disabled={totalPages != null && page + 1 >= totalPages}
            onClick={() => onPageChange(page + 1)}
            className="px-2 py-1 border rounded text-xs disabled:opacity-40 hover:bg-muted"
          >
            Next ›
          </button>
        </div>
      </div>
    </div>
  );
}
