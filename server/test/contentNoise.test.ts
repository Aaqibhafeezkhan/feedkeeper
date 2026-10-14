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
  assert.deepEqual(stats, { breadcrumb: 1, dateline: 1, "jump-link": 1 });
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
