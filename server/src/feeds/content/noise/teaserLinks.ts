import { TEASER_LINK_ALWAYS, TEASER_LINK_TEXT } from "../patterns/teaser-links.js";
import { type ContentRule, flat, pruneEmpty } from "../shared.js";

/** Brackets a site puts around the link: "[mehr]", "(more)", "« mehr »". */
const OPENING = /[[(«]\s*$/;
const CLOSING = /^\s*[\])»]/;

/**
 * A link that only says "more" or "continue reading" at the end of a text. With brackets around it ("Titel[mehr]") they go
 * as well. Only a link that follows other text of its block counts, so a menu entry or a button of its own stays.
 */
export const teaserLinks: ContentRule = {
  name: "teaser-links",
  description: "A link that only says \"more\" or \"continue reading\" at the end of a text, with the brackets around it, is removed.",
  apply(root, stats) {
    let changed = false;
    for (const link of [...root.querySelectorAll("a")]) {
      if (!root.contains(link) || link.querySelector("img, picture, video")) continue;
      const text = flat(link.textContent);
      const always = TEASER_LINK_ALWAYS.some(pattern => pattern.test(text));
      if (!always && !TEASER_LINK_TEXT.some(pattern => pattern.test(text))) continue;
      const block = link.closest("p, div, li, td, blockquote, section, article") ?? link.parentElement;
      if (!block) continue;
      // Only the end of the block: nothing but whitespace, brackets or breaks may follow the link.
      let after = link.nextSibling;
      const tail: Node[] = [];
      while (after) {
        if (after.nodeType === 3) {
          const rest = (after.textContent ?? "").replace(CLOSING, "");
          if (flat(rest) !== "") break;
        } else if (after.nodeName !== "BR") break;
        tail.push(after);
        after = after.nextSibling;
      }
      const before = link.previousSibling;
      const precedingText = flat(block.textContent).replace(text, "");
      // A bare "Mehr" with nothing before it is a menu entry or a button; with brackets around it, or as a longer phrase, it is the teaser.
      const bracketed = before?.nodeType === 3 && OPENING.test(before.textContent ?? "");
      if (!always && !bracketed && precedingText.replace(/[[\]()«»\s]/g, "") === "") continue;
      if (bracketed && before) before.textContent = (before.textContent ?? "").replace(OPENING, "");
      tail.forEach(node => node.parentNode?.removeChild(node));
      const parent = link.parentNode;
      link.remove();
      // A break left at the end of the container goes with the link.
      while (parent?.lastChild && (parent.lastChild.nodeName === "BR" || (parent.lastChild.nodeType === 3 && flat(parent.lastChild.textContent) === ""))) parent.removeChild(parent.lastChild);
      pruneEmpty(parent);
      stats["teaser-links"] = (stats["teaser-links"] ?? 0) + 1;
      changed = true;
    }
    return changed;
  },
};
