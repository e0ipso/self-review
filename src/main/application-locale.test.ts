import { expect, it } from 'vitest';
import { createDesktopLocalization, resolveApplicationLocale } from '../shared/localization';
import { describeSaveFailure } from './quit-controller';

it('resolves a common system locale with direction, formatters and English fallback', () => {
  const locale = resolveApplicationLocale('ar-EG');
  expect(locale).toEqual({ locale: 'ar-EG', direction: 'rtl' });
  const messages = createDesktopLocalization(locale);
  expect(messages.number(1234)).toBe(new Intl.NumberFormat('ar-EG').format(1234));
  expect(messages.date(0)).toBe(new Intl.DateTimeFormat('ar-EG').format(0));
  expect(messages.t('Cancel')).toBe('Cancel');
  expect(resolveApplicationLocale('not_a_locale')).toEqual({ locale: 'en', direction: 'ltr' });
});

it('localizes recovery guidance without translating engine diagnostics', () => {
  const messages = createDesktopLocalization({
    messages: {
      'The review is still open. Try saving again, or click Change... to save elsewhere.':
        'Recovery guidance',
      'Could not save the review: {message}': 'Save failed: {message}',
    },
  });
  const failure = describeSaveFailure(new Error('EIO at fsync'), '/output.xml', messages);
  expect(failure.message).toBe('Save failed: EIO at fsync');
  expect(failure.detail).toContain('Recovery guidance');
  expect(failure.detail).toContain('Path: /output.xml');
});

it('keeps Spanish recovery guidance separate from the original save error', () => {
  const messages = createDesktopLocalization(resolveApplicationLocale('es-AR'));
  const failure = describeSaveFailure(new Error('EIO at fsync'), '/output.xml', messages);
  expect(failure.message).toBe('No se pudo guardar la revisión: EIO at fsync');
  expect(failure.detail).toContain('La revisión sigue abierta.');
  expect(failure.detail).toContain('Path: /output.xml');
});
