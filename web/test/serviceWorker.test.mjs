import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

/** Runs the service worker source with stand-ins for its globals and returns what its fetch handler does. */
async function loadWorker() {
  const source = await readFile(new URL("../sw/sw.js", import.meta.url), "utf8");
  const handlers = {};
  const scope = { addEventListener: (type, handler) => { handlers[type] = handler; }, location: { origin: "https://rss.example" }, clients: { claim: async () => {} }, skipWaiting: async () => {} };
  const cache = { match: async () => undefined, put: async () => {}, add: async () => {}, delete: async () => true, keys: async () => [] };
  new Function("self", "caches", "fetch", source)(scope, { keys: async () => [], open: async () => cache, match: async () => undefined }, async () => { throw new Error("offline"); });
  return (pathname, init = {}) => {
    let answered = false;
    handlers.fetch({
      request: { method: "GET", mode: "cors", url: `https://rss.example${pathname}`, ...init },
      respondWith: (answer) => { answered = true; Promise.resolve(answer).catch(() => {}); },
    });
    return answered;
  };
}

test("the worker answers app files from its cache and leaves everything else to the network", async () => {
  const answers = await loadWorker();
  for (const path of ["/assets/index-abc.js", "/logo.svg", "/theme-init.js", "/manifest.webmanifest", "/favicon-32.png", "/api/auth/me", "/api/feeds/3/icon"]) {
    assert.equal(answers(path), true, `${path} is served by the worker`);
  }
  assert.equal(answers("/index.html", { mode: "navigate" }), true, "navigations still get the app shell");
});

test("paths that answer per signed-in user are never cached", async () => {
  const answers = await loadWorker();
  // Anything a hosting product adds outside /api/ falls here, as do the core's own dynamic routes.
  for (const path of ["/cloud/billing/status", "/billing/status", "/admin/users", "/export/opml", "/mcp", "/oauth/authorize", "/.well-known/oauth-authorization-server", "/api/auth/users", "/api/tokens"]) {
    assert.equal(answers(path), false, `${path} goes straight to the network`);
  }
  assert.equal(answers("/api/items", { method: "POST" }), false, "only GET requests are handled");
});

async function imageWorker() {
  const source = await readFile(new URL("../sw/sw.js", import.meta.url), "utf8");
  const handlers = {}; const entries = new Map(); const calls = [];
  let respond = async () => { throw new Error("offline"); };
  const key = request => typeof request === "string" ? request : request.url;
  const cache = { match: async req => entries.get(key(req))?.clone(), put: async (req,res) => entries.set(key(req), res.clone()), delete: async req => entries.delete(key(req)), keys: async () => [...entries.keys()].map(url => new Request(url)) };
  const scope = { addEventListener: (type, handler) => { handlers[type] = handler; }, location: { origin: "https://rss.example" } };
  new Function("self", "caches", "fetch", source)(scope, { open: async () => cache }, async req => { calls.push(req); return respond(req); });
  return { entries, calls, respond: value => { respond = value; }, fetch: path => {
    let result; handlers.fetch({ request: new Request(`https://rss.example${path}`), respondWith: value => { result = value; } }); return result;
  } };
}

test("ordinary cached images expire, revalidate and update while archive images stay fixed", async () => {
  const worker = await imageWorker(); const path = "/api/items/42/image?src=fixture&v=2"; const url = `https://rss.example${path}`;
  const headers = { "date": new Date().toUTCString(), "cache-control": "private, max-age=21600", etag: '"one"' };
  worker.entries.set(url, new Response("one", { headers }));
  assert.equal(await (await worker.fetch(path)).text(), "one"); assert.equal(worker.calls.length, 0);
  worker.entries.set(url, new Response("one", { headers: { ...headers, date: new Date(Date.now()-7*3600_000).toUTCString(), "cache-control": "private, max-age=31536000, immutable" } }));
  worker.respond(async req => { assert.equal(req.headers.get("if-none-match"), '"one"'); return new Response(null, { status:304, headers }); });
  assert.equal(await (await worker.fetch(path)).text(), "one"); assert.equal(worker.calls.length, 1);
  worker.entries.set(url, new Response("one", { headers: { ...headers, date: new Date(0).toUTCString() } }));
  worker.respond(async () => new Response("two", { headers: { ...headers, etag: '"two"' } }));
  assert.equal(await (await worker.fetch(path)).text(), "two");
  worker.entries.set(url, new Response("two", { headers: { ...headers, date: new Date(0).toUTCString() } }));
  worker.respond(async () => { throw new Error("offline"); });
  assert.equal(await (await worker.fetch(path)).text(), "two");
  worker.respond(async () => new Response(null, { status:403 }));
  assert.equal((await worker.fetch(path)).status, 403);
  worker.respond(async () => new Response("temporary", { headers: { "cache-control": "no-store" } }));
  assert.equal(await (await worker.fetch(path)).text(), "temporary"); assert.equal(worker.entries.has(url), false);
  worker.entries.set("https://rss.example/api/archive/images/7", new Response("archive"));
  const before = worker.calls.length;
  assert.equal(await (await worker.fetch("/api/archive/images/7")).text(), "archive"); assert.equal(worker.calls.length, before);
});
