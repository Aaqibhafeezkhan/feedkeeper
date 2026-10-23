import { CONSENT_WRAPPER } from "../patterns/consent/wrappers.js";
import { type ContentRoot, type ContentRule, type NoiseStats, count, flat, linkParagraph, pruneEmpty } from "../shared.js";
import { embedTarget } from "./video.js";
import { socialFrameTarget } from "./social.js";

function decodeEmbedText(text: string): string {
  let decoded = text.replace(/\\+\//g, "/");
  for (let pass = 0; pass < 2; pass++) {
    decoded = decoded.replace(/&quot;|&#0?34;/g, '"').replace(/&#0?39;|&#x27;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
  }
  return decoded;
}

/** The text of a wrapper as far as the reader can look into it: attributes, scripts and the contents consent plugins keep encoded. */
function embedSource(wrapper: Element): string {
  let source = wrapper.outerHTML;
  for (const element of [wrapper, ...wrapper.querySelectorAll("*")]) {
    for (const attribute of [...element.attributes]) {
      if (!/^[A-Za-z0-9+/=\s]{80,}$/.test(attribute.value)) continue;
      // Plugins keep the embed as base64 in an attribute of their own choosing; only what decodes to markup or an address counts.
      const decoded = Buffer.from(attribute.value, "base64").toString("utf8");
      if (/<[a-z]|https?:\/\//i.test(decoded)) source += ` ${decoded}`;
    }
  }
  return decodeEmbedText(source);
}

/**
 * Consent plugins (Embed Privacy, Borlabs, Complianz, Real Cookie Banner, …) replace an embed with a notice and a
 * switch, and keep the embed itself in a script or an attribute until the reader agrees. A reader has nobody to ask:
 * the notice and its legal text are noise, while the video behind them is the content. The address is looked up
 * wherever it is kept; what is found stays as one marked link, a wrapper with nothing behind it goes. The same
 * wrapper around a plain WordPress embed block (`wp-block-embed`) only matters when an address can be found.
 */
function resolveConsentEmbeds(root: ContentRoot, stats: NoiseStats): { changed: boolean; links: { link: Element; kind: string; source: string }[] } {
  const links: { link: Element; kind: string; source: string }[] = [];
  let changed = false;
  for (const wrapper of [...root.querySelectorAll(`${CONSENT_WRAPPER}, figure.wp-block-embed`)]) {
    if (!root.contains(wrapper)) continue;
    const isConsent = wrapper.matches(CONSENT_WRAPPER);
    const source = embedSource(wrapper);
    const addresses = source.match(/(?:https?:)?\/\/[^\s"'<>\\)]+/g) ?? [];
    let found: { url: string; name: string; kind: string } | null = null;
    for (const address of addresses) {
      const video = embedTarget(address);
      if (video) { found = { ...video, kind: "video" }; break; }
      const post = socialFrameTarget(address);
      if (post) { found = { url: post.url, name: post.platform.name, kind: post.platform.kind }; break; }
    }
    if (!found && !isConsent) continue;
    // The title of the embed's own iframe names the video; the plugin's notice would only say "external content".
    const title = flat(/\btitle="([^"]{1,200})"/.exec(source.slice(Math.max(0, source.indexOf("<iframe"))))?.[1] ?? "");
    const parent = wrapper.parentNode;
    if (found) {
      const replacement = linkParagraph(wrapper.ownerDocument, found.url, (source.includes("<iframe") ? title : "") || found.name);
      wrapper.replaceWith(replacement);
      links.push({ link: replacement.querySelector("a") as Element, kind: found.kind, source: found.name });
    } else {
      wrapper.remove();
    }
    pruneEmpty(parent);
    count(stats, "consent-embed");
    changed = true;
  }
  return { changed, links };
}

/** Embeds held back by a consent plugin become a link to the embed, or go. */
export const consentEmbeds: ContentRule = {
  name: "consent-embeds",
  description: "Consent plugins' notices around videos and posts are replaced by one marked link, or removed without an address.",
  apply(root, stats) {
    const { changed, links } = resolveConsentEmbeds(root, stats);
    links.forEach(({ link, kind, source }) => {
      link.setAttribute("data-media", kind);
      link.setAttribute("data-source", source);
    });
    return changed;
  },
};
