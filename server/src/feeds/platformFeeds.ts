/**
 * Some platforms never announce their feed on the page people paste, but the feed address follows a fixed pattern.
 * These rules turn such a page address into the candidates worth trying. A candidate is only used when it really is a feed.
 */

// Paths of medium.com that belong to the site, not to a writer or a publication.
const MEDIUM_RESERVED = new Set(["", "feed", "m", "me", "plans", "membership", "search", "tag", "topics", "about", "jobs", "policy", "creators", "new-story", "settings", "library", "notifications"]);

export function platformFeedCandidates(url: URL): string[] {
  const host = url.hostname.toLowerCase().replace(/^(www|old|new|m)\./, "");
  const segments = url.pathname.split("/").filter(Boolean);

  if (host === "reddit.com") {
    // /r/name, /r/name/top, /user/name: every one of them has a feed at the end of its base path.
    if ((segments[0] === "r" || segments[0] === "user") && segments[1]) return [`https://www.reddit.com/${segments[0]}/${segments[1]}/.rss`];
    return [];
  }

  if (host === "medium.com") {
    const first = segments[0];
    if (!first || MEDIUM_RESERVED.has(first)) return [];
    return [`https://medium.com/feed/${first}`];
  }

  if (host === "youtube.com" && url.pathname === "/playlist") {
    const list = url.searchParams.get("list");
    return list && /^[A-Za-z0-9_-]{10,64}$/.test(list) ? [`https://www.youtube.com/feeds/videos.xml?playlist_id=${list}`] : [];
  }

  return [];
}

/** The numeric id of a show on Apple Podcasts (`…/podcast/name/id1204393114`), if the address is one. */
export function applePodcastId(url: URL): string | null {
  if (url.hostname.toLowerCase() !== "podcasts.apple.com") return null;
  return /\/id(\d{4,12})(?:[/?]|$)/.exec(url.pathname)?.[1] ?? null;
}

/** The feed address in the answer of Apple's lookup service, if it names one. */
export function feedUrlFromAppleLookup(body: string): string | null {
  try {
    const parsed = JSON.parse(body) as { results?: Array<{ feedUrl?: unknown }> };
    const feedUrl = parsed.results?.find((result) => typeof result.feedUrl === "string")?.feedUrl;
    return typeof feedUrl === "string" ? feedUrl : null;
  } catch {
    return null;
  }
}
