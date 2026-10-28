import { type ContentRule, count, flat, linkParagraph, pruneEmpty } from "../shared.js";

/** The address a native `<audio>` or `<video>` plays: its own `src`, or the first `<source>` inside it. Anything but http(s) is no address. */
function mediaAddress(element: Element): string | null {
  const source = element.getAttribute("src") ?? element.querySelector("source[src]")?.getAttribute("src") ?? "";
  const address = source.trim();
  if (address === "") return null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(address) && !/^https?:/i.test(address)) return null;
  return address;
}

/**
 * A native `<audio>` or `<video>` element needs the player of the reader's engine and the publisher's script to do anything useful: without
 * them it shows a bar with an error. What names an address becomes one marked link to the file (`data-media="audio" | "video"`), what does
 * not, because the file is set by a script, is left out.
 */
export const mediaElements: ContentRule = {
  name: "media-elements",
  description: "Native audio and video elements become one marked link to their file, or are removed when they name no address.",
  apply(root, stats) {
    const document = root.ownerDocument ?? (root as Document);
    let changed = false;
    for (const element of [...root.querySelectorAll("audio, video")]) {
      if (!root.contains(element)) continue;
      const kind = element.tagName.toLowerCase() === "audio" ? "audio" : "video";
      const address = mediaAddress(element);
      const parent = element.parentNode;
      if (address) {
        const label = flat(element.getAttribute("title")) || flat(element.getAttribute("aria-label")) || (kind === "audio" ? "Audio" : "Video");
        const replacement = linkParagraph(document, address, label);
        replacement.querySelector("a")?.setAttribute("data-media", kind);
        element.replaceWith(replacement);
      } else {
        element.remove();
        pruneEmpty(parent);
      }
      count(stats, "media-elements");
      changed = true;
    }
    return changed;
  },
};
