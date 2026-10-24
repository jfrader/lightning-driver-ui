const MAX_FORMATTERS = 64;

export function formatterCache<Options, Formatter>(create: (locale: Intl.LocalesArgument, options: Options) => Formatter) {
  const cache = new Map<string, Formatter>();
  return (locale: Intl.LocalesArgument, options: Options): Formatter => {
    const input = typeof locale === 'string' || locale === undefined ? locale : locale instanceof Intl.Locale ? locale.toString() : locale.map(String);
    const locales = Intl.getCanonicalLocales(input);
    const key = JSON.stringify([locales, options]);
    const cached = cache.get(key);
    if (cached !== undefined) return cached;
    const formatter = create(locales, options);
    const oldest = cache.keys().next().value;
    if (cache.size >= MAX_FORMATTERS && oldest !== undefined) cache.delete(oldest);
    cache.set(key, formatter);
    return formatter;
  };
}
