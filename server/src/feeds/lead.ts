import { createHash } from "node:crypto";
import { db } from "../db/index.js";
import { LEAD_VERSION, leadText } from "./contentNoise.js";
import type { Item } from "./repository.js";

type LeadSource = Pick<Item, "title" | "content_snippet" | "content_html" | "full_content_html">;
type StoredLead = LeadSource & Pick<Item, "content_lead" | "lead_version">;

const BACKFILL_BATCH = 50;
const BACKFILL_PAUSE_MS = 100;
const COMPUTED_LIMIT = 300;
const computed = new Map<string, string>();

export function computeLead(item: LeadSource): string {
  return leadText({ html: item.full_content_html || item.content_html, snippet: item.content_snippet, title: item.title });
}

/** Derive and store the lead of one item; call after its title, summary or content was written. */
export function refreshLead(itemId: number): void {
  const item = db.prepare<[number], LeadSource>("SELECT title, content_snippet, content_html, full_content_html FROM items WHERE id = ?").get(itemId);
  if (!item) return;
  db.prepare("UPDATE items SET content_lead = ?, lead_version = ? WHERE id = ?").run(computeLead(item), LEAD_VERSION, itemId);
}

/**
 * The lead to serve: the stored one while its rules are current, otherwise derived on the spot, so an article is
 * never served without one just because the backfill has not reached it.
 */
export function leadOf(item: StoredLead): string | null {
  if (item.lead_version === LEAD_VERSION) return item.content_lead || null;
  const key = createHash("sha1").update(item.title ?? "").update("\0").update(item.content_snippet ?? "").update("\0")
    .update(item.full_content_html || item.content_html || "").digest("base64");
  let lead = computed.get(key);
  if (lead === undefined) {
    lead = computeLead(item);
    if (computed.size >= COMPUTED_LIMIT) computed.delete(computed.keys().next().value as string);
    computed.set(key, lead);
  }
  return lead || null;
}

/** Derive leads for items that have none or were derived by older rules; returns how many were handled. */
export function backfillLeads(limit = BACKFILL_BATCH): number {
  const rows = db.prepare<[number, number], LeadSource & { id: number }>(
    "SELECT id, title, content_snippet, content_html, full_content_html FROM items WHERE lead_version IS NULL OR lead_version <> ? LIMIT ?",
  ).all(LEAD_VERSION, limit);
  const update = db.prepare("UPDATE items SET content_lead = ?, lead_version = ? WHERE id = ?");
  db.transaction(() => { for (const row of rows) update.run(computeLead(row), LEAD_VERSION, row.id); })();
  return rows.length;
}

/** Works through the backlog in small steps so polling and requests are never held up for long. */
export function startLeadBackfill(): void {
  let total = 0;
  const step = () => {
    const handled = backfillLeads();
    total += handled;
    if (handled === BACKFILL_BATCH) setTimeout(step, BACKFILL_PAUSE_MS).unref();
    else if (total > 0) console.log(`[db] derived the lead of ${total} stored items`);
  };
  setTimeout(step, 1000).unref();
}
