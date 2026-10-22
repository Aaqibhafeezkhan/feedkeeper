import type { TFunction } from "i18next";

/**
 * The poller stores a code for a failed check (`feed_http_503`, `feed_timeout`, …). This turns it into a sentence that
 * says what is wrong and whether FeedKeeper tries again; a code it does not know is shown as it is.
 */
export function feedErrorMessage(t: TFunction, code: string): string {
  const http = /^feed_http_(\d{3})$/.exec(code);
  if (http) {
    const status = Number(http[1]);
    if (status === 404 || status === 410) return t("feeds.errors.notFound", { status });
    if (status === 401 || status === 403) return t("feeds.errors.refused", { status });
    if (status === 429) return t("feeds.errors.limited");
    if (status >= 400 && status < 500 && status !== 408 && status !== 425) return t("feeds.errors.rejected", { status });
    return t("feeds.errors.unavailable", { status });
  }
  if (code === "feed_timeout") return t("feeds.errors.timeout");
  if (code === "feed_network_error") return t("feeds.errors.network");
  if (code === "feed_invalid_or_unavailable") return t("feeds.errors.invalidFeed");
  return code;
}
