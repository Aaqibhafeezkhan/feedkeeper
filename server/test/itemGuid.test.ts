import assert from "node:assert/strict";
import { test } from "node:test";
import { itemGuid } from "../src/feeds/poller.js";

test("an item is identified by its guid, and an empty guid element falls back to the link or title", () => {
  assert.equal(itemGuid({ guid: "abc", link: "https://example.org/a" }), "abc");
  // `<guid isPermaLink="false"/>` is parsed as an object, which cannot be stored.
  assert.equal(itemGuid({ guid: { $: { isPermaLink: "false" } }, link: "https://example.org/a", title: "A" }), "https://example.org/a");
  assert.equal(itemGuid({ guid: "", title: "Only a title" }), "Only a title");
  assert.equal(itemGuid({ link: "https://example.org/b" }), "https://example.org/b");
  assert.match(itemGuid({}), /^[0-9a-f-]{36}$/);
});
