/** Consent notices that sit where an embed would be, in English. See `de.ts` for what the two lists mean. */
export default {
  anchors: [
    /^(?:Recommended|Featured) editorial content$/i,
    /^External content$/i,
    /^Content from (?:YouTube|Vimeo|Instagram|X|Twitter|TikTok|Spotify|Facebook)$/i,
    /^(?:Show|Load|Allow) external content$/i,
  ],
  companions: [
    /^I agree (?:to|that) .{0,80}(?:external|third[- ]party) content/i,
    /^Personal data (?:may|can) be (?:transmitted|transferred|shared) to third[- ]party/i,
    /^(?:Show|Load|Allow|Display) content$/i,
  ],
};
