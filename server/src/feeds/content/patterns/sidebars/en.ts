/**
 * Headings that start a list of other articles. A heading counts only when it is followed by links and stands in the
 * second half of the text (see `noise/sidebars.ts`), so a section of the story with the same title stays.
 */
export default [
  /^(?:Popular (?:Stories|Articles|Posts)|Most (?:Read|Popular)|Trending(?: Now| Stories)?|Related (?:Articles|Stories|Posts|Reading|Content)|You (?:might|may) also like|More (?:from|stories|articles)\b.*|Read (?:more|next)|Further reading|Top Stories|Recommended(?: for you)?|Latest (?:Stories|News))$/i,
  // A site's welcome ("Welcome to GamePro!") with logo and links at the end of the text.
  /^Welcome to [^.!?]{2,40}!?$/i,
];
