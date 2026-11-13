/** Pure formatting shared by native presentation and the browser UI. No host imports. */
export type MessageValues = Readonly<Record<string, string | number>>;
export type LocalizedMessage =
  | string
  | {
      plural: string;
      forms: Partial<Record<Intl.LDMLPluralRule, LocalizedMessage>> & { other: LocalizedMessage };
    };

export function createMessageFormatter(locale: string) {
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
    render,
    number: (value: number) => numbers.format(value),
    date: (value: Date | number, options?: Intl.DateTimeFormatOptions) =>
      new Intl.DateTimeFormat(locale, options).format(value),
  };
}
