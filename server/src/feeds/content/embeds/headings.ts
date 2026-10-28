import { type ContentRule, count, flat, pruneEmpty } from "../shared.js";

const HEADINGS = "h2, h3, h4, h5";
const SCOPE_LEVELS = 4;
/** The wrapper of a card and its heading is small; a larger block holds the story, and its headings stay. */
const SCOPE_TEXT_LIMIT = 400;
const FOLLOWING = 4;

/**
 * Some sites put the title of a video or post above its player as a heading that links to a page of their own. Once the player is a
 * card with the same title, the title stands twice. The heading goes when it holds nothing but that title, is at most one link, and sits
 * in the small wrapper the card sits in.
 */
export const embedHeadings: ContentRule = {
  name: "embed-headings",
  description: "A heading that only repeats the title of the video or post card right after it is removed.",
  apply(root, stats) {
    let changed = false;
    for (const card of [...root.querySelectorAll("a[data-media]")]) {
      const title = flat(card.textContent).toLowerCase();
      if (title === "") continue;
      let scope: Element | null = card.parentElement;
      for (let level = 0; scope && level < SCOPE_LEVELS && flat(scope.textContent).length <= SCOPE_TEXT_LIMIT; level++, scope = scope.parentElement) {
        const heading = [...scope.querySelectorAll(HEADINGS)].find(candidate =>
          root.contains(candidate) && !candidate.contains(card) && flat(candidate.textContent).toLowerCase() === title &&
          candidate.querySelectorAll("a").length <= 1 && (candidate.compareDocumentPosition(card) & FOLLOWING) !== 0);
        if (!heading) continue;
        const parent = heading.parentNode;
        heading.remove();
        pruneEmpty(parent);
        count(stats, "embed-headings");
        changed = true;
        break;
      }
    }
    return changed;
  },
};
