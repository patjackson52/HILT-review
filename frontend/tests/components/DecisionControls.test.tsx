import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DecisionControls } from '../../src/components/DecisionControls';

describe('DecisionControls', () => {
  it('renders approve and deny buttons for pending task', () => {
    const onSubmit = vi.fn();
    render(
      <DecisionControls
        status="PENDING"
        onSubmit={onSubmit}
      />
    );

    expect(screen.getByText('Approve')).toBeInTheDocument();
    expect(screen.getByText('Deny')).toBeInTheDocument();
  });

  it('calls onSubmit with APPROVE when approve is clicked', () => {
    const onSubmit = vi.fn();
    render(
      <DecisionControls
        status="PENDING"
        onSubmit={onSubmit}
      />
    );

    fireEvent.click(screen.getByText('Approve'));
    expect(onSubmit).toHaveBeenCalledWith('APPROVE');
  });

  it('calls onSubmit with DENY when deny is clicked without reasons', () => {
    const onSubmit = vi.fn();
    render(
      <DecisionControls
        status="PENDING"
        onSubmit={onSubmit}
      />
    );

    fireEvent.click(screen.getByText('Deny'));
    expect(onSubmit).toHaveBeenCalledWith('DENY');
  });

  it('shows deny dialog when reasons are provided', () => {
    const onSubmit = vi.fn();
    render(
      <DecisionControls
        status="PENDING"
        interactionSchema={{
          type: 'edit',
          deny_reasons: [
            { id: 'wrong', label: 'Wrong content' },
            { id: 'timing', label: 'Bad timing' },
          ],
        }}
        onSubmit={onSubmit}
      />
    );

    fireEvent.click(screen.getByText('Deny'));
    // Dialog title is an h3
    expect(screen.getByRole('heading', { name: 'Deny Task' })).toBeInTheDocument();
    expect(screen.getByText('Wrong content')).toBeInTheDocument();
    expect(screen.getByText('Bad timing')).toBeInTheDocument();
  });

  it('shows approved status for approved task', () => {
    const onSubmit = vi.fn();
    render(
      <DecisionControls
        status="APPROVED"
        onSubmit={onSubmit}
      />
    );

    expect(screen.getByText(/Approved/)).toBeInTheDocument();
    expect(screen.queryByText('Approve')).not.toBeInTheDocument();
  });

  it('shows denied status for denied task', () => {
    const onSubmit = vi.fn();
    render(
      <DecisionControls
        status="DENIED"
        onSubmit={onSubmit}
      />
    );

    expect(screen.getByText(/Denied/)).toBeInTheDocument();
    expect(screen.queryByText('Deny')).not.toBeInTheDocument();
  });

  it('shows changes indicator when hasChanges is true', () => {
    const onSubmit = vi.fn();
    render(
      <DecisionControls
        status="PENDING"
        hasChanges={true}
        onSubmit={onSubmit}
      />
    );

    expect(screen.getByText('Changes made')).toBeInTheDocument();
  });

  it('disables buttons when isSubmitting is true', () => {
    const onSubmit = vi.fn();
    render(
      <DecisionControls
        status="PENDING"
        isSubmitting={true}
        onSubmit={onSubmit}
      />
    );

    expect(screen.getByText('Submitting...')).toBeInTheDocument();
    expect(screen.getByText('Submitting...')).toBeDisabled();
    expect(screen.getByText('Deny')).toBeDisabled();
  });
});
