import { JSDOM } from "jsdom";
import { type ContentRoot, flat, pruneEmpty } from "../shared.js";

/** The address of a page that is a video: `/video/…`, `/videos/…`, `/mediathek/…`, `/watch`, `video-1234.html`. */
const VIDEO_PAGE = /(^|\/)(videos?|mediathek|watch|clips?)(\/|$|[-.])|\/(?:[\w-]+-)?video[\w-]*\.html?$/i;

function isVideoAddress(href: string | null): boolean {
  if (!href) return false;
  try {
    return VIDEO_PAGE.test(new URL(href, "https://example.org").pathname);
  } catch {
    return false;
  }
}

/** The posters in a text: a picture that is a link to a video page, and the block that holds it. */
function posters(root: ContentRoot): Array<{ link: Element; block: Element }> {
  const found: Array<{ link: Element; block: Element }> = [];
  for (const link of root.querySelectorAll("a[href]")) {
    if (!link.querySelector("img") || !isVideoAddress(link.getAttribute("href"))) continue;
    const block = link.closest("p, div, li") ?? link.parentElement;
    if (block) found.push({ link, block });
  }
  return found;
}

/** Whether what stands beside the poster says nothing but the title. */
function onlyTheTitle(block: Element, title: string | null | undefined): boolean {
  const copy = block.cloneNode(true) as Element;
  copy.querySelectorAll("a, img, picture, figure").forEach(node => node.remove());
  const text = flat(copy.textContent).replace(/[[\]()\s]/g, "");
  return text === "" || text.toLowerCase() === (title ?? "").replace(/[[\]()\s]/g, "").toLowerCase();
}

/**
 * A feed entry for a video is often just the poster as a link to the video page, the title again and "[mehr]". A client shows that as a
 * card for a video, like an embedded player, instead of an article with nothing to read: the poster stays, and under it a marked link to the
 * video page follows (`data-media="video"`), which clients turn into the card.
 */
export function markVideoTeasers(root: ContentRoot, title: string | null | undefined, stats: Record<string, number>): boolean {
  let changed = false;
  for (const { link, block } of posters(root)) {
    if (!block.isConnected && !root.contains(block)) continue;
    const href = link.getAttribute("href")!;
    const next = block.nextElementSibling;
    if (next?.querySelector(`a[data-media="video"][href="${href.replace(/"/g, "&quot;")}"]`)) continue;
    if (!onlyTheTitle(block, title)) continue;
    // The poster stays alone in its block; the words beside it move into the card.
    [...block.childNodes].forEach(node => {
      if (node.nodeType === 3 || node.nodeName === "BR") node.parentNode?.removeChild(node);
    });
    const document = block.ownerDocument;
    const paragraph = document.createElement("p");
    const card = document.createElement("a");
    card.setAttribute("href", href);
    card.setAttribute("data-media", "video");
    card.textContent = flat(title) || "Video";
    paragraph.append(card);
    block.after(paragraph);
    pruneEmpty(block.parentNode);
    stats["video-teasers"] = (stats["video-teasers"] ?? 0) + 1;
    changed = true;
  }
  return changed;
}

/** Whether a feed entry's text is such a video teaser; cheap to ask, as most entries fail the first test. */
export function isVideoTeaser(html: string | null | undefined, title: string | null | undefined): boolean {
  if (!html || html.length > 2000 || !/<img\b/i.test(html) || !/video|mediathek|watch|clip/i.test(html)) return false;
  const fragment = JSDOM.fragment(html);
  return posters(fragment).some(({ block }) => onlyTheTitle(block, title));
}
