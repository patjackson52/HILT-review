import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { TaskCard } from '../../src/components/TaskCard';
import type { ReviewTask } from '@hilt-review/shared';

const mockTask: ReviewTask = {
  id: 'task-123',
  source_id: 'source-456',
  source_name: 'Test Agent',
  status: 'PENDING',
  priority: 'NORMAL',
  title: 'Send Welcome Email',
  preview: 'Hello and welcome to our service!',
  service: { id: 'email', name: 'Email Service', icon: '📧' },
  action: { type: 'send', verb: 'Send Email', icon: '📤' },
  risk_level: 'low',
  blocks_original: [],
  blocks_working: [],
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

function renderWithRouter(component: React.ReactNode) {
  return render(
    <BrowserRouter>
      {component}
    </BrowserRouter>
  );
}

describe('TaskCard', () => {
  it('renders task title', () => {
    renderWithRouter(<TaskCard task={mockTask} />);
    expect(screen.getByText('Send Welcome Email')).toBeInTheDocument();
  });

  it('renders service name', () => {
    renderWithRouter(<TaskCard task={mockTask} />);
    expect(screen.getByText('Email Service')).toBeInTheDocument();
  });

  it('renders action verb', () => {
    renderWithRouter(<TaskCard task={mockTask} />);
    expect(screen.getByText('Send Email')).toBeInTheDocument();
  });

  it('renders source name', () => {
    renderWithRouter(<TaskCard task={mockTask} />);
    expect(screen.getByText('Test Agent')).toBeInTheDocument();
  });

  it('renders preview text', () => {
    renderWithRouter(<TaskCard task={mockTask} />);
    expect(screen.getByText('Hello and welcome to our service!')).toBeInTheDocument();
  });

  it('renders risk badge', () => {
    renderWithRouter(<TaskCard task={mockTask} />);
    expect(screen.getByText(/low/i)).toBeInTheDocument();
  });

  it('links to task detail page', () => {
    renderWithRouter(<TaskCard task={mockTask} />);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/tasks/task-123');
  });

  it('renders high risk task correctly', () => {
    const highRiskTask = { ...mockTask, risk_level: 'high' as const };
    renderWithRouter(<TaskCard task={highRiskTask} />);
    expect(screen.getByText(/high/i)).toBeInTheDocument();
  });

  it('renders critical risk task correctly', () => {
    const criticalTask = { ...mockTask, risk_level: 'critical' as const };
    renderWithRouter(<TaskCard task={criticalTask} />);
    expect(screen.getByText(/critical/i)).toBeInTheDocument();
  });

  it('renders without preview when not provided', () => {
    const taskWithoutPreview = { ...mockTask, preview: undefined };
    renderWithRouter(<TaskCard task={taskWithoutPreview} />);
    expect(screen.getByText('Send Welcome Email')).toBeInTheDocument();
    expect(screen.queryByText('Hello and welcome to our service!')).not.toBeInTheDocument();
  });
});
