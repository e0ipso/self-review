import { expect, it } from 'vitest';
import { createDesktopLocalization, resolveApplicationLocale } from '../shared/localization';
import { createMessageFormatter } from '../../packages/react/src/localization/formatter';

it('uses the shared pure formatter with nested English fallbacks and native locale rules', () => {
  const local = createDesktopLocalization({ locale: 'ar', direction: 'rtl' });
  const formatter = createMessageFormatter('ar');
  expect(local.t('Review size', { files: 1, lines: 2 })).toBe(
    `This review contains ${formatter.number(1)} file and approximately ${formatter.number(2)} lines.`
  );
  expect(local.t('Unknown {count}', { count: 1234 })).toBe(`Unknown ${formatter.number(1234)}`);
  expect(local.date(0, { timeZone: 'UTC', year: 'numeric' })).toBe(
    formatter.date(0, { timeZone: 'UTC', year: 'numeric' })
  );
  expect(local.direction).toBe('rtl');
  expect(resolveApplicationLocale('bad_locale')).toEqual({ locale: 'en', direction: 'ltr' });
  expect(() => local.t('Review size', { files: 1 })).toThrow('Missing plural count: lines');
  expect(() => local.t('Unknown {count}')).toThrow('Missing message value: count');
});
