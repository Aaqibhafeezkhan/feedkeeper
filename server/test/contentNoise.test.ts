import assert from "node:assert/strict";
import { test } from "node:test";
import { cleanReaderHtml, cleanSnippet, derivedText, type NoiseStats } from "../src/feeds/contentNoise.js";

const BODY = [
  "The ministry confirmed on Tuesday that the new rules apply from the first of November, after months of consultation with the affected associations and several regional authorities.",
  "Operators have until the end of the year to adapt their systems; smaller providers may apply for an extension if they can show a concrete plan for the migration of their existing contracts.",
  "Critics argue that the timetable is too tight, while the ministry points to a transition period that was agreed with industry representatives during the summer negotiations.",
].map(text => `<p>${text}</p>`).join("");

const HEAD = '<ol data-k5a-pos="west_breadcrumb"><li><a href="https://example.test/">example</a></li><li><a href="https://example.test/news/">News</a></li>' +
  '<li><a href="https://example.test/news/series/">Series</a></li></ol>' +
  '<p><span><span>Stand: </span><time datetime="2026-10-14 08:54">14.10.2026, 08:54 Uhr</time></span></p>' +
  '<p><a href="#id-Comments">Kommentieren</a></p>';

test("the reader loses breadcrumbs, dateline and jump links but keeps what a publisher monetises", () => {
  const stats: NoiseStats = {};
  const html = HEAD + '<p><a href="https://example.test/follow">Uns auf Google folgen</a></p>' + BODY +
    '<p>Anzeige</p><p>Jetzt das Angebot entdecken (Affiliate-Link).</p><p>© dpa | 14.10.2026 06:43</p>' +
    '<p>Der Newsletter informiert Sie täglich. Hier geht’s zur Anmeldung!</p>';
  const cleaned = cleanReaderHtml(html, "Title", stats);
  assert.doesNotMatch(cleaned, /<ol/);
  assert.doesNotMatch(cleaned, /Stand:/);
  assert.doesNotMatch(cleaned, /#id-Comments/);
  for (const kept of ["Uns auf Google folgen", "Anzeige", "Affiliate-Link", "© dpa", "Newsletter informiert", "ministry confirmed"]) {
    assert.ok(cleaned.includes(kept), `reader should keep: ${kept}`);
  }
  assert.deepEqual(stats, { breadcrumb: 1, dateline: 1, "section-chip": 1 }, "the jump link is a short link before the text");
});

test("a headline repeated at the start of the body and player leftovers are removed from the reader", () => {
  const html = "<h1>Elon as Wario</h1><p>1:49 Something else plays Autoplay</p><p>Audiobeitrag</p>" + BODY;
  const cleaned = cleanReaderHtml(html, "Elon as Wario");
  assert.doesNotMatch(cleaned, /Elon as Wario/);
  assert.doesNotMatch(cleaned, /Autoplay|Audiobeitrag/);
  assert.match(cleaned, /ministry confirmed/);
});

test("consent placeholders of embedded content go with their companion lines only", () => {
  const html = BODY + "<div><p>Empfohlener redaktioneller Inhalt</p><p>An dieser Stelle findest du einen externen Inhalt von Reddit, der den Artikel ergänzt.</p>" +
    "<p>Reddit-Inhalte erlauben</p><p>Ich bin damit einverstanden, dass mir Inhalte von Reddit angezeigt werden.</p><p>Link zum Reddit-Inhalt</p></div>" +
    "<p>Ich bin damit einverstanden, dass dies ein normaler Satz im Artikel ist.</p>";
  const cleaned = cleanReaderHtml(html, null);
  assert.doesNotMatch(cleaned, /externen Inhalt|erlauben|Link zum Reddit/);
  assert.match(cleaned, /normaler Satz im Artikel/);
});

test("a language switcher is dropped but a sentence naming two languages is not", () => {
  const switcher = "<p>English 日本語 简体字 繁體字 Français Español</p>";
  assert.doesNotMatch(cleanReaderHtml(switcher + BODY, null), /日本語/);
  const sentence = "<p>The guide is available in English and Deutsch.</p>";
  assert.match(cleanReaderHtml(sentence + BODY, null), /available in English/);
});

test("html without noise is returned untouched", () => {
  assert.equal(cleanReaderHtml(BODY, "Title"), BODY);
});

test("derived text drops credits, calls to action, advertising and recommendation tails", () => {
  const html = "<p>Science 14.10.2026</p><figure><figcaption>Das ist der City-Adventskalender (Bildquelle: LEGO).</figcaption></figure>" + BODY +
    "<p>Click Here to Buy Now: $59 $90 ($31 off). Hurry, only a few left!</p>" +
    "<p>Wählen Sie FUTUREZONE als bevorzugte Google-Quelle</p>" +
    "<p>Facebook, Reddit, Google News, X, Threads</p><p>© dpa | 14.10.2026 06:43</p>" +
    "<p>Auch interessant:</p><p><a href='/a'>Another story</a></p><p><a href='/b'>And another one</a></p><p>Sales Manager B2B Recruiting GmbH in Düsseldorf</p>";
  const stats: NoiseStats = {};
  const text = derivedText(html, "Title", stats);
  assert.match(text, /ministry confirmed/);
  assert.match(text, /smaller providers may apply/);
  for (const dropped of ["Bildquelle", "Hurry", "bevorzugte Google-Quelle", "Threads", "© dpa", "Another story", "Sales Manager", "Science 14.10.2026"]) {
    assert.ok(!text.includes(dropped), `derived text should drop: ${dropped}`);
  }
  assert.ok(stats["recommendations"] >= 1 && stats["advertising"] >= 1 && stats["call-to-action"] >= 2 && stats["credit"] >= 1);
});

test("a label in the middle of an article only removes its own links", () => {
  const html = BODY + "<p>Aktuelle News:</p><p><a href='/x'>A related headline</a></p>" + BODY.replace(/ministry/g, "agency");
  const text = derivedText(html, null);
  assert.ok(!text.includes("A related headline"));
  assert.match(text, /agency confirmed/);
});

test("derived text keeps sentences that merely mention newsletters or credits inside the story", () => {
  const long = "<p>" + "Der Verlag hat den Newsletter abonniert und die Anmeldung für alle Leser gestrichen, weil die Zahl der Beschwerden stark gestiegen war und ein Teil der Abonnenten den Dienst nicht mehr nutzen wollte, wie das Unternehmen am Dienstag mitteilte. ".repeat(2) + "</p>";
  const text = derivedText(long + BODY, null);
  assert.match(text, /Newsletter abonniert/);
});

test("cleaning never leaves an article with nothing", () => {
  const onlyChrome = "<p>Anzeige</p><p>Auch interessant:</p><p>FTC: We use income earning auto affiliate links.</p>";
  const text = derivedText(onlyChrome + "<p>Short but real.</p>", null);
  assert.match(text, /Short but real/);
});

test("snippet footers of feed plugins are removed whatever the site", () => {
  const cases: [string, string, string | null][] = [
    ["Mit der kostenlosen App lassen sich Lautsprecher nutzen. […]\n★ iPhone-Ticker bei Google bevorzugen ★\nDer Beitrag Gratis-App bringt Durchsagen wurde zuerst auf iphone-ticker.de veröffentlicht.", "Gratis-App bringt Durchsagen", "Mit der kostenlosen App lassen sich Lautsprecher nutzen. […]"],
    ["Der neue HomePod mini 2 lässt sich nutzen […]\nDer Beitrag HomePod Mini 2 am Mac erschien zuerst auf appgefahren.de.", "HomePod Mini 2 am Mac", "Der neue HomePod mini 2 lässt sich nutzen […]"],
    ["Der Beitrag Kein Wind erschien zuerst beim Online-Magazin BASIC thinking. Über unseren Newsletter UPDATE startest du jeden Morgen bestens informiert in den Tag.\nWährend viele Nationen diskutieren […]\nDer Beitrag Kein Wind erschien zuerst auf BASIC thinking. Folge uns auch auf Google News und Flipboard oder abonniere unseren Newsletter UPDATE.", "Kein Wind", "Während viele Nationen diskutieren […]"],
    ["If you damage the hub, the fees are $39.\r\n\r\nRelated Roundup: Apple HomeView\nTag: AppleCare\nBuyer's Guide: HomeView (Buy Now)\nThis article, \"Repair Fees\" first appeared on MacRumors.com\nDiscuss this article in our forums", "Repair Fees", "If you damage the hub, the fees are $39."],
    ["Kyoto is full of temples.\nThe post Our 11 Favorites appeared first on Japan Cheapo.", "Our 11 Favorites", "Kyoto is full of temples."],
    ["An OpenAI engineer was arrested.\nRead the full story at The Verge.", "OpenAI", "An OpenAI engineer was arrested."],
    ["The ministry said Wednesday.\nRead full story here", "x", "The ministry said Wednesday."],
    ["Apple is asking a judge to overturn a verdict. Here are the details.\nmore…", "x", "Apple is asking a judge to overturn a verdict. Here are the details."],
    ["Zwei ehemalige Mitarbeiter erinnern sich.\n Mehr", "x", "Zwei ehemalige Mitarbeiter erinnern sich."],
    ["Moss has been on this planet for around 450 million years.", "Moss glows", "Moss has been on this planet for around 450 million years."],
    ["Yanko Moss glows\nMoss has been on this planet for around 450 million years...", "Yanko Moss glows", "Moss has been on this planet for around 450 million years..."],
    ["Vivid baut sein Angebot aus.\nZum Beitrag: Vivid\r\n\r\nWo du uns folgen kannst:\r\nFacebook, Reddit, Google News, X, Threads\r\n\r\n\r\n    Auf dem Laufenden bleiben?\r\n    \n\r\n    Fügt uns doch bei Google als bevorzugte Quelle hinzu!", "Vivid", "Vivid baut sein Angebot aus."],
    ["Kyoto isn’t just full of stunning temples.\n\n\t\t\t\t\n\t\t\t\t\t\tJump to:\n\t\t\t\t\t1. Aiyo!", "x", "Kyoto isn’t just full of stunning temples.\nJump to:\n1. Aiyo!"],
  ];
  for (const [input, title, expected] of cases) assert.equal(cleanSnippet(input, title), expected, input.slice(0, 40));
  assert.equal(cleanSnippet(null), null);
  assert.equal(cleanSnippet("The post Only Footer appeared first on Site."), "");
});

const STORY = "<p>Ein Feuerwerkskörper, ein Wohnungsbrand und am Ende der Tod einer Frau: Gut zehn Monate nach dem Feuer beginnt heute der Prozess gegen den mutmaßlichen Verursacher, dem fahrlässige Tötung vorgeworfen wird.</p>" +
  "<p>Die Rakete soll auf dem Balkon eines Mehrfamilienhauses gelandet sein und dort einen Brand ausgelöst haben, der sich bis zur Wohnung der Bewohnerin ausbreitete, wie die Staatsanwaltschaft mitteilte.</p>";

test("a broadcaster page head: caption twice, credit, tag list, audio label, separator, date, headline", () => {
  const caption = "Nach einem Balkonbrand war an Silvester eine Seniorin ums Leben gekommen.";
  const html = '<figure><img src="https://img.test/a.jpg"></figure>' +
    `<section><p>Bild</p><p>${caption}</p><p>Bildrechte: Bildrechte: Mona Böhm / BR</p></section>` +
    '<section><p>Schlagwörter</p><ul><li><a href="/s?q=Brand">Brand</a></li><li><a href="/s?q=Feuer">Feuer</a></li></ul></section>' +
    `<div><p><span>Bildrechte: Bildrechte: Mona Böhm / BR</span></p><p>Audiobeitrag</p><p>${caption}</p></div>` +
    '<section><div><p><time datetime="2026-10-14T07:10">14.10.2026, 07:10 Uhr</time></p><p>Audiobeitrag</p></div><div><!-- --> <p><span>&gt;</span></p></div>' +
    "<h2>Prozess gegen Mann nach Brand</h2>" + STORY + "</section>" +
    '<section><p><em>"Hier ist Bayern": Der Newsletter informiert Sie immer montags bis freitags zum Feierabend über das Wichtigste vom Tag in Ihrem privaten Postfach. </em><a href="/n">Hier geht’s zur Anmeldung!</a></p></section>';
  const reader = cleanReaderHtml(html, "Prozess gegen Mann nach Brand");
  assert.doesNotMatch(reader, /Audiobeitrag|<h2>|14\.10\.2026|&gt;|<p>Bild<\/p>/);
  assert.equal((reader.match(/Nach einem Balkonbrand/g) ?? []).length, 1);
  assert.equal((reader.match(/Mona Böhm/g) ?? []).length, 1);
  assert.match(reader, /Schlagwörter/);
  assert.match(reader, /Newsletter informiert/);

  const text = derivedText(html, "Prozess gegen Mann nach Brand");
  assert.ok(text.startsWith("Ein Feuerwerkskörper"), text.slice(0, 80));
  assert.doesNotMatch(text, /Schlagwörter|Brand Feuer|Bildrechte|Newsletter|Audiobeitrag/);
});

test("a games site: video card with its autoplay label and a consent block of an embedded post", () => {
  const html = '<p><span><picture><img src="https://img.test/z.jpg"></picture></span><span>Der Werbe-Zeppelin stammt von Goodyear.</span></p>' +
    STORY +
    '<p><span><a href="https://example.test/videos/a,1.html" data-videoid="1"><span><img src="https://static.test/play.svg" alt="Video starten"></span><span><i></i>14:39</span></a></span>' +
    '<a href="https://example.test/videos/a,1.html"><span>Wird GTA 6 jetzt zur Dating-Sim?</span></a></p><div><p><label for="toggle-autoplay-1">Autoplay</label></p></div>' +
    '<h2>So sieht der Marketing-Gag aus</h2><p>Ein Bild vom Zeppelin seht ihr zum Beispiel hier bei Reddit, wo ein User das Luftschiff gesehen hat:</p>' +
    '<div data-embed-type="reddit"><div><p>Empfohlener redaktioneller Inhalt</p><p>An dieser Stelle findest du einen externen Inhalt von Reddit, der den Artikel ergänzt.<br>Du kannst ihn dir mit einem Klick anzeigen lassen und wieder ausblenden.</p>' +
    '<div><p><label for="toggle-embed-reddit">Reddit-Inhalte erlauben</label></p></div><p>Ich bin damit einverstanden, dass mir Inhalte von Reddit angezeigt werden.</p>' +
    '<p>Personenbezogene Daten können an Drittplattformen übermittelt werden. Mehr dazu in unserer <a href="/datenschutz/">Datenschutzerklärung</a>.</p></div></div>' +
    '<p>Link zum <a href="https://reddit.test/r/1">Reddit-Inhalt</a></p>' + STORY;
  const reader = cleanReaderHtml(html, "GTA 6");
  assert.doesNotMatch(reader, /Autoplay|externen Inhalt|Reddit-Inhalte erlauben|Drittplattformen|Link zum/);
  assert.match(reader, /14:39/);
  assert.match(reader, /So sieht der Marketing-Gag aus/);
  const text = derivedText(html, "GTA 6");
  assert.doesNotMatch(text, /14:39|Autoplay|Reddit-Inhalt/);
  assert.match(text, /Ein Bild vom Zeppelin/);
});

test("the reader keeps structure and emphasis but no fonts, sizes, colours or classes", () => {
  const html = '<div class="article" style="font-family: Georgia"><h2 style="font-size: 30px">Heading</h2>' +
    '<p style="text-align: justify; color: #333" class="lead"><font face="Arial" size="4"><b>Bold</b> and <i>italic</i> text</font> with ' +
    '<span style="font-weight: bold; font-size: 14px">styled bold</span> and <span style="font-style: italic">styled italic</span>.</p>' +
    '<p align="center"><big>Big</big> <small>small</small> <u>underlined</u></p>' +
    '<table width="600" border="1"><tr><td width="50%" bgcolor="#eee">Cell</td></tr></table>' +
    '<img src="https://img.test/a.jpg" width="640" height="360" alt="A" style="float:left">' +
    '<style>p { font-size: 40px }</style><p id="note-1"><span id="fn">Footnote</span> <a href="#fn">1</a></p></div>';
  const cleaned = cleanReaderHtml(html, null);
  assert.doesNotMatch(cleaned, /style=|class=|face=|size=|color=|align=|bgcolor=|border=|<font|<span id="x"|<big|<small|<u>|<style/i);
  assert.match(cleaned, /<h2>Heading<\/h2>/);
  assert.match(cleaned, /<b>Bold<\/b> and <i>italic<\/i> text/);
  assert.match(cleaned, /<strong>styled bold<\/strong>/);
  assert.match(cleaned, /<em>styled italic<\/em>/);
  assert.match(cleaned, /<img src="https:\/\/img.test\/a.jpg" width="640" height="360" alt="A">/);
  assert.match(cleaned, /<table><tbody><tr><td>Cell<\/td>/);
  assert.match(cleaned, /<span id="fn">Footnote<\/span>/);
});

test("tracking attributes and unused ids are dropped while links, rel and lazy sources stay", () => {
  const html = '<p id="intro" data-id-ec="{&quot;a&quot;:1}" aria-label="x" role="note" onclick="track()">See <a href="https://shop.test/p?aff=1" rel="sponsored noopener" target="_blank" data-trk-label="x" aria-hidden="false">the offer</a> and <a href="#fn1">a note</a>.</p>' +
    '<h2 id="topic">Topic</h2><p id="fn1">Footnote</p><img src="data:image/gif;base64,R0lGOD" data-src="https://img.test/real.jpg" data-nimg="fill" alt="Real">';
  const cleaned = cleanReaderHtml(html, null);
  assert.doesNotMatch(cleaned, /data-id-ec|aria-|role=|onclick|data-trk|data-nimg|id="intro"|id="topic"/);
  assert.match(cleaned, /id="fn1"/);
  assert.match(cleaned, /rel="sponsored noopener"/);
  assert.match(cleaned, /target="_blank"/);
  assert.match(cleaned, /data-src="https:\/\/img.test\/real.jpg"/);
});

test("a section chip and a standalone date before the first paragraph are dropped, a short link later is not", () => {
  const lead = "<p>Der Widerstand gegen Künstliche Intelligenz und die dafür gebauten Rechenzentren nimmt stetig zu, wie mehrere Berichte zeigen.</p>";
  const head = '<p><a href="/netzpolitik">Netzpolitik</a></p><p>14.10.2026</p>';
  const cleaned = cleanReaderHtml(head + lead + '<p><a href="/mehr">Mehr dazu</a></p>', null);
  assert.doesNotMatch(cleaned, /Netzpolitik|14\.10\.2026/);
  assert.match(cleaned, /Widerstand gegen/);
  assert.match(cleaned, /Mehr dazu/);
});

test("a wrapper element's picture address replaces the placeholder image inside it", () => {
  const html = `<figure><a-img alt="Portrait" src="/imgs/71/portrait.png" width="810"><img alt="Portrait" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'%3E%3C/svg%3E" width="810"></a-img><figcaption>Portrait</figcaption></figure><p>Text</p>`;
  const stats: Record<string, number> = {};
  const cleaned = cleanReaderHtml(html, null, stats);
  assert.match(cleaned, /<img[^>]*src="\/imgs\/71\/portrait\.png"/);
  assert.doesNotMatch(cleaned, /a-img|data:image/);
  assert.match(cleaned, /<figcaption>Portrait<\/figcaption>/);
  assert.equal(stats["custom-image"], 1);
  const bare = cleanReaderHtml(`<p><a-img alt="Chart" src="https://cdn.example.test/chart.png"></a-img></p><p>More text here.</p>`);
  assert.match(bare, /<img[^>]*src="https:\/\/cdn\.example\.test\/chart\.png"[^>]*>/);
  assert.equal(cleanReaderHtml(`<p><img src="/photo.jpg"></p>`), `<p><img src="/photo.jpg"></p>`);
});

test("a link that holds one badge in two colour schemes keeps its label as text instead of two large images", () => {
  const stats: NoiseStats = {};
  const badge = '<p><a target="_blank" rel="nofollow" href="https://google.com/preferences/source?q=https://example.test" aria-label="Add Example as a preferred source on Google">' +
    '<img src="https://example.test/theme/badge-dark.png" alt="Add Example as a preferred source on Google">' +
    '<img src="https://example.test/theme/badge-light.png" alt="Add Example as a preferred source on Google"></a></p>';
  const html = BODY + '<ul><li><a href="https://amzn.to/x">Affiliate item</a></li></ul>' + badge + '<p><em>FTC: We use income earning auto affiliate links.</em></p>';
  const cleaned = cleanReaderHtml(html, "Title", stats);
  assert.doesNotMatch(cleaned, /badge-(dark|light)\.png/);
  assert.match(cleaned, /<a [^>]*href="https:\/\/google\.com\/preferences\/source[^"]*"[^>]*>Add Example as a preferred source on Google<\/a>/);
  for (const kept of ["Affiliate item", "FTC: We use income earning", "ministry confirmed"]) assert.match(cleaned, new RegExp(kept));
  assert.equal(stats["image-variants"], 1);
});

test("links with one image, with different images or with text next to the images stay as they are", () => {
  const same = '<a href="https://example.test/a"><img src="https://example.test/a.png" alt="Logo"></a>';
  const different = '<a href="https://example.test/b"><img src="https://example.test/1.png" alt="Front"><img src="https://example.test/2.png" alt="Back"></a>';
  const withText = '<a href="https://example.test/c"><img src="https://example.test/3.png" alt="Pic"><img src="https://example.test/4.png" alt="Pic"> Gallery</a>';
  const cleaned = cleanReaderHtml(BODY + `<p>${same}</p><p>${different}</p><p>${withText}</p>`, "Title");
  for (const src of ["a.png", "1.png", "2.png", "3.png", "4.png"]) assert.match(cleaned, new RegExp(src.replace(".", "\\.")));
});

test("variants without a label collapse to the first image", () => {
  const html = BODY + '<p><a href="https://example.test/s"><img src="https://example.test/dark.png"><img src="https://example.test/light.png"></a></p>';
  const cleaned = cleanReaderHtml(html, "Title");
  assert.match(cleaned, /dark\.png/);
  assert.doesNotMatch(cleaned, /light\.png/);
});

test("structured data standing as text and a lone date or reading time near the start do not reach the reader", () => {
  const ld = JSON.stringify({ "@context": "https://schema.org", "@type": "ImageObject", url: "https://example.test/a.jpg", caption: "Ein Airbus über der Landebahn" });
  const stats: NoiseStats = {};
  const html = '<header><p>Die Lufthansa hat ihrem ersten Airbus einen Namen gegeben. Der Langstreckenjet kommt Mitte November nach München, sein erster Linienflug ist für Dezember geplant.</p>' +
    '<p>15. Oktober 2026, 10:51 Uhr</p><custom-list :article="1"><p>2 min</p></custom-list>' +
    `<figure><img src="https://example.test/a.jpg" alt="x"><figcaption>Ein Airbus über der Landebahn</figcaption><component :is="'script'" type="application/ld+json">${ld}</component></figure></header>` +
    `<div>${ld}</div>` + BODY + '<p>Der Termin steht für den 3. Dezember 2026 fest, wie die Fluggesellschaft mitteilte.</p>';
  const cleaned = cleanReaderHtml(html, "Title", stats);
  assert.doesNotMatch(cleaned, /@context|schema\.org/);
  assert.doesNotMatch(cleaned, /15\. Oktober 2026/);
  assert.doesNotMatch(cleaned, />2 min</);
  for (const kept of ["Die Lufthansa hat ihrem ersten Airbus", "Ein Airbus über der Landebahn", "ministry confirmed", "Der Termin steht für den 3. Dezember 2026 fest"]) assert.match(cleaned, new RegExp(kept));
  assert.equal(stats["structured-data"], 2);
  assert.equal(stats["dateline"], 1);
  assert.equal(stats["reading-time"], 1);
});

test("dates and reading times inside the story stay", () => {
  const body = BODY + `<p>${"Weiterer Absatz mit ausreichend Text. ".repeat(25)}</p>` + '<p>Am 15. Oktober 2026 fiel die Entscheidung, die Frist läuft bis zum 3. Dezember 2026.</p><p>5 min</p><p>Oct 15, 2026</p>';
  const cleaned = cleanReaderHtml(body, "Title");
  assert.match(cleaned, /Am 15\. Oktober 2026 fiel die Entscheidung/);
  assert.match(cleaned, />5 min</, "far from the start a line like this may be part of the story");
  assert.match(cleaned, />Oct 15, 2026</);
});
