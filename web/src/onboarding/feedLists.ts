/**
 * The feeds of a list worth showing in a language: its own language first, English after it (except for Japanese). A list without any feed
 * for that language yields only English ones; a list with nothing to show gives an empty list.
 */
export function feedsForLanguage<T extends { lang: string }>(pack: { feeds: T[] }, language: string): T[] {
  const base = language.toLowerCase().split("-")[0];
  // A feed without a language (from a host) is always shown.
  const own = pack.feeds.filter((feed) => feed.lang === base || feed.lang === "");
  // English ones follow for most languages; readers of Japanese get them only for a list that has nothing in Japanese.
  const english = base === "en" || (base === "ja" && own.length > 0) ? [] : pack.feeds.filter((feed) => feed.lang === "en");
  return [...own, ...english];
}

/** All feeds of a list, the ones in the reader's language first, then English, then the rest, each group in the list's own order. */
export function feedsInAllLanguages<T extends { lang: string }>(pack: { feeds: T[] }, language: string): T[] {
  const base = language.toLowerCase().split("-")[0];
  const rank = (feed: T) => (feed.lang === base || feed.lang === "" ? 0 : feed.lang === "en" ? 1 : 2);
  // `sort` is stable, so the order the list was written in survives inside each group.
  return [...pack.feeds].sort((a, b) => rank(a) - rank(b));
}
