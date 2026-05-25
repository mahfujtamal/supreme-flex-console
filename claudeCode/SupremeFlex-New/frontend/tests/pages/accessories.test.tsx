import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createWrapper } from '../helpers/wrapper';

vi.mock('@/lib/api', () => ({ phpApi: { get: vi.fn() } }));
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

import AccessoriesPage from '@/app/(app)/accessories/page';
import { phpApi } from '@/lib/api';

const mockRows = [
  { id: '1', customer_id: 'cust-0001', addon_product_id: 'prod-0001', gpshop_order_id: 'gp-1', status: 'ACTIVE',  activated_at: '2026-01-01', auto_cancel_at: null, created_at: '2026-01-01' },
  { id: '2', customer_id: 'cust-0002', addon_product_id: 'prod-0002', gpshop_order_id: null,   status: 'PENDING', activated_at: null,         auto_cancel_at: null, created_at: '2026-01-02' },
];

describe('AccessoriesPage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows loading state while fetching', () => {
    vi.mocked(phpApi.get).mockReturnValue(new Promise(() => {}));
    render(<AccessoriesPage />, { wrapper: createWrapper() });
    expect(screen.getByTestId('loading')).toBeInTheDocument();
  });

  it('renders table rows with data', async () => {
    vi.mocked(phpApi.get).mockResolvedValue({ data: mockRows });
    render(<AccessoriesPage />, { wrapper: createWrapper() });
    await waitFor(() => expect(screen.getAllByTestId('row')).toHaveLength(2));
    expect(screen.getByText('ACTIVE')).toBeInTheDocument();
    expect(screen.getByText('PENDING')).toBeInTheDocument();
  });

  it('renders gracefully with empty array', async () => {
    vi.mocked(phpApi.get).mockResolvedValue({ data: [] });
    render(<AccessoriesPage />, { wrapper: createWrapper() });
    await waitFor(() => expect(screen.queryByTestId('loading')).not.toBeInTheDocument());
    expect(screen.queryAllByTestId('row')).toHaveLength(0);
  });

  it('search input triggers refetch with search param', async () => {
    vi.mocked(phpApi.get).mockResolvedValue({ data: [] });
    render(<AccessoriesPage />, { wrapper: createWrapper() });
    await userEvent.type(screen.getByPlaceholderText(/search/i), 'test');
    await waitFor(() =>
      expect(phpApi.get).toHaveBeenCalledWith(
        '/addon-orders',
        expect.objectContaining({ params: expect.objectContaining({ search: 'test' }) })
      )
    );
  });

  it('does not crash when API rejects', async () => {
    vi.mocked(phpApi.get).mockRejectedValue(new Error('Network error'));
    render(<AccessoriesPage />, { wrapper: createWrapper() });
    await waitFor(() => expect(screen.queryByTestId('loading')).not.toBeInTheDocument());
  });
});
