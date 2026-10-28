import type { ContentRoot, ContentRule, NoiseStats } from "../shared.js";
import { consentEmbeds } from "./consent.js";
import { mediaElements } from "./media.js";
import { socialEmbeds } from "./social.js";
import { videoPlayers } from "./video.js";

/**
 * Embeds, in the order they must run: consent plugins first, because the address of the embed sits inside their
 * notice, then the video players and iframes, then native audio and video elements, then the social posts.
 */
export const EMBED_RULES: readonly ContentRule[] = [consentEmbeds, videoPlayers, mediaElements, socialEmbeds];

/**
 * Turns every embed of a page into the marked link a reader shows as a card. A fetched page must go through this
 * before its scripts, frames and `noscript` blocks are removed: that is where consent plugins and players keep the address.
 */
export function resolveEmbeds(root: ContentRoot, stats: NoiseStats = {}): boolean {
  return EMBED_RULES.map(rule => rule.apply(root, stats)).some(Boolean);
}
