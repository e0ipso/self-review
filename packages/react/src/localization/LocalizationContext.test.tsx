import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { createLocalization, LocalizationProvider, useLocalization } from './LocalizationContext';
import { ENGLISH } from './english';

describe('localization boundary', () => {
  it('keeps English defaults and handles independent plural counts', () => {
    const { t } = createLocalization();
    expect(t('files changed', { count: 1 })).toBe('1 file changed');
    expect(t('files changed', { count: 2 })).toBe('2 files changed');
    expect(t('comments across files', { count: 2, files: 1 })).toBe('2 comments across 1 file');
    expect(t('comments across files', { count: 1, files: 2 })).toBe('1 comment across 2 files');
  });
  it('supports locale plural categories, numbers, dates, and fallback messages', () => {
    const local = createLocalization({
      locale: 'ar',
      direction: 'rtl',
      messages: { images: { plural: 'count', forms: { two: 'pair', other: '{count} images' } } },
    });
    expect(local.t('images', { count: 2 })).toBe('pair');
    expect(local.t('Comment on line {line}', { line: 1234 })).toContain(
      new Intl.NumberFormat('ar').format(1234)
    );
    expect(local.date(0, { timeZone: 'UTC', year: 'numeric' })).toBe(
      new Intl.DateTimeFormat('ar', { timeZone: 'UTC', year: 'numeric' }).format(0)
    );
    expect(local.t('Apply')).toBe('Apply');
  });
  it('rejects missing interpolation values and incomplete plural counts', () => {
    expect(() => createLocalization().t('Comment on line {line}')).toThrow(
      'Missing message value: line'
    );
    expect(() => createLocalization().t('images')).toThrow('Missing plural count: count');
  });
  it('validates every default message and passes direction to descendants', () => {
    const local = createLocalization();
    for (const key of Object.keys(ENGLISH) as Array<keyof typeof ENGLISH>) {
      expect(
        local.t(key, {
          size: 30,
          name: 'name',
          index: 1,
          stops: 2,
          args: '--staged',
          recorded: 'aaa',
          live: 'bbb',
          count: 2,
          files: 2,
          viewed: 1,
          total: 2,
          percent: 50,
          line: 3,
          start: 1,
          end: 3,
          path: 'a.ts',
          detail: 'message',
        })
      ).not.toMatch(/\{\w+\}/);
    }
    function Probe() {
      return <span>{useLocalization().t('Apply')}</span>;
    }
    render(
      <LocalizationProvider locale='ar' direction='rtl' messages={{ Apply: 'Test action' }}>
        <Probe />
      </LocalizationProvider>
    );
    expect(screen.getByText('Test action').closest('[dir]')?.getAttribute('dir')).toBe('rtl');
    expect(screen.getByText('Test action').closest('[lang]')?.getAttribute('lang')).toBe('ar');
  });
});
