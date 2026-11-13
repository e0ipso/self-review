import React, { createContext, useContext, useMemo, type ReactNode } from 'react';
import { ENGLISH } from './english';

import { createMessageFormatter, type LocalizedMessage, type MessageValues } from './formatter';
export type { LocalizedMessage, MessageValues } from './formatter';
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
  const formatter = createMessageFormatter(locale);
  return {
    locale,
    direction,
    messages,
    t: (key: MessageKey, values: MessageValues = {}) => {
      const message = messages[key] ?? ENGLISH[key];
      if (message === undefined) throw new Error(`Unknown message: ${key}`);
      return formatter.render(message, values);
    },
    number: formatter.number,
    date: formatter.date,
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
