import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createWrapper } from '../helpers/wrapper';

vi.mock('@/lib/api', () => ({ phpApi: { get: vi.fn(), post: vi.fn() } }));
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

import LocationChangePage from '@/app/(app)/location-change/page';
import { phpApi } from '@/lib/api';

const mockHistory = [
  { id: '1', customer_id: 'cust-0001', anchor_id: 'anch-0001', new_area_id: 'area-0001', status: 'COMPLETED', completed_at: '2026-01-02', notes: null, created_at: '2026-01-01' },
];

// All UUID fields share placeholder="UUID"; notes uses "Optional reason…"
// Order after clicking New Request: [0]=customer_id [1]=anchor_id [2]=active_service_id [3]=new_area_id
function getUuidInputs() { return screen.getAllByPlaceholderText('UUID'); }
function getNotesInput()  { return screen.getByPlaceholderText(/optional reason/i); }

describe('LocationChangePage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('History tab is shown by default and renders rows', async () => {
    vi.mocked(phpApi.get).mockResolvedValue({ data: mockHistory });
    render(<LocationChangePage />, { wrapper: createWrapper() });
    await waitFor(() => expect(screen.getAllByTestId('row')).toHaveLength(1));
    expect(screen.getByText('COMPLETED')).toBeInTheDocument();
  });

  it('New Request tab click reveals form and Submit button', async () => {
    vi.mocked(phpApi.get).mockResolvedValue({ data: [] });
    render(<LocationChangePage />, { wrapper: createWrapper() });
    await userEvent.click(screen.getByRole('tab', { name: /new request/i }));
    expect(getUuidInputs()).toHaveLength(4);
    expect(getNotesInput()).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /submit request/i })).toBeInTheDocument();
  });

  it('submit with empty required fields does not call phpApi.post', async () => {
    vi.mocked(phpApi.get).mockResolvedValue({ data: [] });
    render(<LocationChangePage />, { wrapper: createWrapper() });
    await userEvent.click(screen.getByRole('tab', { name: /new request/i }));
    await userEvent.click(screen.getByRole('button', { name: /submit request/i }));
    expect(phpApi.post).not.toHaveBeenCalled();
  });

  it('successful submit calls phpApi.post and shows success message', async () => {
    vi.mocked(phpApi.get).mockResolvedValue({ data: [] });
    vi.mocked(phpApi.post).mockResolvedValue({ data: { id: 'new-lc' } });
    render(<LocationChangePage />, { wrapper: createWrapper() });
    await userEvent.click(screen.getByRole('tab', { name: /new request/i }));
    const [custInput, anchInput, svcInput, areaInput] = getUuidInputs();
    await userEvent.type(custInput, 'cust-1');
    await userEvent.type(anchInput, 'anch-1');
    await userEvent.type(svcInput,  'svc-1');
    await userEvent.type(areaInput, 'area-1');
    await userEvent.click(screen.getByRole('button', { name: /submit request/i }));
    await waitFor(() =>
      expect(phpApi.post).toHaveBeenCalledWith('/location-changes', expect.objectContaining({
        customer_id: 'cust-1', anchor_id: 'anch-1',
        active_service_id: 'svc-1', new_area_id: 'area-1',
      }))
    );
    await waitFor(() =>
      expect(screen.getByText(/submitted successfully/i)).toBeInTheDocument()
    );
  });

  it('failed submit shows error message and does not clear form', async () => {
    vi.mocked(phpApi.get).mockResolvedValue({ data: [] });
    vi.mocked(phpApi.post).mockRejectedValue(new Error('Server error'));
    render(<LocationChangePage />, { wrapper: createWrapper() });
    await userEvent.click(screen.getByRole('tab', { name: /new request/i }));
    const [custInput, anchInput, svcInput, areaInput] = getUuidInputs();
    await userEvent.type(custInput, 'cust-1');
    await userEvent.type(anchInput, 'anch-1');
    await userEvent.type(svcInput,  'svc-1');
    await userEvent.type(areaInput, 'area-1');
    await userEvent.click(screen.getByRole('button', { name: /submit request/i }));
    await waitFor(() =>
      expect(screen.getByText(/failed to submit/i)).toBeInTheDocument()
    );
    expect(getUuidInputs()[0]).toHaveValue('cust-1');
  });

  it('notes field is optional — submit succeeds without it', async () => {
    vi.mocked(phpApi.get).mockResolvedValue({ data: [] });
    vi.mocked(phpApi.post).mockResolvedValue({ data: {} });
    render(<LocationChangePage />, { wrapper: createWrapper() });
    await userEvent.click(screen.getByRole('tab', { name: /new request/i }));
    const [custInput, anchInput, svcInput, areaInput] = getUuidInputs();
    await userEvent.type(custInput, 'c');
    await userEvent.type(anchInput, 'a');
    await userEvent.type(svcInput,  's');
    await userEvent.type(areaInput, 'r');
    await userEvent.click(screen.getByRole('button', { name: /submit request/i }));
    await waitFor(() => expect(phpApi.post).toHaveBeenCalled());
  });
});
