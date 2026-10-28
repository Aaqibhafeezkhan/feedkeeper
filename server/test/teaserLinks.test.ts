import assert from "node:assert/strict";
import { test } from "node:test";
import { cleanSnippet, leadText } from "../src/feeds/contentNoise.js";
import { readerHtml } from "../src/feeds/articleContent.js";

const video = '<p> <a href="https://example.org/v.html"><img src="https://example.org/p.jpg" alt="Sendungsbild" /></a> <br/> <br/>tagesschau in 100 Sekunden[<a href="https://example.org/v.html">mehr</a>]</p>';

test("a summary that is only the title and a \"more\" link has no lead, and a real one keeps its text", () => {
  assert.equal(leadText({ html: video, snippet: "tagesschau in 100 Sekunden[mehr]", title: "tagesschau in 100 Sekunden" }), "");
  assert.equal(
    leadText({ html: '<p>Viele Menschen müssen Wasser abkochen. [<a href="/x">mehr</a>]</p>', snippet: "Viele Menschen müssen Wasser abkochen. [mehr]", title: "Landkreis" }),
    "Viele Menschen müssen Wasser abkochen.",
  );
  assert.equal(cleanSnippet("Alles in Kürze (weiterlesen)", "Titel"), "Alles in Kürze");
  assert.equal(cleanSnippet("The city votes. [Read more]", "Titel"), "The city votes.");
  assert.equal(cleanSnippet("Ein Absatz über [mehr] Äpfel und Birnen", "Titel"), "Ein Absatz über [mehr] Äpfel und Birnen");
});

test("the reader does not show the link that only says more", () => {
  assert.doesNotMatch(readerHtml(video, "Anderer Titel", null), /mehr/);
});

test("summaries lose placeholders, date stamps, picture credits, and journal references", () => {
  const title = "Titel";
  // A feed generator that printed an empty value.
  assert.equal(leadText({ html: '<a href="/x"><img src="/p.jpg"></a> None', snippet: "", title }), "");
  assert.equal(cleanSnippet("None", title), "");
  // The date a content system prints under the headline, and the headline itself.
  assert.equal(cleanSnippet("Titel\nWed, 10/28/2026 - 15:00", title), "");
  // The credit of the picture ahead of the text.
  assert.equal(cleanSnippet("Source: Apple. Apple also introduced a new 14-inch MacBook Pro today.", title), "Apple also introduced a new 14-inch MacBook Pro today.");
  assert.equal(cleanSnippet("Image credit: Reuters. Markets fell on Tuesday.", title), "Markets fell on Tuesday.");
  assert.equal(cleanSnippet("The source: Apple said so. More text.", title), "The source: Apple said so. More text.");
  // The reference a journal puts ahead of the abstract.
  assert.equal(cleanSnippet("Nature, Published online: 28 October 2026; doi:10.1038/d41586-026-02202-3 A jury weighs in on teaching.", title), "A jury weighs in on teaching.");
  // Medium's closing line.
  assert.equal(cleanSnippet("What a survey found about AI in UX Continue reading on UX Collective »", title), "What a survey found about AI in UX");
  // The affiliate notice is the page's, not the story's.
  assert.equal(cleanSnippet("※本ページは、アフィリエイト広告を含みます\n新しいツールを紹介します。", title), "新しいツールを紹介します。");
});
