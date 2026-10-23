import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { JSDOM } from "jsdom";
import { PAGE_RULES } from "../src/feeds/content/index.js";

/**
 * Every rule of the content pipeline is checked against its fixtures: `test/fixtures/content/<rule name>/<case>.input.html`
 * is run through the rule and must equal `<case>.expected.html`, and a second run over the result must change nothing.
 * To add a case, write the input and run `UPDATE_FIXTURES=1 npx tsx --test test/contentRules.test.ts`: it writes a missing
 * expected file, which you then read and commit. See docs/content-rules.md.
 */
const ROOT = join(import.meta.dirname, "fixtures", "content");

function run(rule: (typeof PAGE_RULES)[number], html: string): string {
  const fragment = JSDOM.fragment(html);
  rule.apply(fragment, {});
  const holder = fragment.ownerDocument.createElement("div");
  holder.append(fragment);
  return holder.innerHTML.trim();
}

for (const rule of PAGE_RULES) {
  const folder = join(ROOT, rule.name);
  const cases = existsSync(folder) ? readdirSync(folder).filter(file => file.endsWith(".input.html")).map(file => file.replace(".input.html", "")) : [];

  test(`${rule.name} has fixtures and a description`, () => {
    assert.ok(rule.description.length > 20, "a rule says in a sentence what it removes");
    assert.ok(cases.length > 0, `add at least one fixture in ${folder}`);
  });

  for (const name of cases) {
    test(`${rule.name}: ${name}`, () => {
      const input = readFileSync(join(folder, `${name}.input.html`), "utf8");
      const expectedPath = join(folder, `${name}.expected.html`);
      const actual = run(rule, input);
      if (!existsSync(expectedPath) && process.env["UPDATE_FIXTURES"]) writeFileSync(expectedPath, `${actual}\n`);
      assert.equal(actual, readFileSync(expectedPath, "utf8").trim());
      assert.equal(run(rule, actual), actual, "a second run changes nothing");
    });
  }
}
