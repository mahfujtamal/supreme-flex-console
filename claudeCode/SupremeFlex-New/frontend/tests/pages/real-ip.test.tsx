import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createWrapper } from '../helpers/wrapper';

vi.mock('@/lib/api', () => ({ phpApi: { get: vi.fn(), patch: vi.fn() } }));
vi.mock('@/hooks/useDebounce', () => ({ useDebounce: (v: unknown) => v }));
vi.mock('@/components/ui/StatusBadge', () => ({
  StatusBadge: ({ status }: { status: string }) => <span>{status}</span>,
}));
vi.mock('@/components/ui/DataTable', () => ({
  DataTable: ({ data, columns, isLoading }: any) =>
    isLoading ? (
      <div data-testid="loading">Loading…</div>
    ) : (
      <table>
        <tbody>
          {data.map((row: any, i: number) => (
            <tr key={i} data-testid="row">
              {columns.map((col: any) => (
                <td key={col.key}>{col.cell ? col.cell(row) : row[col.key]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    ),
}));
vi.mock('@/components/ui/ConfirmDialog', () => ({
  ConfirmDialog: ({ open, onConfirm, onOpenChange, confirmLabel }: any) =>
    open ? (
      <div data-testid="confirm-dialog">
        <button onClick={onConfirm}>{confirmLabel ?? 'Confirm'}</button>
        <button onClick={() => onOpenChange(false)}>Cancel</button>
      </div>
    ) : null,
}));

import RealIpPage from '@/app/(app)/real-ip/page';
import { phpApi } from '@/lib/api';

const mockRows = [
  { id: 'ip-1', customer_id: 'cust-0001', anchor_id: 'anch-0001', ip_address: '10.0.0.1', status: 'ACTIVE',   assigned_at: '2026-01-01', released_at: null,         created_at: '2026-01-01' },
  { id: 'ip-2', customer_id: 'cust-0002', anchor_id: 'anch-0002', ip_address: '10.0.0.2', status: 'RELEASED', assigned_at: '2026-01-02', released_at: '2026-01-10', created_at: '2026-01-02' },
];

describe('RealIpPage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders IP rows with ip_address and status', async () => {
    vi.mocked(phpApi.get).mockResolvedValue({ data: mockRows });
    render(<RealIpPage />, { wrapper: createWrapper() });
    await waitFor(() => expect(screen.getAllByTestId('row')).toHaveLength(2));
    expect(screen.getByText('10.0.0.1')).toBeInTheDocument();
    expect(screen.getByText('10.0.0.2')).toBeInTheDocument();
  });

  it('Release button only appears for ACTIVE rows', async () => {
    vi.mocked(phpApi.get).mockResolvedValue({ data: mockRows });
    render(<RealIpPage />, { wrapper: createWrapper() });
    await waitFor(() => expect(screen.getAllByTestId('row')).toHaveLength(2));
    expect(screen.getAllByRole('button', { name: /^release$/i })).toHaveLength(1);
  });

  it('clicking Release opens ConfirmDialog', async () => {
    vi.mocked(phpApi.get).mockResolvedValue({ data: mockRows });
    render(<RealIpPage />, { wrapper: createWrapper() });
    await waitFor(() => expect(screen.getByRole('button', { name: /^release$/i })).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: /^release$/i }));
    expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument();
  });

  it('confirming release calls phpApi.patch with RELEASED status for correct id', async () => {
    vi.mocked(phpApi.get).mockResolvedValue({ data: mockRows });
    vi.mocked(phpApi.patch).mockResolvedValue({ data: {} });
    render(<RealIpPage />, { wrapper: createWrapper() });
    await waitFor(() => expect(screen.getByRole('button', { name: /^release$/i })).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: /^release$/i }));
    // click confirm inside the dialog
    const dialogBtns = screen.getByTestId('confirm-dialog').querySelectorAll('button');
    await userEvent.click(dialogBtns[0]);
    await waitFor(() =>
      expect(phpApi.patch).toHaveBeenCalledWith('/real-ip/ip-1', { status: 'RELEASED' })
    );
  });

  it('cancelling dialog does not call phpApi.patch', async () => {
    vi.mocked(phpApi.get).mockResolvedValue({ data: mockRows });
    render(<RealIpPage />, { wrapper: createWrapper() });
    await waitFor(() => expect(screen.getByRole('button', { name: /^release$/i })).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: /^release$/i }));
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(phpApi.patch).not.toHaveBeenCalled();
    expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument();
  });
});
