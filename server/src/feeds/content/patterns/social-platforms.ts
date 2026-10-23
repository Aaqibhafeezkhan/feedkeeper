/**
 * The platforms whose posts become a link. To add one, add an entry: its host, the path of a single post and whether
 * it is a post or an audio player. A fixture in `test/fixtures/content/social-embeds` shows the expected result.
 */
export interface SocialPlatform {
  name: string;
  host: RegExp;
  /** The path of a single post, as opposed to a profile or the site's start page. */
  post: RegExp;
  kind: "social" | "audio";
}

export const SOCIAL_PLATFORMS: SocialPlatform[] = [
  { name: "Instagram", host: /^instagram\.com$/, post: /^\/(?:[\w.]+\/)?(?:p|reel|reels|tv)\/[\w-]+/, kind: "social" },
  { name: "X", host: /^(?:twitter|x)\.com$/, post: /^\/(?:i\/|[\w]+\/)(?:web\/)?status\/\d+/, kind: "social" },
  { name: "TikTok", host: /^tiktok\.com$/, post: /\/(?:video|photo)\/\d+/, kind: "social" },
  { name: "Bluesky", host: /^bsky\.app$/, post: /^\/profile\/[^/]+\/post\/[\w]+/, kind: "social" },
  { name: "Threads", host: /^threads\.(?:net|com)$/, post: /^\/@[\w.]+\/post\/[\w-]+/, kind: "social" },
  { name: "Reddit", host: /^reddit\.com$/, post: /^\/r\/\w+\/comments\//, kind: "social" },
  { name: "Facebook", host: /^facebook\.com$/, post: /\/(?:posts|videos|photos|permalink|watch|reel|share)\b|[?&](?:story_fbid|v)=/, kind: "social" },
  { name: "Spotify", host: /^open\.spotify\.com$/, post: /^\/(?:track|album|playlist|episode|show|artist)\/\w+/, kind: "audio" },
  { name: "SoundCloud", host: /^soundcloud\.com$/, post: /^\/[^/]+\/[^/]+/, kind: "audio" },
];

/** Classes of the blockquote placeholders that the platforms' scripts turn into the real post. */
export const SOCIAL_QUOTE = "blockquote.instagram-media, blockquote.twitter-tweet, blockquote.tiktok-embed, blockquote.bluesky-embed, " +
  "blockquote.reddit-embed-bq, blockquote.text-post-media, blockquote.fb-xfbml-parse-ignore";


/**
 * Mastodon has no fixed host: any instance embeds a post as an iframe whose address ends in `/@user/<id>/embed`. The
 * path alone identifies it, so it is matched on every host, for frames only.
 */
export const MASTODON_EMBED_PATH = /^\/@[\w.]+\/\d{5,}\/embed\/?$/;
