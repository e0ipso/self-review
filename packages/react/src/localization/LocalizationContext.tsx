import React, { createContext, useContext, useMemo, type ReactNode } from 'react';
import { ENGLISH } from './english';

export type MessageValues = Readonly<Record<string, string | number>>;
export type LocalizedMessage =
  | string
  | {
      plural: string;
      forms: Partial<Record<Intl.LDMLPluralRule, LocalizedMessage>> & { other: LocalizedMessage };
    };
export type MessageKey = keyof typeof ENGLISH;
export interface LocalizationOptions {
  locale?: string;
  direction?: 'ltr' | 'rtl';
  /** Missing entries fall back to English. Plural messages may nest for independent counts. */
  messages?: Partial<Record<MessageKey, LocalizedMessage>>;
}

export function createLocalization({
  locale = 'en',
  direction = 'ltr',
  messages = {},
}: LocalizationOptions = {}) {
  const numbers = new Intl.NumberFormat(locale);
  const plurals = new Intl.PluralRules(locale);
  const render = (message: LocalizedMessage, values: MessageValues): string => {
    if (typeof message !== 'string') {
      const count = values[message.plural];
      if (typeof count !== 'number' || !Number.isFinite(count))
        throw new Error(`Missing plural count: ${message.plural}`);
      return render(message.forms[plurals.select(count)] ?? message.forms.other, values);
    }
    return message.replace(/\{(\w+)\}/g, (_, name: string) => {
      const value = values[name];
      if (value === undefined) throw new Error(`Missing message value: ${name}`);
      return typeof value === 'number' ? numbers.format(value) : value;
    });
  };
  return {
    locale,
    direction,
    messages,
    t: (key: MessageKey, values: MessageValues = {}) => {
      const message = messages[key] ?? ENGLISH[key];
      if (message === undefined) throw new Error(`Unknown message: ${key}`);
      return render(message, values);
    },
    number: (value: number) => numbers.format(value),
    date: (value: Date | number, options?: Intl.DateTimeFormatOptions) =>
      new Intl.DateTimeFormat(locale, options).format(value),
  };
}
const LocalizationContext = createContext(createLocalization());
export function useLocalization() {
  return useContext(LocalizationContext);
}

/** Browser-safe, opt-in locale boundary; no host configuration or persistence format changes. */
export function LocalizationProvider({
  children,
  locale,
  direction,
  messages,
}: LocalizationOptions & { children: ReactNode }) {
  const parent = useLocalization();
  const value = useMemo(
    () =>
      createLocalization({
        locale: locale ?? parent.locale,
        direction: direction ?? parent.direction,
        messages: { ...parent.messages, ...messages },
      }),
    [locale, direction, messages, parent]
  );
  return (
    <LocalizationContext.Provider value={value}>
      <div lang={value.locale} dir={value.direction} style={{ display: 'contents' }}>
        {children}
      </div>
    </LocalizationContext.Provider>
  );
}
