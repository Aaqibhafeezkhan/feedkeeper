/** Headings, in German, that start a list of other articles. See `en.ts` for how they are used. */
export default [
  /^(?:Mehr zum Thema|Weitere Artikel|Weitere Meldungen|Ähnliche Artikel|Verwandte Artikel|Auch interessant|Das könnte (?:dich|Sie|euch) (?:auch )?interessieren|Meistgelesen(?:e Artikel)?|Beliebte Artikel|Lesen Sie auch|Lies auch|Empfehlungen)$/i,
  // Das Willkommen einer Seite („Willkommen bei GamePro!“) mit Logo und Links am Ende des Textes.
  /^Willkommen bei [^.!?]{2,40}!?$/i,
];
