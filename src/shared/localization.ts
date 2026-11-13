/** Browser-safe shell messages shared by native presentation and desktop React components.
 * The English source is the fallback; no locale or catalog is persisted in application config.
 */
import {
  createMessageFormatter,
  type LocalizedMessage,
} from '../../packages/react/src/localization/formatter';
import { ENGLISH as REVIEW_ENGLISH } from '../../packages/react/src/localization/english';
import { DESKTOP_ENGLISH } from './desktop-english';
import { SPANISH_SHELL } from './spanish-shell';
import { SPANISH_REVIEW } from './spanish-review';
export type DesktopMessage = LocalizedMessage;
export interface DesktopLocaleOptions {
  locale?: string;
  direction?: 'ltr' | 'rtl';
  messages?: Readonly<Record<string, DesktopMessage | undefined>>;
}
export function createDesktopLocalization({
  locale = 'en',
  direction = 'ltr',
  messages = {},
}: DesktopLocaleOptions = {}) {
  const resolved = resolveApplicationLocale(locale);
  const catalog = resolveDesktopCatalog(resolved.locale);
  const formatter = createMessageFormatter(resolved.locale);
  return {
    locale: resolved.locale,
    direction,
    t: (source: string, values: Readonly<Record<string, string | number>> = {}) =>
      formatter.render(messages[source] ?? catalog[source] ?? source, values),
    number: formatter.number,
    date: formatter.date,
  };
}
export type DesktopLocalization = ReturnType<typeof createDesktopLocalization>;

/** The same pure catalog is used by native messages and the renderer provider. */
export function resolveDesktopCatalog(
  locale = 'en'
): Readonly<Record<string, DesktopMessage | undefined>> {
  const language = resolveApplicationLocale(locale).locale.split('-')[0];
  return language === 'es' ? SPANISH : ENGLISH;
}
const ENGLISH = { ...REVIEW_ENGLISH, ...DESKTOP_ENGLISH };
const SPANISH = { ...ENGLISH, ...SPANISH_REVIEW, ...SPANISH_SHELL };

/** Host locale affects formatters and direction; missing catalogs use the English source. */
export function resolveApplicationLocale(candidate?: string): import('./types').ApplicationLocale {
  try {
    const locale = new Intl.Locale(candidate || 'en');
    const language = locale.maximize().language;
    return {
      locale: locale.toString(),
      direction: ['ar', 'fa', 'he', 'ur', 'ps', 'sd', 'ug', 'yi'].includes(language)
        ? 'rtl'
        : 'ltr',
    };
  } catch {
    return { locale: 'en', direction: 'ltr' };
  }
}
