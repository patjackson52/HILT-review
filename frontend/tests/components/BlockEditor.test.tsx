import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BlockEditor, BlockList } from '../../src/components/BlockEditor';
import type { ArtifactBlock } from '@hilt-review/shared';

const mockBlock: ArtifactBlock = {
  id: 'block-1',
  label: 'Email Subject',
  type: 'plaintext',
  content: 'Hello World',
  editable: true,
};

describe('BlockEditor', () => {
  it('renders block content', () => {
    render(<BlockEditor block={mockBlock} />);
    expect(screen.getByText('Hello World')).toBeInTheDocument();
  });

  it('renders block label', () => {
    render(<BlockEditor block={mockBlock} />);
    expect(screen.getByText('Email Subject')).toBeInTheDocument();
  });

  it('renders block type badge', () => {
    render(<BlockEditor block={mockBlock} />);
    expect(screen.getByText('plaintext')).toBeInTheDocument();
  });

  it('shows edit button for editable blocks', () => {
    const onChange = vi.fn();
    render(<BlockEditor block={mockBlock} onChange={onChange} />);
    expect(screen.getByText('Edit')).toBeInTheDocument();
  });

  it('does not show edit button for readonly blocks', () => {
    render(<BlockEditor block={mockBlock} readonly={true} />);
    expect(screen.queryByText('Edit')).not.toBeInTheDocument();
  });

  it('does not show edit button for non-editable blocks', () => {
    const nonEditableBlock = { ...mockBlock, editable: false };
    const onChange = vi.fn();
    render(<BlockEditor block={nonEditableBlock} onChange={onChange} />);
    expect(screen.queryByText('Edit')).not.toBeInTheDocument();
  });

  it('enters edit mode when edit is clicked', () => {
    const onChange = vi.fn();
    render(<BlockEditor block={mockBlock} onChange={onChange} />);

    fireEvent.click(screen.getByText('Edit'));
    expect(screen.getByRole('textbox')).toBeInTheDocument();
    expect(screen.getByText('Save')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('cancels edit mode', () => {
    const onChange = vi.fn();
    render(<BlockEditor block={mockBlock} onChange={onChange} />);

    fireEvent.click(screen.getByText('Edit'));
    fireEvent.click(screen.getByText('Cancel'));

    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('saves changes', () => {
    const onChange = vi.fn();
    render(<BlockEditor block={mockBlock} onChange={onChange} />);

    fireEvent.click(screen.getByText('Edit'));
    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'Updated content' } });
    fireEvent.click(screen.getByText('Save'));

    expect(onChange).toHaveBeenCalledWith('block-1', 'Updated content');
  });

  it('renders JSON content as formatted string', () => {
    const jsonBlock: ArtifactBlock = {
      id: 'json-1',
      type: 'json',
      content: { key: 'value', nested: { data: 123 } },
      editable: false,
    };
    render(<BlockEditor block={jsonBlock} />);
    expect(screen.getByText(/"key": "value"/)).toBeInTheDocument();
  });
});

describe('BlockList', () => {
  const mockBlocks: ArtifactBlock[] = [
    { id: 'b1', label: 'Subject', type: 'plaintext', content: 'Hello', editable: true },
    { id: 'b2', label: 'Body', type: 'markdown', content: '# Welcome', editable: true },
  ];

  it('renders all blocks', () => {
    render(<BlockList blocks={mockBlocks} />);
    expect(screen.getByText('Subject')).toBeInTheDocument();
    expect(screen.getByText('Body')).toBeInTheDocument();
  });

  it('renders section title', () => {
    render(<BlockList blocks={mockBlocks} title="Content" />);
    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  it('renders empty state when no blocks', () => {
    render(<BlockList blocks={[]} />);
    expect(screen.getByText('No content blocks')).toBeInTheDocument();
  });
});
