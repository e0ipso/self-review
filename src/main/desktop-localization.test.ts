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

it.each(['es', 'es-ES', 'es-MX'])(
  'resolves the same translated shell and review catalog at %s',
  locale => {
    const native = createDesktopLocalization(resolveApplicationLocale(locale));
    expect(native.t('Cancel')).toBe('Cancelar');
    expect(native.t('Finish Review')).toBe('Finalizar revisión');
    expect(native.t('XML Files')).toBe('Archivos XML');
    expect(native.number(12345.6)).toBe(new Intl.NumberFormat(locale).format(12345.6));
    expect(native.date(0, { timeZone: 'UTC' })).toBe(
      new Intl.DateTimeFormat(locale, { timeZone: 'UTC' }).format(0)
    );
  }
);

it.each([
  [1, 1, 'Esta revisión contiene 1 archivo y aproximadamente 1 línea.'],
  [1, 2, 'Esta revisión contiene 1 archivo y aproximadamente 2 líneas.'],
  [2, 1, 'Esta revisión contiene 2 archivos y aproximadamente 1 línea.'],
  [2, 2, 'Esta revisión contiene 2 archivos y aproximadamente 2 líneas.'],
])('selects independent native plural counts %i and %i', (files, lines, expected) => {
  const native = createDesktopLocalization({ locale: 'es-MX' });
  expect(native.t('Review size', { files, lines })).toBe(expected);
  expect(native.t('Review thresholds', { files, lines })).toContain(
    `${files} ${files === 1 ? 'archivo' : 'archivos'}, ${lines} ${lines === 1 ? 'línea' : 'líneas'}`
  );
});

it('preserves overrides, missing-key fallback and malformed locale recovery', () => {
  const native = createDesktopLocalization({
    locale: 'es-ES',
    messages: { Cancel: 'Mi cancelación', 'Finish Review': undefined },
  });
  expect(native.t('Cancel')).toBe('Mi cancelación');
  expect(native.t('Finish Review')).toBe('Finalizar revisión');
  expect(native.t('Uncatalogued {name}', { name: '<script>' })).toBe('Uncatalogued <script>');
  for (const locale of ['en', 'en-GB', 'fr-FR', 'bad_locale']) {
    expect(createDesktopLocalization({ locale }).t('Cancel')).toBe('Cancel');
    expect(createDesktopLocalization({ locale }).t('Review size', { files: 1, lines: 2 })).toBe(
      'This review contains 1 file and approximately 2 lines.'
    );
  }
});
