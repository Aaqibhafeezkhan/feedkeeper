import { type ContentRule, count, pruneEmpty } from "../shared.js";

const LIMIT = 2;

function isPixel(image: Element): boolean {
  const width = Number(image.getAttribute("width"));
  const height = Number(image.getAttribute("height"));
  return width > 0 && height > 0 && width <= LIMIT && height <= LIMIT;
}

/**
 * Counting pixels (VG Wort, Chartbeat, publisher analytics) arrive as pictures of one by one pixel inside the text. They show nothing, only
 * a gap in some readers, and every client would load them: they go.
 */
export const trackingPixels: ContentRule = {
  name: "tracking-pixels",
  description: "Pictures of one or two pixels in each direction, which only count a view, are removed.",
  apply(root, stats) {
    let changed = false;
    for (const image of [...root.querySelectorAll("img")].filter(isPixel)) {
      const parent = image.parentNode;
      image.remove();
      pruneEmpty(parent);
      count(stats, "tracking-pixels");
      changed = true;
    }
    return changed;
  },
};
