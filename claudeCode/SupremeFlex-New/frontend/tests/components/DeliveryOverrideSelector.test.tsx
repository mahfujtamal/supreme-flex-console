import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('@/lib/deliveryRouting', () => ({
  resolveDeliveryAgent: vi.fn(() => ({
    agentType: 'DH',
    entityId: 'dh-1',
    label: 'Distribution House (default)',
    overridden: false,
  })),
}));

import { DeliveryOverrideSelector } from '@/components/ui/DeliveryOverrideSelector';
import { resolveDeliveryAgent } from '@/lib/deliveryRouting';

const BASE_CTX = { customerType: 'B2C' as const };

describe('DeliveryOverrideSelector', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows resolved label and Override button by default', () => {
    render(<DeliveryOverrideSelector context={BASE_CTX} onChange={vi.fn()} />);
    expect(screen.getByText('Distribution House (default)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /override/i })).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('UUID')).not.toBeInTheDocument();
  });

  it('clicking Override shows form and hides Override button', async () => {
    render(<DeliveryOverrideSelector context={BASE_CTX} onChange={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: /override/i }));
    expect(screen.queryByRole('button', { name: /^override$/i })).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText('UUID')).toBeInTheDocument();
    expect(screen.getByText('Agent Type')).toBeInTheDocument();
    expect(screen.getByText('Reason (optional)')).toBeInTheDocument();
  });

  it('Apply button is disabled when Entity ID is empty', async () => {
    render(<DeliveryOverrideSelector context={BASE_CTX} onChange={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: /override/i }));
    expect(screen.getByRole('button', { name: /apply/i })).toBeDisabled();
  });

  it('Apply button is enabled once Entity ID is filled', async () => {
    render(<DeliveryOverrideSelector context={BASE_CTX} onChange={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: /override/i }));
    await userEvent.type(screen.getByPlaceholderText('UUID'), 'some-uuid');
    expect(screen.getByRole('button', { name: /apply/i })).not.toBeDisabled();
  });

  it('Apply calls onChange with correct override object and closes form', async () => {
    const onChange = vi.fn();
    render(<DeliveryOverrideSelector context={BASE_CTX} onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: /override/i }));
    await userEvent.type(screen.getByPlaceholderText('UUID'), 'entity-123');
    await userEvent.type(screen.getByPlaceholderText(/why are you overriding/i), 'test reason');
    await userEvent.click(screen.getByRole('button', { name: /apply/i }));
    expect(onChange).toHaveBeenCalledWith({
      overrideType: 'DH',
      overrideEntityId: 'entity-123',
      reason: 'test reason',
    });
    expect(screen.queryByPlaceholderText('UUID')).not.toBeInTheDocument();
  });

  it('Cancel calls onChange(null) and closes form', async () => {
    const onChange = vi.fn();
    render(<DeliveryOverrideSelector context={BASE_CTX} onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: /override/i }));
    await userEvent.type(screen.getByPlaceholderText('UUID'), 'entity-123');
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onChange).toHaveBeenCalledWith(null);
    expect(screen.queryByPlaceholderText('UUID')).not.toBeInTheDocument();
  });

  it('shows (overridden) tag when resolution is overridden', () => {
    vi.mocked(resolveDeliveryAgent).mockReturnValueOnce({
      agentType: 'CHANNEL',
      entityId: 'ch-1',
      label: 'Channel (override)',
      overridden: true,
    });
    render(<DeliveryOverrideSelector context={BASE_CTX} onChange={vi.fn()} />);
    expect(screen.getByText('(overridden)')).toBeInTheDocument();
  });
});
