import { db } from "../db/index.js";
import { FEED_BLOCKED_ERROR, listBlockedHosts, matchingBlockedHost } from "./blockedHosts.js";

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
