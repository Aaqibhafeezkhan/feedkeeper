import { LOADING_LABELS } from "../patterns/loading/index.js";
import { type ContentRule, count, flat, pruneEmpty } from "../shared.js";

/**
 * A script fills these blocks with content ("wird geladen …", "Loading…"). A reader does not run it, so the placeholder would stay in the
 * story as a line of text. Only a block that holds nothing but the label goes: no link, no picture, no other words.
 */
export const loadingPlaceholders: ContentRule = {
  name: "loading-placeholders",
  description: "Blocks that hold only a loading label such as \"wird geladen …\" or \"Loading…\" are removed.",
  apply(root, stats) {
    let changed = false;
    for (const block of [...root.querySelectorAll("p, div, span, li")]) {
      if (!root.contains(block) || block.querySelector("a[href], img, picture, video, audio, iframe")) continue;
      if (!LOADING_LABELS.some(pattern => pattern.test(flat(block.textContent)))) continue;
      // The innermost block that holds the label: a wrapper with more blocks inside is looked at on its own.
      if (block.querySelector("p, div, li")) continue;
      const parent = block.parentNode;
      block.remove();
      pruneEmpty(parent);
      count(stats, "loading-placeholders");
      changed = true;
    }
    return changed;
  },
};
