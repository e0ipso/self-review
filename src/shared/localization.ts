/** Browser-safe shell messages shared by native presentation and desktop React components.
 * The English source is the fallback; no locale or catalog is persisted in application config.
 */
import {
  createMessageFormatter,
  type LocalizedMessage,
} from '../../packages/react/src/localization/formatter';
export type DesktopMessage = LocalizedMessage;
export interface DesktopLocaleOptions {
  locale?: string;
  direction?: 'ltr' | 'rtl';
  messages?: Readonly<Record<string, DesktopMessage | undefined>>;
}
const ENGLISH: Record<string, DesktopMessage> = {
  'Review size': {
    plural: 'files',
    forms: {
      one: {
        plural: 'lines',
        forms: {
          one: 'This review contains {files} file and approximately {lines} line.',
          other: 'This review contains {files} file and approximately {lines} lines.',
        },
      },
      other: {
        plural: 'lines',
        forms: {
          one: 'This review contains {files} files and approximately {lines} line.',
          other: 'This review contains {files} files and approximately {lines} lines.',
        },
      },
    },
  },
  'Review thresholds': {
    plural: 'files',
    forms: {
      one: {
        plural: 'lines',
        forms: {
          one: 'Thresholds: {files} file, {lines} line.\n\nLarge reviews may be slow. Continue in large-payload mode?',
          other:
            'Thresholds: {files} file, {lines} lines.\n\nLarge reviews may be slow. Continue in large-payload mode?',
        },
      },
      other: {
        plural: 'lines',
        forms: {
          one: 'Thresholds: {files} files, {lines} line.\n\nLarge reviews may be slow. Continue in large-payload mode?',
          other:
            'Thresholds: {files} files, {lines} lines.\n\nLarge reviews may be slow. Continue in large-payload mode?',
        },
      },
    },
  },
};
export function createDesktopLocalization({
  locale = 'en',
  direction = 'ltr',
  messages = {},
}: DesktopLocaleOptions = {}) {
  const formatter = createMessageFormatter(locale);
  return {
    locale,
    direction,
    t: (source: string, values: Readonly<Record<string, string | number>> = {}) =>
      formatter.render(messages[source] ?? ENGLISH[source] ?? source, values),
    number: formatter.number,
    date: formatter.date,
  };
}
export type DesktopLocalization = ReturnType<typeof createDesktopLocalization>;

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
