import assert from "node:assert/strict";
import { test } from "node:test";

test("block list parsing accepts domains and refuses entries that would block too much", async () => {
  process.env.DATABASE_PATH = ":memory:";
  process.env.SESSION_SECRET = "isolated-blocked-hosts-test-secret-at-least-32-characters";
  const { parseBlockedHosts, normalizeBlockedHost } = await import("../src/feeds/blockedHosts.js");

  assert.deepEqual(parseBlockedHosts(undefined), []);
  assert.deepEqual(parseBlockedHosts(""), []);
  assert.deepEqual(
    parseBlockedHosts("Example.COM, *.news.example.org\n.blog.example.net https://www.shop.example.io/path example.com"),
    ["example.com", "news.example.org", "blog.example.net", "www.shop.example.io"],
  );
  assert.equal(normalizeBlockedHost("EXAMPLE.com."), "example.com");
  assert.equal(normalizeBlockedHost("bücher.example"), "xn--bcher-kva.example");
  for (const bad of ["com", "localhost", "exa mple.com", "-bad-.example.com", "http://", "a..b"]) {
    assert.throws(() => parseBlockedHosts(bad), /Invalid blocked host/, bad);
  }
});

test("a blocked domain covers its subdomains but not look-alike domains", async () => {
  process.env.DATABASE_PATH = ":memory:";
  process.env.SESSION_SECRET = "isolated-blocked-hosts-test-secret-at-least-32-characters";
  const { matchingBlockedHost } = await import("../src/feeds/blockedHosts.js");
  const blocked = ["example.com", "feeds.other.org"];

  assert.equal(matchingBlockedHost("example.com", blocked), "example.com");
  assert.equal(matchingBlockedHost("WWW.Example.com.", blocked), "example.com");
  assert.equal(matchingBlockedHost("a.b.example.com", blocked), "example.com");
  assert.equal(matchingBlockedHost("feeds.other.org", blocked), "feeds.other.org");
  assert.equal(matchingBlockedHost("badexample.com", blocked), null);
  assert.equal(matchingBlockedHost("example.com.evil.test", blocked), null);
  assert.equal(matchingBlockedHost("other.org", blocked), null);
  assert.equal(matchingBlockedHost("example.com", []), null);
});

test("environment and provider lists are combined and every fetch path refuses a blocked source", async () => {
  process.env.DATABASE_PATH = ":memory:";
  process.env.SESSION_SECRET = "isolated-blocked-hosts-test-secret-at-least-32-characters";
  process.env.BLOCKED_FEED_HOSTS = "env-blocked.example";
  const blockedHosts = await import("../src/feeds/blockedHosts.js");
  const { fetchFeed } = await import("../src/feeds/fetcher.js");
  const { extractArticle } = await import("../src/feeds/extractor.js");
  const { discoverFeeds } = await import("../src/feeds/discovery.js");
  const { subscribeToFeed } = await import("../src/feeds/service.js");
  const { db, runMigrations } = await import("../src/db/index.js");
  const { createUser } = await import("../src/auth/users.js");
  runMigrations();

  try {
    blockedHosts.setBlockedHostsProvider(() => ["provider-blocked.example"]);
    assert.deepEqual(blockedHosts.listBlockedHosts().sort(), ["env-blocked.example", "provider-blocked.example"]);

    // The check runs before DNS, so these hosts never need to resolve.
    for (const url of ["https://env-blocked.example/feed", "https://www.provider-blocked.example/rss.xml"]) {
      await assert.rejects(blockedHosts.assertPublicFeedUrl(url), blockedHosts.FeedBlockedError);
      await assert.rejects(fetchFeed(url), blockedHosts.FeedBlockedError);
      await assert.rejects(discoverFeeds(url), blockedHosts.FeedBlockedError);
    }
    await assert.rejects(extractArticle("https://news.provider-blocked.example/story"), blockedHosts.FeedBlockedError);

    const user = createUser({ email: "reader@example.test", password: "blocked hosts test password", displayName: "Reader", role: "user" });
    await assert.rejects(subscribeToFeed(user.id, "https://env-blocked.example/feed"), (error: unknown) => {
      assert.ok(error instanceof blockedHosts.FeedBlockedError);
      assert.equal(error.message, blockedHosts.FEED_BLOCKED_MESSAGE);
      assert.deepEqual(blockedHosts.blockedUrlBody(error), { error: "feed_blocked", message: blockedHosts.FEED_BLOCKED_MESSAGE });
      return true;
    });
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM feeds WHERE url LIKE '%blocked%'").get().n, 0);

    // An internal address keeps its own code.
    await assert.rejects(blockedHosts.assertPublicFeedUrl("http://127.0.0.1/feed"), (error: unknown) => {
      assert.ok(!(error instanceof blockedHosts.FeedBlockedError));
      return true;
    });

    blockedHosts.setBlockedHostsProvider(null);
    assert.deepEqual(blockedHosts.listBlockedHosts(), ["env-blocked.example"]);
  } finally {
    blockedHosts.setBlockedHostsProvider(null);
    delete process.env.BLOCKED_FEED_HOSTS;
  }
});

test("purging keeps subscriptions and saved articles and removes the rest of a blocked feed", async () => {
  process.env.DATABASE_PATH = ":memory:";
  process.env.SESSION_SECRET = "isolated-blocked-hosts-test-secret-at-least-32-characters";
  const blockedHosts = await import("../src/feeds/blockedHosts.js");
  const { db, runMigrations } = await import("../src/db/index.js");
  const { createUser } = await import("../src/auth/users.js");
  const { createFeed, subscribe, upsertItems, bookmarkItem, findFeedById } = await import("../src/feeds/repository.js");
  runMigrations();

  try {
    const user = createUser({ email: "purge@example.test", password: "blocked hosts test password", displayName: "Reader", role: "user" });
    const blockedFeed = createFeed("https://feeds.purged.example/rss", 15);
    const otherFeed = createFeed("https://kept.example/rss", 15);
    subscribe(user.id, blockedFeed.id);
    subscribe(user.id, otherFeed.id);
    upsertItems(blockedFeed.id, [{ guid: "a", title: "A" }, { guid: "b", title: "B" }, { guid: "c", title: "C" }]);
    upsertItems(otherFeed.id, [{ guid: "x", title: "X" }]);
    const saved = db.prepare("SELECT id FROM items WHERE feed_id = ? AND guid = 'a'").get(blockedFeed.id) as { id: number };
    bookmarkItem(user.id, saved.id);

    assert.deepEqual(blockedHosts.purgeBlockedFeeds(), { feeds: 0, items: 0 });

    blockedHosts.setBlockedHostsProvider(() => ["purged.example"]);
    assert.deepEqual(blockedHosts.purgeBlockedFeeds(), { feeds: 1, items: 2 });

    const remaining = db.prepare("SELECT guid FROM items WHERE feed_id = ?").all(blockedFeed.id) as Array<{ guid: string }>;
    assert.deepEqual(remaining.map(item => item.guid), ["a"]);
    assert.equal(findFeedById(blockedFeed.id)?.last_error, "feed_blocked");
    assert.equal(findFeedById(otherFeed.id)?.last_error, null);
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM subscriptions WHERE feed_id = ?").get(blockedFeed.id).n, 1);
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM items WHERE feed_id = ?").get(otherFeed.id).n, 1);
  } finally {
    blockedHosts.setBlockedHostsProvider(null);
  }
});
