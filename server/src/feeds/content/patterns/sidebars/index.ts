import de from "./de.js";
import en from "./en.js";

/** One file per language, searched all at once. To add a language, add a file next to these and list it here. */
export const SIDEBAR_HEADINGS: readonly RegExp[] = [de, en].flat();
export { SIDEBAR_SELECTORS } from "./selectors.js";
