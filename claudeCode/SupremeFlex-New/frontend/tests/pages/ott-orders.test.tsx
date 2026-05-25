import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
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

import OttOrdersPage from '@/app/(app)/ott-orders/page';
import { phpApi } from '@/lib/api';

const mockRows = [
  { id: '1', customer_id: 'cust-0001', ott_product_id: 'ott-0001', status: 'ACTIVE',    activated_at: '2026-01-01', notes: null,  created_at: '2026-01-01' },
  { id: '2', customer_id: 'cust-0002', ott_product_id: 'ott-0002', status: 'CANCELLED', activated_at: null,         notes: 'n/a', created_at: '2026-01-02' },
];

describe('OttOrdersPage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows loading state while fetching', () => {
    vi.mocked(phpApi.get).mockReturnValue(new Promise(() => {}));
    render(<OttOrdersPage />, { wrapper: createWrapper() });
    expect(screen.getByTestId('loading')).toBeInTheDocument();
  });

  it('renders table rows with data', async () => {
    vi.mocked(phpApi.get).mockResolvedValue({ data: mockRows });
    render(<OttOrdersPage />, { wrapper: createWrapper() });
    await waitFor(() => expect(screen.getAllByTestId('row')).toHaveLength(2));
    expect(screen.getByText('ACTIVE')).toBeInTheDocument();
    expect(screen.getByText('CANCELLED')).toBeInTheDocument();
  });

  it('renders gracefully with empty array', async () => {
    vi.mocked(phpApi.get).mockResolvedValue({ data: [] });
    render(<OttOrdersPage />, { wrapper: createWrapper() });
    await waitFor(() => expect(screen.queryByTestId('loading')).not.toBeInTheDocument());
    expect(screen.queryAllByTestId('row')).toHaveLength(0);
  });

  it('search input is present in the DOM', async () => {
    vi.mocked(phpApi.get).mockResolvedValue({ data: [] });
    render(<OttOrdersPage />, { wrapper: createWrapper() });
    expect(screen.getByPlaceholderText(/search/i)).toBeInTheDocument();
  });
});
