import { db } from "../db/index.js";
import { assertPublicHttpUrl, normalizeUrlCandidate, SsrfBlockedError } from "./ssrfGuard.js";

export const FEED_BLOCKED_ERROR = "feed_blocked";
export const FEED_BLOCKED_MESSAGE = "This source is not available on this server.";

/** The address is on the operator's block list; subscribing, polling, article text and images are all refused. */
export class FeedBlockedError extends SsrfBlockedError {
  constructor(url: string) {
    super(url);
    this.name = "FeedBlockedError";
    this.message = FEED_BLOCKED_MESSAGE;
  }
}

const LABEL = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;

/**
 * One block list entry as a lower-case ASCII domain. A single label ("com") is refused because it would block a whole
 * top-level domain by accident; `*.example.com` and `.example.com` mean the same as `example.com`.
 */
export function normalizeBlockedHost(raw: string): string {
  const entry = raw.trim().replace(/^\*?\./, "");
  let hostname: string;
  try {
    hostname = new URL(entry.includes("://") ? entry : `https://${entry}`).hostname;
  } catch {
    throw new Error(`Invalid blocked host "${raw}"`);
  }
  hostname = hostname.replace(/\.$/, "");
  const labels = hostname.split(".");
  if (labels.length < 2 || !labels.every((label) => LABEL.test(label))) {
    throw new Error(`Invalid blocked host "${raw}": expected a domain such as example.com`);
  }
  return hostname;
}

/** `BLOCKED_FEED_HOSTS`: domains separated by commas, spaces or line breaks. Fails on a bad entry instead of silently allowing it. */
export function parseBlockedHosts(raw: string | undefined): string[] {
  if (!raw) return [];
  const entries = raw.split(/[\s,]+/).filter(Boolean);
  return [...new Set(entries.map(normalizeBlockedHost))];
}

export type BlockedHostsProvider = () => readonly string[];

let provider: BlockedHostsProvider | null = null;
let cachedEnv: { raw: string | undefined; hosts: string[] } | null = null;

/** A host application adds its own list (for example one kept in a database) to the environment list. */
export function setBlockedHostsProvider(next: BlockedHostsProvider | null): void {
  provider = next;
}

function environmentHosts(): string[] {
  const raw = process.env.BLOCKED_FEED_HOSTS;
  if (cachedEnv && cachedEnv.raw === raw) return cachedEnv.hosts;
  const hosts = parseBlockedHosts(raw);
  cachedEnv = { raw, hosts };
  return hosts;
}

export function listBlockedHosts(): string[] {
  return [...new Set([...environmentHosts(), ...(provider?.() ?? [])])];
}

export function matchingBlockedHost(hostname: string, blocked: readonly string[] = listBlockedHosts()): string | null {
  if (blocked.length === 0) return null;
  const set = new Set(blocked);
  const labels = hostname.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "").split(".");
  for (let start = 0; start < labels.length; start++) {
    const candidate = labels.slice(start).join(".");
    if (set.has(candidate)) return candidate;
  }
  return null;
}

export function isHostBlocked(hostname: string): boolean {
  return matchingBlockedHost(hostname) !== null;
}

/** The check for every address that is fetched for a feed, an article or an image: public, and not blocked by the operator. */
export async function assertPublicFeedUrl(rawUrl: string): Promise<URL> {
  // Before DNS: a blocked source costs no lookup. An unparseable address falls through to its usual error.
  let hostname: string | null;
  try {
    hostname = new URL(normalizeUrlCandidate(rawUrl)).hostname;
  } catch {
    hostname = null;
  }
  if (hostname !== null && isHostBlocked(hostname)) throw new FeedBlockedError(rawUrl);
  return assertPublicHttpUrl(rawUrl);
}

/** The JSON body of a refused address; a blocked source has its own code so clients can tell it from an internal address. */
export function blockedUrlBody(error: SsrfBlockedError): { error: string; message: string } {
  return { error: error instanceof FeedBlockedError ? FEED_BLOCKED_ERROR : "blocked_url", message: error.message };
}

export interface BlockedFeedsPurge {
  feeds: number;
  items: number;
}

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

/**
 * Applies the block list to what is already stored: feeds on blocked hosts get the error state and lose their articles,
 * except saved articles, articles with notes and articles in a published edition (the same exceptions as retention).
 * The subscription stays, so people see why nothing arrives and can remove it themselves.
 */
export function purgeBlockedFeeds(): BlockedFeedsPurge {
  const blocked = listBlockedHosts();
  if (blocked.length === 0) return { feeds: 0, items: 0 };

  const feeds = db.prepare<[], { id: number; url: string }>("SELECT id, url FROM feeds WHERE is_system_inbox = 0").all()
    .filter((feed) => {
      const host = hostOf(feed.url);
      return host !== null && matchingBlockedHost(host, blocked) !== null;
    });
  if (feeds.length === 0) return { feeds: 0, items: 0 };

  const markFeed = db.prepare("UPDATE feeds SET last_error = ?, etag = NULL, last_modified = NULL WHERE id = ?");
  const deleteItems = db.prepare(
    `DELETE FROM items
     WHERE feed_id = ?
       AND id NOT IN (SELECT item_id FROM item_bookmarks)
       AND id NOT IN (SELECT item_id FROM item_notes)
       AND id NOT IN (SELECT CAST(selected.value AS INTEGER) FROM editions e, json_each(e.item_ids) selected
         WHERE e.source = 'curated' AND e.status <> 'dismissed')`,
  );
  let items = 0;
  db.transaction(() => {
    for (const feed of feeds) {
      markFeed.run(FEED_BLOCKED_ERROR, feed.id);
      items += deleteItems.run(feed.id).changes;
    }
  })();
  return { feeds: feeds.length, items };
}
