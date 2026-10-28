import assert from "node:assert/strict";
import { test } from "node:test";
import { applePodcastId, feedUrlFromAppleLookup, platformFeedCandidates } from "../src/feeds/platformFeeds.js";

const candidates = (address: string) => platformFeedCandidates(new URL(address));

test("platform pages lead to their feed address", () => {
  assert.deepEqual(candidates("https://www.reddit.com/r/apple"), ["https://www.reddit.com/r/apple/.rss"]);
  assert.deepEqual(candidates("https://old.reddit.com/r/swift/top/?t=week"), ["https://www.reddit.com/r/swift/.rss"]);
  assert.deepEqual(candidates("https://reddit.com/user/spez"), ["https://www.reddit.com/user/spez/.rss"]);
  assert.deepEqual(candidates("https://reddit.com/"), []);

  assert.deepEqual(candidates("https://medium.com/@kentcdodds"), ["https://medium.com/feed/@kentcdodds"]);
  assert.deepEqual(candidates("https://medium.com/swlh/some-article-1234"), ["https://medium.com/feed/swlh"]);
  assert.deepEqual(candidates("https://medium.com/tag/swift"), []);
  assert.deepEqual(candidates("https://medium.com/"), []);

  assert.deepEqual(candidates("https://www.youtube.com/playlist?list=PLrEnWoR732-BHrPp_Pm8_VleD68f9s14-"), ["https://www.youtube.com/feeds/videos.xml?playlist_id=PLrEnWoR732-BHrPp_Pm8_VleD68f9s14-"]);
  assert.deepEqual(candidates("https://www.youtube.com/playlist?list=x<script>"), []);
  assert.deepEqual(candidates("https://example.org/r/apple"), []);
});

test("an Apple Podcasts address gives the show's id and the lookup answer its feed", () => {
  assert.equal(applePodcastId(new URL("https://podcasts.apple.com/de/podcast/lage-der-nation/id1204393114")), "1204393114");
  assert.equal(applePodcastId(new URL("https://podcasts.apple.com/us/podcast/x/id1204393114?i=1000")), "1204393114");
  assert.equal(applePodcastId(new URL("https://example.org/podcast/id1204393114")), null);
  assert.equal(feedUrlFromAppleLookup('{"results":[{"kind":"podcast","feedUrl":"https://example.org/feed.xml"}]}'), "https://example.org/feed.xml");
  assert.equal(feedUrlFromAppleLookup('{"results":[]}'), null);
  assert.equal(feedUrlFromAppleLookup("not json"), null);
});
