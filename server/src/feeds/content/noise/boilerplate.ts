import { BOILERPLATE_ANYWHERE, BOILERPLATE_TRAILING } from "../patterns/boilerplate/index.js";
import { type ContentRoot, type ContentRule, count, flat, pruneEmpty } from "../shared.js";

const BLOCKS = "p, div, li, h2, h3, h4, h5, h6, span";
const NESTED = "p, div, li, ul, ol, h2, h3, h4, h5, h6";
/** Footers can only sit in the second half of the text: before it, the same words are part of the story. */
const AFTER_SHARE = 0.5;
/** A list after a removed box ("Follow topics and authors …") that holds names, or nothing at all, belongs to the box. */
const LIST_ITEM_LIMIT = 60;

function textBefore(root: ContentRoot, node: Node): number {
  const range = root.ownerDocument?.createRange() ?? (root as Document).createRange();
  range.setStart(root, 0);
  range.setEndBefore(node);
  return flat(range.toString()).length;
}

/** The list that directly follows a block, when it only holds short names or empty items. */
function followingNameList(block: Element): Element | null {
  const next = block.nextElementSibling;
  if (!next || !/^(UL|OL)$/.test(next.tagName)) return null;
  const items = [...next.querySelectorAll("li")];
  return items.length > 0 && items.every(item => flat(item.textContent).length <= LIST_ITEM_LIMIT) ? next : null;
}

/**
 * Lines that sites add to their own text: "Follow us on Google", the words of a download button, the file name of a picture shown as text,
 * "This article first appeared on …", the related links under a MacRumors story. A block goes when its whole text is one of these lines
 * (footers only in the second half), together with the list of names that follows a "follow topics" box.
 */
export const boilerplate: ContentRule = {
  name: "boilerplate",
  description: "Blocks that only hold a follow-us call, a download button text, an image file name or an \"appeared first on\" footer are removed.",
  apply(root, stats) {
    let changed = false;
    const total = flat(root.textContent).length;
    for (const block of [...root.querySelectorAll(BLOCKS)]) {
      if (!root.contains(block) || block.querySelector("img, picture, video, audio, iframe") || block.querySelector(NESTED)) continue;
      const text = flat(block.textContent);
      if (text === "" || text.length > 400) continue;
      const anywhere = BOILERPLATE_ANYWHERE.some(pattern => pattern.test(text));
      const trailing = !anywhere && total > 0 && textBefore(root, block) / total >= AFTER_SHARE && BOILERPLATE_TRAILING.some(pattern => pattern.test(text));
      if (!anywhere && !trailing) continue;
      const parent = block.parentNode;
      followingNameList(block)?.remove();
      block.remove();
      pruneEmpty(parent);
      count(stats, "boilerplate");
      changed = true;
    }
    return changed;
  },
};
