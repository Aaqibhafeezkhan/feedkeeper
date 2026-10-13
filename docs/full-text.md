# Full-text fetching

Reader requests, background preparation, saved articles and API integrations share one planner. Results belong to the article, so subscribers reuse the same extraction. Saving a new link uses the same network and host limits.

The planner keeps up to 1,000 article jobs in SQLite and refills background work continuously. Opening an article has priority over explicit preparation, active editions, saved articles and other background work. Waiting jobs gain priority with age; background selection also favours older articles. A busy host does not prevent another host from running.

## Settings

All settings take effect after restarting the process. Invalid values stop startup when the planner is initialized.

| Variable | Default | Allowed |
| --- | ---: | ---: |
| `FULLTEXT_CONCURRENCY` | 2 | 1–8 |
| `FULLTEXT_HOST_CONCURRENCY` | 1 | 1–4 |
| `FULLTEXT_MAX_WAITING` | 32 | 0–128 |
| `FULLTEXT_TIMEOUT_MS` | 20000 | 50–60000 |
| `FULLTEXT_AGING_MS` | 60000 | 50–600000 |

Start with the defaults. On a small host, use one extraction at a time. Keep host concurrency at one unless the sources explicitly allow more. Feed polling and image downloads have separate limits, so increasing all three together can consume much more memory and CPU.

The extraction deadline includes admission waiting, fetching and redirects; the HTTP stage also has a 12-second deadline. Parsing runs on the Node event loop, with a 2 MiB HTML limit; a timer cannot interrupt synchronous parsing or the operating system's pending DNS lookup. At most 64 HTTP consumers may wait for article results. They receive an overload response beyond that limit and time out after 30 seconds. A consumer timeout leaves the durable job intact. Concurrent consumers join the same article job; access is checked again before delivery.

Transient failures get at most two additional attempts with exponential backoff and jitter. HTTP 429/503 and valid `Retry-After` values delay the source host. Waiting for a retry uses no worker. Redirects also obey the destination host budget. Paywalls and consent walls keep their existing longer retry policy; shorter extraction results never replace better stored content.

## Operation

Run **one application process per database**. The job table survives shutdown, but active ownership is process-local. Multiple replicas need a different claim protocol and are not supported. Normal shutdown aborts active requests and leaves unfinished jobs available after restart.

The aggregate `fulltext_queue` log includes queued/running/waiting work, waiting consumers, completions, failures, retries, throttling, rejections, total extraction duration and the oldest job's wait. It contains no source addresses, credentials or article contents. Compare these counters with feed lag, process memory and API latency before raising concurrency.

Before upgrading, back up the database and stop the old process. Migration 0033 adds job age, retry state and host cooldowns. Start with the defaults and observe a full polling cycle. To roll back, stop the application and run the previous version with its previous settings. The additive columns and table may remain; keep the backup for a full restore. Older releases ignore saved host cooldowns, so wait out active source pauses before reverting. Do not run old and new processes together.
