/**
 * The words of a link that only says "continue": feeds end their summary with `[mehr]`, `(read more)` or a bare "Weiterlesen"
 * link that leads to the article, which is no part of the story. Matched against the whole text of one link.
 */
export const TEASER_LINK_TEXT: readonly RegExp[] = [
  /^(mehr|mehr lesen|weiterlesen|weiter lesen|mehr erfahren|zum artikel|artikel lesen|vollständigen artikel lesen)(\s*(…|\.\.\.|»|>|→))?$/i,
  /^(more|read more|read the full story|read full article|continue reading|keep reading|full story)(\s*(…|\.\.\.|»|>|→))?$/i,
  /^(続きを読む|もっと見る|続きはこちら|詳細|詳しく見る)$/,
];

/** Links that are the teaser's own words wherever they stand, even alone in a block: "Continue reading on UX Collective »". */
export const TEASER_LINK_ALWAYS: readonly RegExp[] = [
  /^(continue reading|read more|read the full story|weiterlesen|mehr lesen) (on|at|auf|bei) .{2,60}(»|>|→)?$/i,
];
