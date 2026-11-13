import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { it, expect, vi } from 'vitest';
import { GuideRouteMap } from './GuideRouteMap';
import { LocalizationProvider } from '../localization/LocalizationContext';

it('localizes route controls and plurals, mirrors RTL and keeps authored names verbatim', () => {
  const jump = vi.fn();
  const groups = ['User wording', 'Second'].map((name, index) => ({
    name,
    implicit: false,
    files: [{ path: `${index}.ts` }],
  }));
  const { container } = render(
    <LocalizationProvider
      direction='rtl'
      messages={{
        'Go to stop {index}: {name}': 'Visit {name}, {index}',
        files: { plural: 'count', forms: { one: '{count} source', other: '{count} sources' } },
      }}
    >
      <GuideRouteMap groups={groups} isGroupComplete={() => false} onJump={jump} />
    </LocalizationProvider>
  );
  const station = screen.getByRole('button', { name: 'Visit User wording, 1' });
  station.focus();
  fireEvent.keyDown(station, { key: 'Enter' });
  expect(jump).toHaveBeenCalledWith('0.ts');
  expect(screen.getAllByText('1 source')).toHaveLength(2);
  const circles = container.querySelectorAll('circle');
  expect(Number(circles[0].getAttribute('cx'))).toBeGreaterThan(
    Number(circles[1].getAttribute('cx'))
  );
});
