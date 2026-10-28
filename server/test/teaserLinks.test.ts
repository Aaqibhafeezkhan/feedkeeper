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
