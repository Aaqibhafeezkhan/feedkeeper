import assert from "node:assert/strict";
import { test } from "node:test";
import { readerHtml, contentMetadata } from "../src/feeds/articleContent.js";
import { isVideoTeaser } from "../src/feeds/content/noise/videoTeasers.js";

const teaser = (page: string, text: string) => `<p> <a href="${page}"><img src="https://example.org/poster.jpg" alt="Sendungsbild" /></a> <br/> <br/>${text}[<a href="${page}">mehr</a>]</p>`;

test("a poster that links to a video page, with only the title beside it, becomes a video card", () => {
  const html = teaser("https://www.tagesschau.de/tagesschau_in_100_sekunden/video-1674020.html", "tagesschau in 100 Sekunden");
  const cleaned = readerHtml(html, "tagesschau in 100 Sekunden", null)!;
  assert.match(cleaned, /<img /);
  assert.match(cleaned, /<a href="https:\/\/www\.tagesschau\.de\/tagesschau_in_100_sekunden\/video-1674020\.html" data-media="video">tagesschau in 100 Sekunden<\/a>/);
  assert.doesNotMatch(cleaned, /mehr/);
  // A second run changes nothing: still one card.
  assert.equal((readerHtml(cleaned, "tagesschau in 100 Sekunden", null)!.match(/data-media="video"/g) ?? []).length, 1);
  const video = readerHtml(teaser("https://example.org/video/12.html", ""), "Merz in Tokio", null)!;
  assert.match(video, />Merz in Tokio<\/a>/);
});

test("a teaser with real text, or a link to an ordinary page, stays as it is", () => {
  const withText = '<p><a href="https://example.org/video/1.html"><img src="/p.jpg"></a> Ein langer Text über das, was im Video passiert, mit mehreren Sätzen.</p>';
  assert.doesNotMatch(readerHtml(withText, "Titel", null)!, /data-media/);
  const article = '<p><a href="https://example.org/politik/article-1.html"><img src="/p.jpg"></a></p>';
  assert.doesNotMatch(readerHtml(article, "Titel", null)!, /data-media/);
});

test("a video teaser needs no fetched article, so no client reports it missing", () => {
  const html = teaser("https://example.org/video/12.html", "Merz in Tokio");
  assert.equal(isVideoTeaser(html, "Merz in Tokio"), true);
  assert.equal(isVideoTeaser("<p>Text</p>", "Titel"), false);
  const item = { content_html: html, title: "Merz in Tokio", full_content_html: null, extraction_status: "partial", extraction_retry_at: "2026-10-29T00:00:00Z", content_revision: 1, extraction_attempted_at: null, is_empty_gallery: 0 } as never;
  const meta = contentMetadata(item);
  assert.equal(meta.status, "feed_only");
  assert.equal(meta.retryAt, null);
  const ordinary = contentMetadata({ ...(item as object), content_html: "<p>Lang genug Text.</p>" } as never);
  assert.equal(ordinary.status, "partial");
});

test("the content metadata names a video card, so a client can say \"Video\" under an empty preview", () => {
  const html = teaser("https://example.org/video/12.html", "Merz in Tokio");
  const video = contentMetadata({ content_html: html, title: "Merz in Tokio", full_content_html: null, extraction_status: "partial", extraction_retry_at: null, content_revision: 1, extraction_attempted_at: null, is_empty_gallery: 0 } as never);
  assert.equal((video as { isVideo?: boolean }).isVideo, true);
  const plain = contentMetadata({ content_html: "<p>Text</p>", title: "Titel", full_content_html: null, extraction_status: "ready", extraction_retry_at: null, content_revision: 1, extraction_attempted_at: null, is_empty_gallery: 0 } as never);
  assert.equal("isVideo" in plain, false);
});
