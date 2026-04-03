import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import FrontMatterTable from './FrontMatterTable';

describe('FrontMatterTable', () => {
  it('renders scalar values correctly', () => {
    render(
      <FrontMatterTable
        metadata={{ title: 'Hello', count: 42, date: '2024-01-15' }}
      />,
    );

    expect(screen.getByText('title')).toBeTruthy();
    expect(screen.getByText('Hello')).toBeTruthy();
    expect(screen.getByText('count')).toBeTruthy();
    expect(screen.getByText('42')).toBeTruthy();
    expect(screen.getByText('date')).toBeTruthy();
    expect(screen.getByText('2024-01-15')).toBeTruthy();
  });

  it('renders arrays as <ul> lists', () => {
    const { container } = render(
      <FrontMatterTable metadata={{ tags: ['react', 'typescript'] }} />,
    );

    const list = container.querySelector('ul');
    expect(list).toBeTruthy();

    const items = container.querySelectorAll('li');
    expect(items.length).toBe(2);
    expect(items[0].textContent).toBe('react');
    expect(items[1].textContent).toBe('typescript');
  });

  it('renders nested objects as nested tables', () => {
    const { container } = render(
      <FrontMatterTable
        metadata={{
          author: { name: 'Jane', email: 'jane@example.com' },
        }}
      />,
    );

    // Should have outer table + nested table
    const tables = container.querySelectorAll('table');
    expect(tables.length).toBe(2);

    expect(screen.getByText('name')).toBeTruthy();
    expect(screen.getByText('Jane')).toBeTruthy();
    expect(screen.getByText('email')).toBeTruthy();
    expect(screen.getByText('jane@example.com')).toBeTruthy();
  });

  it('handles mixed value types', () => {
    const { container } = render(
      <FrontMatterTable
        metadata={{
          title: 'Test',
          tags: ['a', 'b'],
          meta: { key: 'value' },
          count: 5,
        }}
      />,
    );

    expect(screen.getByText('title')).toBeTruthy();
    expect(screen.getByText('Test')).toBeTruthy();

    const list = container.querySelector('ul');
    expect(list).toBeTruthy();

    // Two tables: outer + nested from meta object
    const tables = container.querySelectorAll('table');
    expect(tables.length).toBe(2);
  });

  it('renders null and boolean values as text', () => {
    render(
      <FrontMatterTable
        metadata={{ draft: true, published: false, extra: null }}
      />,
    );

    expect(screen.getByText('true')).toBeTruthy();
    expect(screen.getByText('false')).toBeTruthy();
    expect(screen.getByText('null')).toBeTruthy();
  });

  it('returns null for empty metadata', () => {
    const { container } = render(<FrontMatterTable metadata={{}} />);
    expect(container.querySelector('table')).toBeNull();
  });
});
